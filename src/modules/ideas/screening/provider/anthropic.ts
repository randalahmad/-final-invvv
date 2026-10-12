import { outputSchema, buildPrompt } from "./shared";
import {
  IdeaScreeningProviderError,
  type IdeaScreeningContext,
  type IdeaScreeningOutput,
  type IdeaScreeningProvider,
} from "./types";

/**
 * External-AI-backed screening provider calling Anthropic's Messages API
 * directly. NOT the default provider -- see provider/gateway.ts, which
 * routes through Vercel's AI Gateway using the project's existing
 * AI_GATEWAY_API_KEY and is preferred so a separate Anthropic account/key
 * is not required. This direct provider remains available as a fallback for
 * anyone who prefers (or only has) a standalone Anthropic key.
 *
 * Configuration (env):
 *  - ANTHROPIC_API_KEY    (required -- provider throws IdeaScreeningProviderError
 *                          without it; the pipeline then marks the job FAILED,
 *                          it never blocks idea submission itself)
 *  - ANTHROPIC_MODEL      (optional -- defaults below; verify this id is still
 *                          current in Anthropic's model list before relying on it)
 *  - ANTHROPIC_API_BASE_URL (optional -- defaults to https://api.anthropic.com)
 *
 * Same KACARE data-residency note as document-analysis's provider seam
 * applies here: do not point this at real institutional idea content without
 * data-residency sign-off (docs/document-analysis.md §8). The default
 * provider must stay opt-in via ANTHROPIC_API_KEY for exactly that reason.
 */

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929"; // confirm against Anthropic's current model list before production use
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const REQUEST_TIMEOUT_MS = 30_000;

export class AnthropicIdeaScreeningProvider implements IdeaScreeningProvider {
  readonly name = "anthropic";
  readonly model: string;
  readonly promptVersion = "idea-screening-1.0.0";
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    this.baseUrl = process.env.ANTHROPIC_API_BASE_URL || DEFAULT_BASE_URL;
  }

  async screen(context: IdeaScreeningContext): Promise<IdeaScreeningOutput> {
    if (!this.apiKey) {
      throw new IdeaScreeningProviderError("ANTHROPIC_API_KEY غير مهيأ — لا يمكن تشغيل الفحص الآلي بالذكاء الاصطناعي");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: buildPrompt(context) }],
        }),
      });
    } catch (e) {
      throw new IdeaScreeningProviderError("تعذّر الاتصال بخدمة الذكاء الاصطناعي الخارجية", e);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new IdeaScreeningProviderError(`فشل طلب الفحص الآلي (HTTP ${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = payload.content?.find((b) => b.type === "text")?.text;
    if (!text) throw new IdeaScreeningProviderError("رد فارغ من خدمة الذكاء الاصطناعي");

    let parsedJson: unknown;
    try {
      // Models occasionally wrap JSON in a fenced code block despite instructions -- strip it defensively.
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      parsedJson = JSON.parse(cleaned);
    } catch (e) {
      throw new IdeaScreeningProviderError("رد الذكاء الاصطناعي ليس بصيغة JSON صالحة", e);
    }

    const result = outputSchema.safeParse(parsedJson);
    if (!result.success) {
      throw new IdeaScreeningProviderError(`رد الذكاء الاصطناعي لا يطابق الشكل المتوقع: ${result.error.message}`);
    }
    return result.data;
  }
}
