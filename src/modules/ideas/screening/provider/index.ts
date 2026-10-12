import { AnthropicIdeaScreeningProvider } from "./anthropic";
import { GatewayIdeaScreeningProvider } from "./gateway";
import type { IdeaScreeningProvider } from "./types";

export * from "./types";
export { AnthropicIdeaScreeningProvider } from "./anthropic";
export { GatewayIdeaScreeningProvider } from "./gateway";

let override: IdeaScreeningProvider | null = null;
let cached: IdeaScreeningProvider | null = null;

/** Test/bootstrap hook -- inject a fake or alternative provider. */
export function setIdeaScreeningProvider(provider: IdeaScreeningProvider | null): void {
  override = provider;
  cached = null;
}

/**
 * Resolve the configured idea-screening provider.
 *  - Default: Vercel AI Gateway (provider/gateway.ts), keyed by
 *    AI_GATEWAY_API_KEY -- reuses the same key/transport as the project's
 *    existing "AI readiness" preview feature, so no separate Anthropic
 *    account is required.
 *  - Fallback: a direct Anthropic call (provider/anthropic.ts) when no
 *    Gateway key is set but ANTHROPIC_API_KEY is.
 *  - If neither is configured, the Gateway provider is still returned and
 *    fails closed per-call with IdeaScreeningProviderError -- the pipeline
 *    then marks the job FAILED without blocking idea submission.
 * Mirrors modules/document-analysis/provider/index.ts's swap mechanism.
 */
export function getIdeaScreeningProvider(): IdeaScreeningProvider {
  if (override) return override;
  if (!cached) {
    cached = process.env.AI_GATEWAY_API_KEY
      ? new GatewayIdeaScreeningProvider()
      : process.env.ANTHROPIC_API_KEY
        ? new AnthropicIdeaScreeningProvider()
        : new GatewayIdeaScreeningProvider();
  }
  return cached;
}
