import { LocalDocumentExtractor } from "./local";
import type { DocumentExtractor } from "./types";

export * from "./types";
export { LocalDocumentExtractor } from "./local";

let override: DocumentExtractor | null = null;
let cached: DocumentExtractor | null = null;

/** Test/bootstrap hook — inject an extractor (e.g. a deterministic fake). */
export function setDocumentExtractor(extractor: DocumentExtractor | null): void {
  override = extractor;
  cached = null;
}

/** Resolve the configured extractor (defaults to the local, self-hosted one). */
export function getDocumentExtractor(): DocumentExtractor {
  if (override) return override;
  if (!cached) cached = new LocalDocumentExtractor();
  return cached;
}
