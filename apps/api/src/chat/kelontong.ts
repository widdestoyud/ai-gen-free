import { AppError, ErrorCodes } from "@ai-gen-free/core";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | string;
  content: string;
  name?: string;
}

export interface KelontongChatRequest {
  model?: string;
  messages?: ChatMessage[];
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

export interface KelontongChatResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: ChatMessage;
    delta?: Partial<ChatMessage>;
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message: string;
    type?: string;
    code?: string | number;
  };
}

export interface KelontongChatOptions {
  apiKey?: string;
  apiBase?: string;
  fetchFn?: typeof fetch;
}

export function buildKelontongPayload(body: KelontongChatRequest): {
  model: string;
  messages: ChatMessage[];
  [key: string]: unknown;
} {
  const model = (typeof body.model === "string" && body.model.trim()) || "gpt-5.6-sol";

  let messages: ChatMessage[] = [];
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    messages = body.messages.filter(
      (m) => m && typeof m === "object" && typeof m.role === "string" && typeof m.content === "string",
    );
  } else if (typeof body.prompt === "string" && body.prompt.trim()) {
    messages = [{ role: "user", content: body.prompt.trim() }];
  }

  if (messages.length === 0) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      "Parameter 'messages' (array) atau 'prompt' (string) wajib diisi",
      400,
    );
  }

  const payload: Record<string, unknown> = {
    model,
    messages,
  };

  if (typeof body.temperature === "number") {
    payload.temperature = body.temperature;
  }
  if (typeof body.max_tokens === "number") {
    payload.max_tokens = body.max_tokens;
  }
  if (typeof body.stream === "boolean") {
    payload.stream = body.stream;
  }

  return payload as { model: string; messages: ChatMessage[]; [key: string]: unknown };
}

export async function sendKelontongChatCompletion(
  body: KelontongChatRequest,
  opts?: KelontongChatOptions,
): Promise<KelontongChatResponse> {
  const payload = buildKelontongPayload(body);
  const apiKey =
    opts?.apiKey ||
    process.env.KELONTONGAI_API_KEY ||
    "sk-kelontong-XxPDBa_zxh2EJ5z7wioJXS1BzDajl__IB5SrN5dc";
  const apiBase = (opts?.apiBase || process.env.KELONTONGAI_API_BASE || "https://api.kelontongai.id").replace(
    /\/+$/,
    "",
  );
  const url = `${apiBase}/v1/chat/completions`;
  const customFetch = opts?.fetchFn || fetch;

  if (!apiKey) {
    throw new AppError(
      ErrorCodes.CONFIGURATION_ERROR,
      "KELONTONGAI_API_KEY belum dikonfigurasi",
      500,
    );
  }

  const response = await customFetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new AppError(
      ErrorCodes.PROVIDER_HTTP_ERROR,
      `KelontongAI API mengembalikan respons non-JSON (HTTP ${response.status})`,
      response.status >= 500 ? 502 : response.status,
      { raw: rawText },
    );
  }

  if (!response.ok) {
    const errorMsg = json?.error?.message || json?.message || `HTTP ${response.status}`;
    throw new AppError(
      ErrorCodes.PROVIDER_HTTP_ERROR,
      `KelontongAI error: ${errorMsg}`,
      response.status >= 500 ? 502 : response.status,
      { details: json },
    );
  }

  return json as KelontongChatResponse;
}
