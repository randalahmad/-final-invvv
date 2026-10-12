import type { IdeaScreeningRecommendation, IdeaScreeningVerdict } from "@prisma/client";

/**
 * Provider-independent AI-screening contract -- the seam for the
 * heuristic-vs-external-AI choice, mirroring
 * `modules/document-analysis/provider/types.ts`. A provider only ever
 * PROPOSES an advisory recommendation: it NEVER sets `Idea.status`, approves
 * or rejects an idea, or writes to `IdeaDecision`/`IdeaEvaluation`. Only a
 * human holding `idea.evaluate`/`idea.decide` can act on what it returns
 * (see docs/document-analysis.md's AI invariant, restated here for ideas).
 */

export interface IdeaScreeningContext {
  idea: {
    id: string;
    titleAr: string;
    description: string | null;
  };
  department: { id: string; nameAr: string } | null;
  activity: { id: string; nameAr: string; type: string } | null;
  /** Titles of this department's other non-archived ideas, for a lightweight
   *  possible-duplicate signal -- never a hard match, always advisory. */
  siblingIdeaTitles: string[];
}

export interface IdeaScreeningFindingOutput {
  criterionKey: string;
  labelAr: string;
  verdict: IdeaScreeningVerdict;
  noteAr?: string;
}

export interface IdeaScreeningOutput {
  score: number; // 0-100, advisory only
  recommendation: IdeaScreeningRecommendation;
  summaryAr: string;
  findings: IdeaScreeningFindingOutput[];
}

export interface IdeaScreeningProvider {
  readonly name: string;
  readonly model: string;
  readonly promptVersion?: string;
  screen(context: IdeaScreeningContext): Promise<IdeaScreeningOutput>;
}

export class IdeaScreeningProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "IdeaScreeningProviderError";
  }
}
