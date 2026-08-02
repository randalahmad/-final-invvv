import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

import { prisma } from "@/server/db";
import { loadAccessContextByUserId, type AccessContext } from "@/server/access-context";
import { AuthorizationError } from "@/server/authorization";
import { MemoryStorageProvider, setStorageProvider } from "@/server/storage";
import {
  uploadEvidence,
  submitEvidence,
  startEvidenceReview,
  approveEvidence,
} from "@/modules/evidence/service";
import {
  runEvidenceAnalysis,
  getEvidenceAnalysis,
  reviewSuggestion,
  acceptHighConfidence,
  confidenceBand,
  formatFromMime,
  AnalysisError,
  CONFIDENCE,
} from "@/modules/document-analysis/service";
import { setDocumentExtractor, LocalDocumentExtractor, type DocumentExtractor, type ExtractionResult } from "@/modules/document-analysis/extractor";
import { setAnalysisProvider } from "@/modules/document-analysis/provider";

const DEPT_A = "dept-digital";
const DEPT_B = "dept-strategy";
const PDF = "application/pdf";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const pdf = (extra = "b") => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from(extra)]);
const zip = (extra = "b") => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(extra)]);
const FILE = () => ({ fileName: "memo.pdf", mimeType: PDF, bytes: pdf() });

let admin: AccessContext, editor: AccessContext, partner: AccessContext, viewer: AccessContext;
let adminId = "", partnerId = "";
let reqCode = "";
let storage: MemoryStorageProvider;

async function expectAuthz(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AuthorizationError " + code);
  } catch (e) {
    expect(e, `AuthorizationError(${code})`).toBeInstanceOf(AuthorizationError);
    expect((e as AuthorizationError).code).toBe(code);
  }
}
async function expectAnalysisErr(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error("expected AnalysisError " + code);
  } catch (e) {
    expect(e, `AnalysisError(${code})`).toBeInstanceOf(AnalysisError);
    expect((e as AnalysisError).code).toBe(code);
  }
}

function fakeExtractor(result: ExtractionResult): DocumentExtractor {
  return { name: "fake", version: "0.0.1", supports: () => true, extract: async () => result };
}

async function makeSolution(deptId: string, opts: { published?: boolean } = {}) {
  const s = await prisma.innovationSolution.create({
    data: {
      nameAr: `حل تحليل ${Math.random().toString(36).slice(2, 8)}`,
      owningDepartmentId: deptId,
      source: "INTERNAL_PROPOSAL",
      status: opts.published ? "ACTIVE" : "DRAFT",
      publishedAt: opts.published ? new Date() : null,
    },
    select: { id: true },
  });
  return s.id;
}
async function shareTo(solutionId: string, actions: string[]) {
  await prisma.resourceShare.create({
    data: { userId: partnerId, entityType: "INNOVATION_SOLUTION", solutionId, allowedActions: actions, allowedFields: ["notes"], grantedById: adminId },
  });
}
/** Extraction text that makes the real heuristic provider emit deterministic suggestions. */
function analysisText() {
  return `محضر اعتماد اللجنة\nيشير هذا المستند إلى البند ${reqCode} الخاص بالحل.`;
}

beforeAll(async () => {
  const [a, e, p, v] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "admin@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "editor@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "partner@innovation.local" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "viewer@innovation.local" } }),
  ]);
  adminId = a.id;
  partnerId = p.id;
  const ctxs = await Promise.all([a, e, p, v].map((u) => loadAccessContextByUserId(u.id)));
  if (ctxs.some((c) => !c)) throw new Error("seed principals missing");
  [admin, editor, partner, viewer] = ctxs as AccessContext[];
  reqCode = (await prisma.complianceRequirement.findFirstOrThrow()).code;
});

beforeEach(() => {
  storage = new MemoryStorageProvider();
  setStorageProvider(storage);
  // Deterministic extraction; the real heuristic provider turns it into suggestions.
  setDocumentExtractor(fakeExtractor({ text: analysisText(), tables: [], meta: { textCoverage: 1 } }));
});
afterEach(() => {
  setStorageProvider(null);
  setDocumentExtractor(null);
  setAnalysisProvider(null);
});

