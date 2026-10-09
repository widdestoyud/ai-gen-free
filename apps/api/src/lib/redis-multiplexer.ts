import type IORedis from "ioredis";

export type MessageHandler = (message: string) => void;

export class RedisSubscriberMultiplexer {
  private subscriber: IORedis | null = null;
  private channelHandlers = new Map<string, Set<MessageHandler>>();
  private rootRedis: IORedis | null = null;

  constructor(redis?: IORedis | null) {
    this.rootRedis = redis ?? null;
  }

  public setRedis(redis: IORedis | null | undefined): void {
    if (this.rootRedis === redis) return;
    this.rootRedis = redis ?? null;
    if (this.subscriber) {
      void this.close();
    }
  }

  private getSubscriber(): IORedis | null {
    if (this.subscriber) return this.subscriber;
    if (!this.rootRedis) return null;

    try {
      this.subscriber = this.rootRedis.duplicate();
      this.subscriber.on("error", (err) => {
        // Prevent unhandled error crashing process
        console.error("[redis-multiplexer] Subscriber error:", (err as Error)?.message || err);
      });
      this.subscriber.on("message", (channel: string, message: string) => {
        const handlers = this.channelHandlers.get(channel);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(message);
            } catch (err) {
              console.error("[redis-multiplexer] Handler dispatch error:", err);
            }
          }
        }
      });
      return this.subscriber;
    } catch (err) {
      console.error("[redis-multiplexer] Failed to duplicate subscriber:", err);
      return null;
    }
  }

  public async subscribe(channel: string, handler: MessageHandler): Promise<() => void> {
    const subscriber = this.getSubscriber();
    if (!subscriber) {
      return () => {};
    }

    let handlers = this.channelHandlers.get(channel);
    const isFirst = !handlers || handlers.size === 0;

    if (!handlers) {
      handlers = new Set<MessageHandler>();
      this.channelHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    if (isFirst) {
      try {
        await subscriber.subscribe(channel);
      } catch (err) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.channelHandlers.delete(channel);
        }
        throw err;
      }
    }

    return () => {
      const currentHandlers = this.channelHandlers.get(channel);
      if (!currentHandlers) return;
      currentHandlers.delete(handler);
      if (currentHandlers.size === 0) {
        this.channelHandlers.delete(channel);
        if (this.subscriber) {
          this.subscriber.unsubscribe(channel).catch(() => {});
        }
      }
    };
  }

  public async close(): Promise<void> {
    if (this.subscriber) {
      try {
        this.subscriber.removeAllListeners();
        await this.subscriber.quit();
      } catch {}
      this.subscriber = null;
    }
    this.channelHandlers.clear();
  }
}
