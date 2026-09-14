import { HeuristicIdeaAnalysisProvider } from "./heuristic";
import type { IdeaAnalysisProvider } from "./types";

export * from "./types";
export { HeuristicIdeaAnalysisProvider } from "./heuristic";

let override: IdeaAnalysisProvider | null = null;
let cached: IdeaAnalysisProvider | null = null;

export function setIdeaAnalysisProvider(provider: IdeaAnalysisProvider | null): void {
  override = provider;
  cached = null;
}

export function getIdeaAnalysisProvider(): IdeaAnalysisProvider {
  if (override) return override;
  if (!cached) cached = new HeuristicIdeaAnalysisProvider();
  return cached;
}