describe("enqueue & pipeline", () => {
  it("1. upload enqueues a QUEUED analysis for a supported format", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    const an = await prisma.documentAnalysis.findUniqueOrThrow({ where: { evidenceId: id } });
    expect(an.status).toBe("QUEUED");
    expect(an.format).toBe("PDF");
  });

  it("2. run: fp UPLOADED→EXTRACTION_READY, an→COMPLETED, suggestions persisted", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    const res = await runEvidenceAnalysis(editor, id);
    expect(res.status).toBe("COMPLETED");
    expect(res.suggestions).toBeGreaterThan(0);
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.fileProcessingStatus).toBe("EXTRACTION_READY");
    const an = await prisma.documentAnalysis.findUniqueOrThrow({ where: { evidenceId: id }, include: { suggestions: true } });
    expect(an.status).toBe("COMPLETED");
    expect(an.suggestions.length).toBeGreaterThan(0);
  });

  it("3. INVARIANT: extraction success never changes reviewStatus", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    await runEvidenceAnalysis(editor, id);
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe("DRAFT");
  });

  it("4. provenance (provider/model/extractor) is stamped", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    await runEvidenceAnalysis(editor, id);
    const an = await prisma.documentAnalysis.findUniqueOrThrow({ where: { evidenceId: id } });
    expect(an.provider).toBe("heuristic");
    expect(an.model).toBeTruthy();
    expect(an.extractorVersion).toContain("fake@");
    expect(an.completedAt).not.toBeNull();
  });

  it("5. extraction failure → fp PROCESSING_FAILED, an FAILED + reason; reviewStatus intact", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    setDocumentExtractor({ name: "boom", version: "0", supports: () => true, extract: async () => { throw new Error("kaboom"); } });
    const res = await runEvidenceAnalysis(editor, id);
    expect(res.status).toBe("FAILED");
    const ev = await prisma.evidence.findUniqueOrThrow({ where: { id } });
    expect(ev.fileProcessingStatus).toBe("PROCESSING_FAILED");
    expect(ev.reviewStatus).toBe("DRAFT");
    const an = await prisma.documentAnalysis.findUniqueOrThrow({ where: { evidenceId: id } });
    expect(an.status).toBe("FAILED");
    expect(an.error).toBeTruthy();
  });

  it("6. re-run replaces prior suggestions", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    await runEvidenceAnalysis(editor, id);
    const first = await prisma.analysisSuggestion.count({
      where: { analysis: { evidenceId: id } },
    });
    await runEvidenceAnalysis(editor, id);
    const second = await prisma.analysisSuggestion.count({ where: { analysis: { evidenceId: id } } });
    expect(second).toBe(first); // replaced, not appended
  });
});

describe("authorization", () => {
  it("7. viewer cannot run analysis (no evidence.upload)", async () => {
    const sol = await makeSolution(DEPT_B, { published: true });
    const { id } = await uploadEvidence(admin, sol, { title: "دليل" }, FILE());
    await expectAuthz(() => runEvidenceAnalysis(viewer, id), "FORBIDDEN");
  });

  it("8. cross-department editor cannot run", async () => {
    const sol = await makeSolution(DEPT_B);
    const { id } = await uploadEvidence(admin, sol, { title: "دليل" }, FILE());
    await expectAuthz(() => runEvidenceAnalysis(editor, id), "OUT_OF_SCOPE");
  });

  it("9. a partner (share, not internal) cannot run analysis", async () => {
    const sol = await makeSolution(DEPT_A);
    await shareTo(sol, ["evidence.create"]);
    const { id } = await uploadEvidence(partner, sol, { title: "دليل شريك" }, FILE());
    await expectAnalysisErr(() => runEvidenceAnalysis(partner, id), "EVIDENCE_LOCKED");
  });

  it("10. INVARIANT: analysis cannot run on APPROVED evidence", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(admin, sol, { title: "دليل" }, FILE());
    await submitEvidence(admin, id);
    await startEvidenceReview(admin, id);
    await approveEvidence(admin, id);
    await expectAnalysisErr(() => runEvidenceAnalysis(admin, id), "EVIDENCE_LOCKED");
  });
});

