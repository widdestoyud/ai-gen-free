import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { sendKelontongChatCompletion, type KelontongChatOptions } from "./kelontong.js";

export const MAGIC_PROMPT_SYSTEM_INSTRUCTION = `You are an expert visual prompt engineer for state-of-the-art AI image and video generation models (like FLUX.1, SDXL, Siray, Kling, Midjourney).
Your task is to take the user's raw, short, or vague prompt and enhance it into a detailed, descriptive, highly visual prompt in the same language or English for optimal AI generation.

Guidelines:
1. Subject & Action: Clearly define the subject, posture, clothing/materials, and expressions.
2. Environment & Atmosphere: Add rich background, spatial depth, atmospheric mood.
3. Lighting & Camera: Describe lighting (e.g., cinematic rim lighting, volumetric rays, soft studio lighting) and camera aesthetics (e.g., 85mm portrait lens, shallow depth of field, 8k masterpiece).
4. Direct Output: Output ONLY the enhanced prompt. DO NOT include greetings, intro text (like "Here is your prompt:"), quotes, or markdown code blocks.`;

export interface MagicPromptRequest {
  prompt: string;
  model?: string;
  style?: string;
}

export interface MagicPromptResponse {
  enhancedPrompt: string;
  originalPrompt: string;
  model: string;
}

export async function enhancePromptWithMagicPrompt(
  req: MagicPromptRequest,
  opts?: KelontongChatOptions,
): Promise<MagicPromptResponse> {
  const rawPrompt = typeof req.prompt === "string" ? req.prompt.trim() : "";
  if (!rawPrompt) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      "Prompt tidak boleh kosong untuk Magic Prompt",
      400,
    );
  }

  const model = (typeof req.model === "string" && req.model.trim()) || "gpt-5.6-sol";
  const isTestQA = rawPrompt.startsWith("[TEST:QA]");
  const cleanPrompt = isTestQA ? rawPrompt.replace("[TEST:QA]", "").trim() : rawPrompt;

  const userContent = req.style
    ? `Style: ${req.style}\nPrompt to enhance: ${cleanPrompt}`
    : `Prompt to enhance: ${cleanPrompt}`;

  const completion = await sendKelontongChatCompletion(
    {
      model,
      messages: [
        { role: "system", content: MAGIC_PROMPT_SYSTEM_INSTRUCTION },
        { role: "user", content: isTestQA ? `[TEST:QA] ${userContent}` : userContent },
      ],
      temperature: 0.7,
      max_tokens: 600,
    },
    opts,
  );

  let enhanced = completion.choices?.[0]?.message?.content?.trim() || "";
  // Strip outer quotes if any
  if (
    (enhanced.startsWith('"') && enhanced.endsWith('"')) ||
    (enhanced.startsWith("'") && enhanced.endsWith("'"))
  ) {
    enhanced = enhanced.slice(1, -1).trim();
  }

  return {
    enhancedPrompt: enhanced || rawPrompt,
    originalPrompt: rawPrompt,
    model,
  };
}
