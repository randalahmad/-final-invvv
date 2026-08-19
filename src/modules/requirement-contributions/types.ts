import type {WorkspaceData} from "@/modules/dga/workspace-status";

export interface ContributionDefinition {
  requirementId:string;
  code:string;
  unit:string;
  number:string;
  sections:readonly string[];
  labels:Record<string,string>;
}

export const CONTRIBUTION_DEFINITIONS:readonly ContributionDefinition[]=[
  {requirementId:"5-23-1-r1",code:"5.23.1.1",unit:"5.23.1",number:"01",sections:["innovationAreas","strategicGoals","kpis","alignment"],labels:{innovationAreas:"مجالات الابتكار",strategicGoals:"الأهداف الاستراتيجية للبحث والابتكار",kpis:"المؤشرات KPIs",alignment:"المواءمة مع أهداف الجهة"}},
  {requirementId:"5-23-1-r2",code:"5.23.1.2",unit:"5.23.1",number:"02",sections:["initiatives","strategicAlignment","initiativeKpis"],labels:{initiatives:"بيانات المبادرات والمشروعات",strategicAlignment:"المواءمة الاستراتيجية",initiativeKpis:"مؤشرات أداء المبادرات"}},
  {requirementId:"5-23-1-r3",code:"5.23.1.3",unit:"5.23.1",number:"03",sections:["cooperations","partnerContacts","agreements","cooperationOutputs"],labels:{cooperations:"بيانات الجهة ونطاق التعاون",partnerContacts:"جهات الاتصال والمسؤولون",agreements:"بيانات الاتفاقية",cooperationOutputs:"المخرجات"}},
  {requirementId:"5-23-2-r1",code:"5.23.2.1",unit:"5.23.2",number:"01",sections:["annualPlan","activities"],labels:{annualPlan:"بيانات الخطة السنوية",activities:"توثيق الأنشطة والفعاليات"}},
  {requirementId:"5-23-2-r2",code:"5.23.2.2",unit:"5.23.2",number:"02",sections:["methodologyCases","sessions","participants","solutions","prototypes","indicators","evidence"],labels:{methodologyCases:"بيانات المنهجية والتحدي",sessions:"توثيق الجلسات",participants:"المشاركون",solutions:"الحلول المقترحة",prototypes:"النماذج الأولية",indicators:"المؤشرات والأثر",evidence:"تجهيز الإثبات"}},
  {requirementId:"5-23-2-r3",code:"5.23.2.3",unit:"5.23.2",number:"03",sections:["timeline","challenges","participants","teams","solutions","judging","winners","prototypes","projects","impact","files","evidence","closure"],labels:{timeline:"الجدول والجلسات",challenges:"التحديات",participants:"سجل المشاركين",teams:"الفرق",solutions:"الحلول والمشاركات",judging:"التحكيم",winners:"الفائزون",prototypes:"النماذج الأولية",projects:"المشاريع الناتجة",impact:"معلومات الأثر",files:"ملفات العمل والشهادات",evidence:"تجهيز الإثبات",closure:"توثيق الإغلاق"}},
  {requirementId:"5-23-2-r4",code:"5.23.2.4",unit:"5.23.2",number:"04",sections:["meetings","commitments","outputs","reports","correctiveActions","evidence"],labels:{meetings:"إعداد الاجتماعات والمحاضر",commitments:"متابعة الالتزامات",outputs:"توثيق المخرجات",reports:"إعداد التقرير الدوري",correctiveActions:"تحديث الإجراءات التصحيحية",evidence:"تجهيز دليل التفعيل"}},
] as const;

export const REQUIREMENT_01_ID="5-23-1-r1";
export const REQUIREMENT_02_ID="5-23-1-r2";
export const REQUIREMENT_03_ID="5-23-1-r3";
export const CONTRIBUTION_SECTIONS=CONTRIBUTION_DEFINITIONS[0].sections;
export const SECTION_LABELS=CONTRIBUTION_DEFINITIONS[0].labels;
export type ContributionSectionKey=string;
export const getContributionDefinition=(requirementId:string)=>CONTRIBUTION_DEFINITIONS.find(item=>item.requirementId===requirementId);
export const sectionLabel=(requirementId:string,sectionKey:string)=>getContributionDefinition(requirementId)?.labels[sectionKey]??sectionKey;

export interface ContributionView {
  id:string; sectionKey:string; contributorRole:"RESPONSIBLE"|"SUPPORTING"; contributorUserId:string|null;
  contributorName:string; contributorEmail:string; jobTitle:string|null; departmentName:string|null;
  assignedByName:string; reviewerName:string|null; dueDate:string|null; priority:"LOW"|"MEDIUM"|"HIGH"|"URGENT";
  requesterNote:string|null; status:string; invitationDelivery:string; assignedAt:string; invitationSentAt:string|null;
  openedAt:string|null; submittedAt:string|null; reviewedAt:string|null; completedAt:string|null;
  latestSubmission:{version:number;data:WorkspaceData[string];submittedAt:string;reviewNotes:string|null}|null;
}
