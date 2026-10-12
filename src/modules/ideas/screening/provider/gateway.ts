import { generateText, Output } from "ai";

import { outputSchema, buildPrompt, SCREENING_SYSTEM_PROMPT } from "./shared";
import {
  IdeaScreeningProviderError,
  type IdeaScreeningContext,
  type IdeaScreeningOutput,
  type IdeaScreeningProvider,
} from "./types";

/**
 * External-AI-backed screening provider routed through Vercel's AI Gateway
 * (the same transport the project's existing "AI readiness" preview feature
 * already uses -- see src/app/api/ux-preview/idea-readiness/route.ts). This
 * is the DEFAULT idea-screening provider: it reuses the project's existing
 * AI_GATEWAY_API_KEY so no separate Anthropic account/key is required.
 *
 * Configuration (env):
 *  - AI_GATEWAY_API_KEY     (required -- the same key used by the AI
 *                            readiness preview feature; without it the
 *                            provider throws IdeaScreeningProviderError and
 *                            the pipeline marks the job FAILED without
 *                            blocking idea submission)
 *  - IDEA_SCREENING_MODEL   (optional -- Gateway model id, "provider/model"
 *                            form; defaults below. Verify the slug is still
 *                            listed in your Gateway dashboard.)
 *
 * Same KACARE data-residency note as the direct-Anthropic provider
 * (./anthropic.ts) and document-analysis's provider seam applies here: do
 * not point this at real institutional idea content without data-residency
 * sign-off (docs/document-analysis.md §8).
 */

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5"; // Gateway model id -- confirm against your Gateway's current model list.

export class GatewayIdeaScreeningProvider implements IdeaScreeningProvider {
  readonly name = "vercel-ai-gateway";
  readonly model: string;
  readonly promptVersion = "idea-screening-1.0.0";

  constructor() {
    this.model = process.env.IDEA_SCREENING_MODEL || DEFAULT_MODEL;
  }

  async screen(context: IdeaScreeningContext): Promise<IdeaScreeningOutput> {
    if (!process.env.AI_GATEWAY_API_KEY) {
      throw new IdeaScreeningProviderError("AI_GATEWAY_API_KEY غير مهيأ — لا يمكن تشغيل الفحص الآلي بالذكاء الاصطناعي");
    }

    let result: Awaited<ReturnType<typeof generateText>>;
    try {
      result = await generateText({
        model: this.model,
        output: Output.object({
          name: "IdeaScreening",
          description: "تقييم استشاري أولي لفكرة مقدَّمة على منصة الابتكار المؤسسي",
          schema: outputSchema,
        }),
        system: SCREENING_SYSTEM_PROMPT,
        prompt: buildPrompt(context),
      });
    } catch (e) {
      throw new IdeaScreeningProviderError("تعذّر الاتصال بخدمة الذكاء الاصطناعي عبر Vercel AI Gateway", e);
    }

    const parsed = outputSchema.safeParse(result.output);
    if (!parsed.success) {
      throw new IdeaScreeningProviderError(`رد الذكاء الاصطناعي لا يطابق الشكل المتوقع: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