describe("suggestion review (human-in-the-loop)", () => {
  async function analysed() {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "دليل" }, FILE());
    await runEvidenceAnalysis(editor, id);
    const an = await getEvidenceAnalysis(editor, id);
    return { sol, id, suggestions: an!.suggestions };
  }

  it("11. accepting a REQUIREMENT_MAP creates an EvidenceLink to the requirement", async () => {
    const { id, suggestions } = await analysed();
    const map = suggestions.find((s) => s.kind === "REQUIREMENT_MAP")!;
    expect(map).toBeTruthy();
    await reviewSuggestion(editor, map.id, { outcome: "ACCEPTED" });
    const link = await prisma.evidenceLink.findFirst({
      where: { evidenceId: id, entityType: "COMPLIANCE_REQUIREMENT", entityId: map.suggestedRequirementId! },
    });
    expect(link).not.toBeNull();
    const after = await prisma.analysisSuggestion.findUniqueOrThrow({ where: { id: map.id } });
    expect(after.reviewOutcome).toBe("ACCEPTED");
    expect(after.reviewedById).toBe(editor.userId);
  });

  it("12. INVARIANT: accepting a suggestion never approves the evidence", async () => {
    const { id, suggestions } = await analysed();
    for (const s of suggestions) await reviewSuggestion(editor, s.id, { outcome: "ACCEPTED" });
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).reviewStatus).toBe("DRAFT");
  });

  it("13. accepting a FIELD(classification) applies it to the evidence", async () => {
    const { id, suggestions } = await analysed();
    const field = suggestions.find((s) => s.kind === "FIELD" && s.fieldKey === "classification")!;
    expect(field).toBeTruthy();
    await reviewSuggestion(editor, field.id, { outcome: "ACCEPTED" });
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).classification).toBe(field.suggestedValue);
  });

  it("14. editing a FIELD stores the edited value and applies it", async () => {
    const { id, suggestions } = await analysed();
    const field = suggestions.find((s) => s.kind === "FIELD" && s.fieldKey === "classification")!;
    await reviewSuggestion(editor, field.id, { outcome: "EDITED", editedValue: "CUSTOM_TYPE" });
    const s = await prisma.analysisSuggestion.findUniqueOrThrow({ where: { id: field.id } });
    expect(s.reviewOutcome).toBe("EDITED");
    expect(s.reviewedValue).toBe("CUSTOM_TYPE");
    expect((await prisma.evidence.findUniqueOrThrow({ where: { id } })).classification).toBe("CUSTOM_TYPE");
  });

  it("15. rejecting a REQUIREMENT_MAP creates no link", async () => {
    const { id, suggestions } = await analysed();
    const map = suggestions.find((s) => s.kind === "REQUIREMENT_MAP")!;
    await reviewSuggestion(editor, map.id, { outcome: "REJECTED" });
    const link = await prisma.evidenceLink.findFirst({
      where: { evidenceId: id, entityType: "COMPLIANCE_REQUIREMENT", entityId: map.suggestedRequirementId! },
    });
    expect(link).toBeNull();
    expect((await prisma.analysisSuggestion.findUniqueOrThrow({ where: { id: map.id } })).reviewOutcome).toBe("REJECTED");
  });

  it("16. INVARIANT: suggestions of an APPROVED evidence cannot be reviewed", async () => {
    const { id, suggestions } = await analysed();
    await submitEvidence(admin, id);
    await startEvidenceReview(admin, id);
    await approveEvidence(admin, id);
    await expectAnalysisErr(() => reviewSuggestion(admin, suggestions[0].id, { outcome: "ACCEPTED" }), "EVIDENCE_LOCKED");
  });

  it("17. accept-high-confidence accepts only ≥ threshold pending items", async () => {
    const { id, suggestions } = await analysed();
    const highPending = suggestions.filter((s) => (s.confidence ?? 0) >= CONFIDENCE.HIGH).length;
    const { accepted } = await acceptHighConfidence(editor, id);
    expect(accepted).toBe(highPending);
    // A low-confidence item remains PENDING.
    const remaining = await prisma.analysisSuggestion.findMany({ where: { analysis: { evidenceId: id }, reviewOutcome: "PENDING" } });
    expect(remaining.every((s) => (s.confidence ?? 0) < CONFIDENCE.HIGH)).toBe(true);
  });
});

describe("helpers & real extractor", () => {
  it("18. confidenceBand thresholds", () => {
    expect(confidenceBand(0.9)).toBe("HIGH");
    expect(confidenceBand(0.75)).toBe("MEDIUM");
    expect(confidenceBand(0.5)).toBe("LOW");
    expect(confidenceBand(null)).toBe("LOW");
  });

  it("19. formatFromMime maps supported types", () => {
    expect(formatFromMime(PDF)).toBe("PDF");
    expect(formatFromMime(XLSX)).toBe("XLSX");
    expect(formatFromMime("image/png")).toBeNull();
  });

  it("20. the REAL local XLSX extractor reads a structured workbook", async () => {
    setDocumentExtractor(null); // use the real LocalDocumentExtractor
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Impact");
    ws.addRow(["المؤشر", "الأساس", "المستهدف", "الفعلي", "الوحدة"]);
    ws.addRow(["زمن التوقف", 100, 70, 80, "%"]);
    ws.addRow(["الرضا", 60, 90, 85, "%"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await new LocalDocumentExtractor().extract("XLSX", buf);
    expect(result.tables.length).toBe(1);
    expect(result.tables[0].headers).toContain("المؤشر");
    expect(result.tables[0].rows.length).toBe(2);
    expect(result.meta.unsupportedStructure).toBeFalsy();
  });

  it("21. XLSX with a numeric-only header row is flagged unsupportedStructure", async () => {
    setDocumentExtractor(null);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Raw");
    ws.addRow([1, 2, 3, 4]);
    ws.addRow([5, 6, 7, 8]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const result = await new LocalDocumentExtractor().extract("XLSX", buf);
    expect(result.meta.unsupportedStructure).toBe(true);
  });

  it("22. the real extractor rejects an empty buffer", async () => {
    await expect(new LocalDocumentExtractor().extract("PDF", Buffer.alloc(0))).rejects.toBeTruthy();
  });
});

describe("audit", () => {
  it("23. analysis and suggestion actions are audited", async () => {
    const sol = await makeSolution(DEPT_A);
    const { id } = await uploadEvidence(editor, sol, { title: "تدقيق" }, FILE());
    await runEvidenceAnalysis(editor, id);
    const an = await getEvidenceAnalysis(editor, id);
    await reviewSuggestion(editor, an!.suggestions[0].id, { outcome: "ACCEPTED" });

    const actions = (
      await prisma.auditLog.findMany({ where: { entityType: "EVIDENCE", entityId: id }, select: { action: true } })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["ANALYSIS_QUEUED", "ANALYSIS_STARTED", "ANALYSIS_COMPLETED", "SUGGESTION_ACCEPTED"]),
    );
  });
});
