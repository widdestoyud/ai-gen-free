import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import {
  sendKelontongChatCompletion,
  type ChatMessage,
  type KelontongChatOptions,
  type KelontongChatResponse,
} from "./kelontong.js";

export interface GenerateChatRequest {
  sessionId?: string;
  title?: string;
  messages?: ChatMessage[];
  prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  systemInstruction?: string;
  saveSession?: boolean;
}

export interface GenerateChatResult extends KelontongChatResponse {
  sessionId?: string;
  savedMessages?: boolean;
}

export async function processGenerateChat(
  userId: string,
  body: GenerateChatRequest,
  opts?: KelontongChatOptions,
): Promise<GenerateChatResult> {
  const model = (typeof body.model === "string" && body.model.trim()) || "gpt-5.6-sol";
  const shouldPersist = Boolean(body.sessionId || body.saveSession);

  let sessionId = body.sessionId;
  let historyMessages: ChatMessage[] = [];

  // If a sessionId is provided, fetch existing session and messages
  if (sessionId) {
    const existingSession = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!existingSession) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Sesi percakapan tidak ditemukan", 404);
    }

    historyMessages = existingSession.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  // Determine incoming new messages
  let incomingMessages: ChatMessage[] = [];
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    incomingMessages = body.messages.filter(
      (m) => m && typeof m === "object" && typeof m.role === "string" && typeof m.content === "string",
    );
  } else if (typeof body.prompt === "string" && body.prompt.trim()) {
    incomingMessages = [{ role: "user", content: body.prompt.trim() }];
  }

  if (incomingMessages.length === 0 && historyMessages.length === 0) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      "Parameter 'messages' atau 'prompt' wajib diisi",
      400,
    );
  }

  // Build full message list for completion
  const conversationMessages: ChatMessage[] = [];
  if (body.systemInstruction?.trim()) {
    conversationMessages.push({
      role: "system",
      content: body.systemInstruction.trim(),
    });
  }

  if (sessionId && historyMessages.length > 0) {
    // Append previous session history
    conversationMessages.push(...historyMessages);
  }

  // Append new incoming messages
  conversationMessages.push(...incomingMessages);

  // Call KelontongAI completion
  const completion = await sendKelontongChatCompletion(
    {
      model,
      messages: conversationMessages,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
    },
    opts,
  );

  const assistantReply = completion.choices?.[0]?.message?.content ?? "";

  // If session persistence is active
  if (shouldPersist) {
    if (!sessionId) {
      // Auto-generate title from first user prompt if not given
      const firstUserContent =
        incomingMessages.find((m) => m.role === "user")?.content || "Percakapan Baru";
      const autoTitle =
        body.title?.trim() ||
        (firstUserContent.length > 40 ? firstUserContent.slice(0, 37) + "..." : firstUserContent);

      const created = await prisma.chatSession.create({
        data: {
          userId,
          title: autoTitle,
        },
      });
      sessionId = created.id;
    } else {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    }

    // Save incoming new messages and the assistant's reply
    const messagesToSave: Array<{ sessionId: string; role: string; content: string }> = [
      ...incomingMessages.map((m) => ({
        sessionId: sessionId!,
        role: m.role,
        content: m.content,
      })),
    ];

    if (assistantReply) {
      messagesToSave.push({
        sessionId: sessionId!,
        role: "assistant",
        content: assistantReply,
      });
    }

    if (messagesToSave.length > 0) {
      await prisma.chatMessage.createMany({
        data: messagesToSave,
      });
    }
  }

  return {
    ...completion,
    sessionId,
    savedMessages: shouldPersist,
  };
}

export async function listChatSessionsForUser(
  userId: string,
  limit = 20,
  offset = 0,
) {
  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.chatSession.count({ where: { userId } }),
  ]);

  return {
    total,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      lastMessage: s.messages[0]?.content ?? null,
    })),
  };
}

export async function getChatSessionForUser(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    throw new AppError(ErrorCodes.NOT_FOUND, "Sesi percakapan tidak ditemukan", 404);
  }

  return session;
}

export async function deleteChatSessionForUser(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new AppError(ErrorCodes.NOT_FOUND, "Sesi percakapan tidak ditemukan", 404);
  }

  await prisma.chatSession.delete({
    where: { id: sessionId },
  });

  return { ok: true, deletedId: sessionId };
}
