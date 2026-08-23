import { describe, expect, it } from "vitest";
import { computePortfolioReadiness, detectPotentialDuplicates, normalizeSolutionTitle, solutionFingerprint } from "@/modules/solutions/portfolio";

describe("5.24.1 operational solution portfolio", () => {
  it("normalizes Arabic titles deterministically", () => {
    expect(normalizeSolutionTitle("  مُساعِدُ المُستفيد الرَّقمي  ")).toBe(normalizeSolutionTitle("مساعد المستفيد الرقمي"));
  });
  it("prioritizes stable source and external references", () => {
    expect(solutionFingerprint({ nameAr: "حل", externalReferenceId: " EXT-9 " })).toBe("ref:ext-9");
    expect(solutionFingerprint({ nameAr: "حل", sourceRecordType: "ACTIVITY", sourceRecordId: "a1" })).toBe("source:ACTIVITY:a1");
  });
  it("flags exact normalized duplicates without silently blocking a distinct record", () => {
    const existing=[{id:"a",nameAr:"المساعد الرقمي",externalReferenceId:null,sourceRecordType:null,sourceRecordId:null}];
    expect(detectPotentialDuplicates({nameAr:"المُساعِد الرَّقمي"},existing)).toHaveLength(1);
    expect(detectPotentialDuplicates({nameAr:"نظام الطاقة"},existing)).toHaveLength(0);
  });
  it("explains internal readiness dimensions rather than claiming an official score", () => {
    const readiness=computePortfolioReadiness({nameAr:"حل",description:"وصف",problemStatement:"مشكلة",owningDepartmentId:"d",ownerUserId:"u",maturityStage:"POC",implementationStatus:"IN_PROGRESS",startDate:new Date(),beneficiaryCount:12,nextAction:"رفع التقرير"});
    expect(readiness.percentage).toBeGreaterThan(50); expect(readiness.missing).toContain("الارتباط الاستراتيجي"); expect(readiness.missing).toContain("الوثائق المساندة");
  });
});
