/**
 * Provider-independent preliminary idea analysis. Providers return advice
 * only; they have no access to the official evaluation or decision records.
 */
export interface IdeaAnalysisInput {
  idea: { id: string; titleAr: string; description: string | null; activityId: string | null; departmentId: string | null };
  comparableIdeas: { id: string; titleAr: string; description: string | null }[];
  evidenceCount: number;
}

export interface IdeaAnalysisOutput {
  score: number;
  flags: string[];
}

export interface IdeaAnalysisProvider {
  readonly name: string;
  readonly model: string;
  analyze(input: IdeaAnalysisInput): Promise<IdeaAnalysisOutput>;
}
