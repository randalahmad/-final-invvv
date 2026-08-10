import { describe, expect, it } from "vitest";
import { impactEntrySchema } from "@/modules/impact/schema";

describe("impact operational input",()=>{
  it("accepts a source-supported indicator and measurement",()=>{const parsed=impactEntrySchema.parse({solutionId:"s1",nameAr:"خفض زمن الخدمة",type:"OPERATIONAL",unit:"دقيقة",baselineValue:"45",targetValue:"20",measurementMethod:"متوسط زمن المعاملة",actualValue:"24",periodStart:"2026-04-01",periodEnd:"2026-06-30",dataSource:"منصة الخدمات",notes:""});expect(parsed.baselineValue).toBe(45);expect(parsed.actualValue).toBe(24);});
  it("requires a named indicator",()=>{expect(()=>impactEntrySchema.parse({solutionId:"s1",nameAr:"",type:"FINANCIAL"})).toThrow();});
});
