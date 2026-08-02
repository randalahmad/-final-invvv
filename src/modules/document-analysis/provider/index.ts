import { HeuristicAnalysisProvider } from "./heuristic";
import type { AnalysisProvider } from "./types";

export * from "./types";
export { HeuristicAnalysisProvider } from "./heuristic";

let override: AnalysisProvider | null = null;
let cached: AnalysisProvider | null = null;

/** Test/bootstrap hook — inject an analysis provider (fake or LLM-backed). */
export function setAnalysisProvider(provider: AnalysisProvider | null): void {
  override = provider;
  cached = null;
}

/**
 * Resolve the configured analysis provider. Defaults to the local heuristic
 * provider (no external calls). When the provider decision lands, an LLM-backed
 * provider is selected here (e.g. via ANALYSIS_PROVIDER env) — no pipeline
 * change required. An external provider must not be used for real institutional
 * documents without KACARE data-residency sign-off (see document-analysis.md §8).
 */
export function getAnalysisProvider(): AnalysisProvider {
  if (override) return override;
  if (!cached) cached = new HeuristicAnalysisProvider();
  return cached;
}
