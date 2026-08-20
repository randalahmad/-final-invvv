export type WorkspaceFieldType = "text" | "textarea" | "date" | "number" | "select";
export interface WorkspaceField { key: string; label: string; type?: WorkspaceFieldType; required?: boolean; options?: readonly string[] }
export interface WorkspaceSection { key: string; title: string; repeatable?: boolean; minItems?: number; contributionOnly?:boolean; fields: readonly WorkspaceField[] }
export interface WorkspaceEvidenceRule { key: string; title: string; minCount: number }
export interface RequirementWorkspaceConfig { requirementId: string; code: string; explanation: string; sections: readonly WorkspaceSection[]; evidence: readonly WorkspaceEvidenceRule[] }

const f = (key: string, label: string, type: WorkspaceFieldType = "text", required = true): WorkspaceField => ({ key, label, type, required });
const e = (key: string, title: string, minCount = 1): WorkspaceEvidenceRule => ({ key, title, minCount });
const openSection=(key:string,title:string,fields:readonly WorkspaceField[]):WorkspaceSection=>({key,title,repeatable:true,minItems:1,fields,contributionOnly:true});
const OPEN_INNOVATION_CONTRIBUTION_SECTIONS:readonly WorkspaceSection[]=[
  openSection("timeline","الجدول والجلسات",[f("name","اسم السجل"),f("type","النوع"),f("date","التاريخ/الوقت"),f("responsible","المسؤول"),f("status","الحالة"),f("followUp","إجراء المتابعة","textarea",false)]),
  openSection("challenges","التحديات",[f("title","عنوان التحدي"),f("description","الوصف","textarea"),f("owner","المالك"),f("entity","الإدارة/الجهة"),f("category","التصنيف"),f("status","الحالة")]),
  openSection("participants","سجل المشاركين",[f("name","اسم المشارك"),f("category","الفئة"),f("organization","الجهة"),f("teamId","الفريق","text",false),f("status","الحالة"),f("attendance","الحضور")]),
  openSection("teams","الفرق",[f("name","اسم الفريق"),f("lead","قائد الفريق"),f("challengeId","التحدي"),f("solutionId","الحل","text",false),f("status","الحالة")]),
  openSection("solutions","الحلول والمشاركات",[f("name","اسم الحل"),f("challengeId","التحدي"),f("teamId","الفريق"),f("summary","الملخص","textarea"),f("submittedAt","تاريخ التسليم"),f("status","الحالة")]),
  openSection("judging","التحكيم",[f("solutionId","الحل"),f("round","الجولة"),f("criteria","المعايير"),f("score","النتيجة"),f("comments","الملاحظات","textarea",false),f("ranking","الترتيب")]),
  openSection("winners","الفائزون",[f("solutionId","الحل"),f("category","فئة الفوز"),f("ranking","الترتيب"),f("decision","القرار")]),
  openSection("prototypes","النماذج الأولية",[f("name","اسم النموذج"),f("solutionId","الحل المصدر"),f("version","الإصدار"),f("stage","المرحلة"),f("result","النتيجة","textarea")]),
  openSection("projects","المشاريع الناتجة",[f("solutionId","الحل المصدر"),f("name","اسم المشروع"),f("owner","المالك"),f("department","الإدارة"),f("implementationState","حالة التنفيذ"),f("status","الحالة")]),
  openSection("impact","معلومات الأثر",[f("projectId","المشروع"),f("beneficiaries","المستفيدون"),f("outcome","النتيجة","textarea"),f("kpi","المؤشر"),f("measurement","القياس")]),
  openSection("files","ملفات العمل والشهادات",[f("title","اسم الملف"),f("category","الفئة"),f("fileName","اسم الملف المرفوع"),f("reviewState","حالة المراجعة")]),
  openSection("evidence","تجهيز الإثبات",[f("title","وصف الدليل"),f("relatedRecord","السجل المرتبط"),f("notes","ملاحظات التجهيز","textarea")]),
  openSection("closure","توثيق الإغلاق",[f("summary","ملخص الإغلاق","textarea"),f("openItems","العناصر المتبقية","textarea",false),f("status","الحالة")]),
];
const COOPERATION_ACTIVATION_CONTRIBUTION_SECTIONS:readonly WorkspaceSection[]=[
  {...openSection("meetings","إعداد الاجتماعات والمحاضر",[f("title","عنوان الاجتماع"),f("quarter","الربع"),f("date","التاريخ","date"),f("minutes","المحضر","textarea"),f("status","الحالة")]),minItems:4},
  openSection("commitments","متابعة الالتزامات",[f("title","الالتزام"),f("source","المصدر"),f("owner","المسؤول"),f("dueDate","الموعد","date"),f("status","الحالة")]),
  openSection("outputs","توثيق المخرجات",[f("name","المخرج"),f("type","النوع"),f("description","الوصف","textarea"),f("owner","المالك"),f("status","الحالة")]),
  openSection("reports","إعداد التقرير الدوري",[f("title","التقرير"),f("period","الفترة"),f("responsible","المسؤول"),f("reviewStatus","المراجعة"),f("approvalStatus","الاعتماد")]),
  openSection("correctiveActions","تحديث الإجراءات التصحيحية",[f("issue","الفجوة"),f("action","الإجراء","textarea"),f("responsible","المسؤول"),f("dueDate","الموعد","date"),f("status","الحالة")]),
  openSection("evidence","تجهيز دليل التفعيل",[f("title","وصف الدليل"),f("relatedRecord","السجل المرتبط"),f("notes","ملاحظات","textarea")]),
];
// التصنيف الصريح والحاسم لأنشطة نشر ثقافة الابتكار (بند 3 من المواصفة) — أي
// نشاط لا يحمل أحد هذه الأنواع لا يُحتسب، فلا تُحتسب اجتماعات أو فعاليات عشوائية.
export const CULTURE_ACTIVITY_TYPES=["ورشة تدريبية","لقاء توعوي","برنامج تدريبي","جلسة نقل معرفة","حملة توعوية","فعالية نشر ثقافة الابتكار"] as const;
// دالة حاسمة واحدة تقرر أهلية النشاط — نفس الشرط يُستخدم في العرض والتقدّم
// وفي المزامنة، حتى لا يختلف عدّان مختلفان لعدد الأنشطة المؤهّلة.
export function isQualifyingCultureActivity(row:Record<string,unknown>):boolean{
  return (CULTURE_ACTIVITY_TYPES as readonly string[]).includes(String(row?.cultureType??""))&&Boolean(String(row?.name??"").trim())&&Boolean(String(row?.awarenessGoal??"").trim())&&Boolean(String(row?.targetSegment??"").trim());
}
const CULTURE_CONTRIBUTION_SECTIONS:readonly WorkspaceSection[]=[
  openSection("activityDocumentation","توثيق بيانات النشاط",[f("activityName","النشاط"),f("summary","ملخص التوثيق","textarea"),f("status","الحالة")]),
  openSection("materials","المواد المعرفية والتوعوية",[f("activityName","النشاط"),f("title","اسم المادة"),f("type","النوع"),f("status","الحالة")]),
  openSection("participants","توثيق المشاركين",[f("activityName","النشاط"),f("summary","ملخص المشاركين والحضور","textarea"),f("status","الحالة")]),
  openSection("activityReport","تقرير الإنجاز",[f("activityName","النشاط"),f("summary","ملخص تقرير الإنجاز","textarea"),f("status","الحالة")]),
  openSection("evidence","تجهيز الإثبات",[f("title","وصف الدليل"),f("relatedRecord","النشاط المرتبط"),f("notes","ملاحظات التجهيز","textarea")]),
];

export const REQUIREMENT_WORKSPACES: readonly RequirementWorkspaceConfig[] = [
  { requirementId:"5-23-1-r1", code:"5.23.1.1", explanation:"وثّق مجالات الابتكار وأهدافه الاستراتيجية ومؤشراته كسجلات مستقلة، وبيّن ارتباطها بأهداف الجهة.", sections:[
    {key:"innovationAreas",title:"مجالات الابتكار",repeatable:true,minItems:1,fields:[f("name","اسم المجال"),f("description","الوصف","textarea"),f("rationale","سبب الاختيار","textarea"),f("strategicPriorityLink","الارتباط بالأولويات الاستراتيجية","textarea"),f("ownerEntity","الجهة المالكة"),f("participatingDepartments","الإدارات المشاركة","textarea",false)]},
    {key:"strategicGoals",title:"الأهداف الاستراتيجية للبحث والابتكار",repeatable:true,minItems:1,fields:[f("name","اسم الهدف"),f("description","الوصف","textarea"),f("entityGoalLink","الارتباط بهدف استراتيجي للجهة","textarea"),f("digitalTransformationLink","الارتباط بهدف في استراتيجية التحول الرقمي","textarea"),f("owner","المالك"),f("startDate","تاريخ البداية","date"),f("endDate","تاريخ النهاية","date",false)]},
    {key:"kpis",title:"المؤشرات KPIs",repeatable:true,minItems:1,fields:[f("name","اسم المؤشر"),f("definition","تعريف المؤشر","textarea"),f("calculationMethod","طريقة الحساب","textarea"),f("baseline","Baseline"),f("target","Target"),f("measurementFrequency","دورية القياس"),f("dataSource","مصدر البيانات"),f("owner","مالك المؤشر")]},
    {key:"alignment",title:"المواءمة مع أهداف الجهة",fields:[f("entityAlignment","الارتباط بأهداف الجهة","textarea")]},
  ], evidence:[e("DIGITAL_TRANSFORMATION_STRATEGY","استراتيجية التحول الرقمي المتضمنة للبحث والتطوير والابتكار")] },
  { requirementId:"5-23-1-r2", code:"5.23.1.2", explanation:"وثّق المبادرات والمشروعات المؤسسية الداعمة لاتجاه الابتكار، واربطها بأهداف ومؤشرات المتطلب 01 دون تكرار البيانات المؤسسية.", sections:[
    {key:"initiatives",title:"بيانات المبادرات والمشروعات",repeatable:true,minItems:1,fields:[f("name","اسم المبادرة/المشروع"),f("description","وصف المبادرة","textarea"),f("owningDepartment","الإدارة المالكة"),f("owner","المسؤول"),f("status","الحالة"),f("startDate","تاريخ البداية","date"),f("targetDate","تاريخ النهاية / الموعد المستهدف","date"),f("lastUpdate","آخر تحديث","date")]},
    {key:"strategicAlignment",title:"المواءمة الاستراتيجية",repeatable:true,minItems:1,fields:[f("initiativeName","المبادرة/المشروع"),f("strategicObjective","الهدف الاستراتيجي المرتبط"),f("alignmentReason","سبب الارتباط","textarea")]},
    {key:"initiativeKpis",title:"مؤشرات أداء المبادرات",repeatable:true,minItems:1,fields:[f("initiativeName","المبادرة/المشروع"),f("kpiName","مؤشر الأداء المرتبط"),f("initiativeTarget","مستهدف المبادرة"),f("owner","المسؤول عن القياس")]},
  ], evidence:[e("INITIATIVE_PROJECT_KPI_DOCUMENTS","وثائق المبادرات والمشروعات ومؤشرات الأداء")] },
  { requirementId:"5-23-1-r3", code:"5.23.1.3", explanation:"أنشئ سجل تعاون مؤسسي يوضح الجهة الشريكة ونطاق التعاون وملكيته ومدته، ثم اربطه باتفاقية التعاون وإثباتها دون اعتبار رفع الملف اعتمادًا رسميًا.", sections:[
    {key:"cooperations",title:"علاقات التعاون",repeatable:true,minItems:1,fields:[f("partnerName","اسم الجهة المتعاونة"),f("partnerType","نوع الجهة"),{...f("locationType","محلية / دولية","select"),options:["محلية","دولية"]},f("country","الدولة","text",false),f("description","وصف مختصر","textarea"),f("cooperationField","مجال التعاون"),f("objective","هدف التعاون","textarea"),f("scope","نطاق التعاون","textarea"),f("innovationRelation","علاقته بالبحث والتطوير والابتكار","textarea"),f("owningDepartment","الإدارة المالكة"),f("internalOwner","المسؤول الداخلي"),f("supportingDepartment","جهة/إدارة داعمة","text",false),f("startDate","تاريخ البداية","date"),f("endDate","تاريخ النهاية","date",false),f("status","حالة التعاون"),f("notes","ملاحظات","textarea",false)]},
    {key:"partnerContacts",title:"جهات الاتصال والمسؤولون",repeatable:true,minItems:1,fields:[f("cooperationName","سجل التعاون"),f("name","الاسم"),f("title","المسمى الوظيفي"),f("departmentName","الإدارة / القسم"),f("organization","الجهة"),f("email","البريد الإلكتروني"),f("phone","رقم التواصل","text",false),f("role","دوره في علاقة التعاون"),{...f("isPrimary","جهة الاتصال الرئيسية","select"),options:["نعم","لا"]},f("notes","ملاحظات","textarea",false),{...f("status","حالة جهة الاتصال","select"),options:["نشط","مؤرشف"]}]},
    {key:"agreements",title:"اتفاقية التعاون",repeatable:true,minItems:1,fields:[f("cooperationName","سجل التعاون"),f("title","اسم / عنوان الاتفاقية"),f("referenceNumber","الرقم المرجعي","text",false),f("parties","الأطراف"),f("startDate","تاريخ البداية","date"),f("endDate","تاريخ النهاية","date",false),f("scope","نطاق الاتفاقية","textarea"),f("internalOwner","المالك الداخلي"),f("status","حالة الاتفاقية"),f("currentVersion","الإصدار الحالي")]},
    {key:"cooperationOutputs",title:"مخرجات التعاون",repeatable:true,minItems:1,fields:[f("cooperationName","سجل التعاون"),f("outputType","نوع المخرج"),f("expectedOutput","المخرج المتوقع","textarea"),f("actualOutput","المخرج الفعلي","textarea",false),f("owner","المسؤول"),f("status","الحالة")]},
  ], evidence:[e("APPROVED_COOPERATION_AGREEMENT","اتفاقية تعاون معتمدة مع جهة/مركز/مختبر بحث وتطوير وابتكار")] },
  { requirementId:"5-23-2-r1", code:"5.23.2.1", explanation:"أنشئ الخطة السنوية للأنشطة والفعاليات مع أهداف ومخرجات وفئة مستهدفة وميزانية وجدول ومسؤول وآلية متابعة لكل نشاط.", sections:[{key:"activities",title:"أنشطة الخطة السنوية",repeatable:true,minItems:1,fields:[f("activity","النشاط/الفعالية"),f("objectives","الأهداف","textarea"),f("outputs","المخرجات المتوقعة","textarea"),f("targetAudience","الفئة المستهدفة"),f("budget","الميزانية","text",false),f("timeline","الجدول الزمني"),f("owner","المسؤول"),f("evaluation","آلية المتابعة والتقييم","textarea")]}], evidence:[e("ANNUAL_INNOVATION_PLAN","الخطة السنوية المتكاملة للفعاليات الابتكارية")] },
  { requirementId:"5-23-2-r2", code:"5.23.2.2", explanation:"وثّق تطبيق منهجيات الابتكار ومخرجاتها، بما في ذلك جلستا عصف ذهني على الأقل.", sections:[{key:"application",title:"تطبيق المنهجية",fields:[f("methodology","المنهجية المستخدمة"),f("application","كيفية التطبيق","textarea"),f("participants","المشاركون","textarea"),f("challenges","التحديات المحددة","textarea"),f("solutions","الحلول المقترحة","textarea"),f("prototypes","النماذج الأولية","textarea"),f("prototypeStages","مراحل تطوير النماذج ونتائجها","textarea"),f("projects","المشروعات الناتجة","textarea"),f("kpis","مؤشرات الأداء","textarea"),f("impact","الأثر","textarea")]},{key:"brainstormingSessions",title:"جلسات ومنهجيات الابتكار",repeatable:true,minItems:2,fields:[f("date","تاريخ الجلسة","date"),f("topic","التحدي/الموضوع"),f("methodology","المنهجية المستخدمة"),f("owningDepartment","الإدارة المالكة للتحدي"),f("facilitator","الميسر"),f("participants","المشاركون","textarea"),f("outputs","الأفكار والحلول الناتجة","textarea"),f("decisions","القرارات","textarea",false)]}], evidence:[e("INNOVATION_METHODOLOGY_DOCUMENTS","وثائق تثبت تطبيق أطر ومنهجيات الابتكار")] },
  { requirementId:"5-23-2-r3", code:"5.23.2.3", explanation:"أدر فعاليات الابتكار المفتوح كسجلات تشغيلية مستقلة ومترابطة، ووثّق التحديات والمشاركين والحلول والتحكيم والنماذج والمشروعات والأثر وعينات التوثيق.", sections:[{key:"openInnovationEvents",title:"فعاليات الابتكار المفتوح",repeatable:true,minItems:1,fields:[f("name","اسم الفعالية"),f("type","نوع الفعالية"),f("objective","الهدف","textarea"),f("owner","المالك"),f("department","الإدارة المسؤولة"),f("startDate","تاريخ البداية","date"),f("endDate","تاريخ النهاية","date")]},...OPEN_INNOVATION_CONTRIBUTION_SECTIONS], evidence:[e("OPEN_INNOVATION_DOCUMENTS","وثائق محدثة تثبت تطبيق الابتكار المفتوح")] },
  { requirementId:"5-23-2-r4", code:"5.23.2.4", explanation:"اربط علاقة التعاون والاتفاقية القائمة من 5.23.1، ثم أدر خطة التفعيل والاجتماعات الربع سنوية والالتزامات والمخرجات والتقارير والقرارات والإجراءات التصحيحية لإثبات التفعيل الفعلي.", sections:[{key:"cooperationActivations",title:"مساحات تفعيل التعاون",repeatable:true,minItems:1,fields:[f("cooperationName","علاقة التعاون"),f("agreementTitle","الاتفاقية"),f("owner","المالك"),f("department","الإدارة"),f("status","حالة التفعيل")]},...COOPERATION_ACTIVATION_CONTRIBUTION_SECTIONS], evidence:[e("COOPERATION_ACTIVATION_DOCUMENTS","وثائق تثبت التفعيل الفعلي لاتفاقيات التعاون")] },
  { requirementId:"5-23-3-r1", code:"5.23.3.1", explanation:"شكّل وحدة إدارية أو لجنة (أو أكثر) لتعزيز الابتكار وتبنيه، ووثّق أعضاءها وفئاتهم وأدوارهم ومسؤولياتهم وموقعها التنظيمي وقرار تشكيلها. هذا المتطلب هو مصدر الحقيقة الوحيد لبيانات الوحدة/اللجنة؛ لا يُعاد إنشاؤها في المتطلب 02.", sections:[{key:"structures",title:"وحدات/لجان الابتكار",repeatable:true,minItems:1,fields:[
    f("name","اسم الوحدة/اللجنة"),
    {...f("type","النوع","select"),options:["وحدة","لجنة"]},
    f("purpose","الغرض","textarea"),
    f("mandateDescription","وصف الاختصاص","textarea"),
    f("relatedDepartmentName","الجهة/الإدارة المرتبطة"),
    f("chairName","الرئيس/المسؤول"),
    f("formationDate","تاريخ التشكيل","date"),
    {...f("status","الحالة","select"),options:["مُقترَحة","نشطة","منحلّة"]},
    f("secretaryName","أمين اللجنة","text",false),
    f("operationStartDate","تاريخ بداية العمل","date",false),
    f("meetingFrequency","دورية الاجتماعات","text",false),
    f("notes","ملاحظات","textarea",false),
    f("decisionNumber","رقم قرار التشكيل","text",false),
    f("decisionDate","تاريخ القرار","date",false),
    f("decisionApprovingAuthority","جهة الاعتماد","text",false),
    f("decisionEffectiveDate","تاريخ السريان","date",false),
    f("decisionNotes","ملاحظات القرار","textarea",false),
  ]}], evidence:[e("APPROVED_COMMITTEE_STRUCTURE","هيكل تنظيمي/لجنة معتمد يوضح الأدوار والمسؤوليات")] },
  { requirementId:"5-23-3-r2", code:"5.23.3.2", explanation:"فعِّل الوحدة أو اللجنة (أو أكثر من واحدة) المُشكَّلة في المتطلب 01 عبر اعتماد عملياتها وإجراءاتها وسياساتها، وبالتنسيق مع الإدارات واللجان ذات العلاقة. وثّق المراجعات والقرارات والإجراءات التصحيحية وتقارير الأداء الناتجة، وكل سجل يجب أن يرتبط بواحدة أو أكثر من وحدات/لجان المتطلب 01 — لا يُعاد إنشاء لجان هنا.", sections:[
    {key:"processes",title:"العمليات والإجراءات",repeatable:true,minItems:1,fields:[
      f("name","الاسم"),
      {...f("type","النوع","select"),options:["عملية","إجراء"]},
      f("purpose","الغرض","textarea"),
      f("description","الوصف","textarea"),
      f("owner","المالك"),
      f("department","الإدارة"),
      {...f("approvalStatus","حالة الاعتماد","select"),options:["مسودة","قيد المراجعة","معتمد"]},
      f("stakeholders","الأطراف ذات العلاقة","textarea",false),
      f("inputs","المدخلات","textarea",false),
      f("steps","الخطوات","textarea",false),
      f("outputs","المخرجات","textarea",false),
      f("effectiveDate","تاريخ السريان","date",false),
      f("version","الإصدار","text",false),
      f("notes","ملاحظات","textarea",false),
    ]},
    {key:"policies",title:"السياسات والوثائق",repeatable:true,fields:[
      f("name","الاسم","text",false),
      {...f("recordType","النوع","select",false),options:["سياسة","إجراء","دليل عمل","نموذج","إطار"]},
      f("owner","المالك","text",false),
      f("version","الإصدار","text",false),
      f("effectiveDate","تاريخ السريان","date",false),
      f("reviewDate","تاريخ المراجعة","date",false),
      {...f("approvalStatus","حالة الاعتماد","select",false),options:["مسودة","قيد المراجعة","معتمد"]},
      f("relatedProcessName","العملية/الإجراء المرتبط","text",false),
      f("notes","ملاحظات","textarea",false),
    ]},
    {key:"reviews",title:"المراجعات",repeatable:true,fields:[
      f("subject","الموضوع","text",false),
      f("type","النوع","text",false),
      f("relatedRecord","السجل المرتبط","text",false),
      f("reviewDate","تاريخ العرض","date",false),
      f("requestedBy","مقدم الطلب","text",false),
      f("reviewers","المراجعون","textarea",false),
      f("decision","القرار","textarea",false),
      f("notes","ملاحظات","textarea",false),
      f("nextAction","الإجراء التالي","text",false),
    ]},
    {key:"decisions",title:"القرارات",repeatable:true,fields:[
      f("referenceNumber","رقم/مرجع القرار (إن وجد)","text",false),
      f("subject","الموضوع","text",false),
      f("decisionDate","تاريخ القرار","date",false),
      f("decisionText","القرار","textarea",false),
      f("responsible","المسؤول عن التنفيذ","text",false),
      f("dueDate","الموعد","date",false),
      {...f("status","الحالة","select",false),options:["مفتوح","قيد التنفيذ","منفَّذ","ملغى"]},
      f("linkedRecord","السجل المرتبط","text",false),
      f("notes","ملاحظات","textarea",false),
    ]},
    {key:"correctiveActions",title:"الإجراءات التصحيحية",repeatable:true,fields:[
      f("reason","السبب","textarea",false),
      f("action","الإجراء","textarea",false),
      f("responsible","المسؤول","text",false),
      f("assignedAt","تاريخ الإسناد","date",false),
      f("dueDate","الموعد النهائي","date",false),
      {...f("status","الحالة","select",false),options:["مفتوح","قيد التنفيذ","مكتمل","مغلق"]},
      f("result","النتيجة/الإثبات","textarea",false),
    ]},
    {key:"performanceReports",title:"تقارير الأداء",repeatable:true,fields:[
      f("period","الفترة","text",false),
      f("entity","الجهة/اللجنة","text",false),
      f("scope","نطاق التقرير","textarea",false),
      f("indicators","المؤشرات","textarea",false),
      f("summary","الملخص","textarea",false),
      {...f("status","الحالة","select",false),options:["مسودة","قيد المراجعة","معتمد"]},
    ]},
  ], evidence:[e("COMMITTEE_ACTIVATION_DOCUMENTS","وثائق محدثة تثبت تفعيل الوحدة/اللجنة"),e("APPROVED_GOVERNANCE_POLICY","سياسة/إجراء/دليل عمل/نموذج/إطار حوكمة معتمد")] },
  { requirementId:"5-23-3-r3", code:"5.23.3.3", explanation:"نظِّم أنشطة وفعاليات لنشر ثقافة الابتكار عبر التدريب والتوعية ونقل المعرفة، بالبناء على النشاط القائم في الخطة السنوية للأنشطة (5.23.2.1) أو بإنشاء نشاط جديد عبر البنية التشغيلية المشتركة نفسها — دون إنشاء نظام فعاليات موازٍ. يلزم توثيق 3 أنشطة مؤهّلة على الأقل، كل نشاط بتصنيف ثقافي صريح وتقرير إنجاز مشتق من بياناته الفعلية.", sections:[
    {key:"cultureActivities",title:"الأنشطة المؤهلة لنشر ثقافة الابتكار",repeatable:true,minItems:3,fields:[
      f("name","اسم النشاط"),
      {...f("cultureType","نوع نشاط نشر الثقافة","select"),options:CULTURE_ACTIVITY_TYPES},
      f("awarenessGoal","الهدف التوعوي/التدريبي","textarea"),
      f("targetSegment","الفئة المستهدفة"),
      f("department","الإدارة المسؤولة"),
      f("startDate","تاريخ البداية","date"),
      f("endDate","تاريخ النهاية","date",false),
      {...f("status","الحالة","select"),options:["مخطط لها","قيد التنفيذ","مكتملة","ملغاة"]},
      f("knowledgeTopic","موضوع المعرفة","text",false),
      f("presenter","مقدم/مدرب","text",false),
      f("outcomeDescription","نتيجة التوعية/التعلّم","textarea",false),
    ]},
    ...CULTURE_CONTRIBUTION_SECTIONS,
  ], evidence:[e("CULTURE_ACTIVITY_COMPLETION_REPORTS","تقارير إنجاز حديثة لثلاثة أنشطة أو فعاليات على الأقل",3)] },
  { requirementId:"5-23-3-r4", code:"5.23.3.4", explanation:"وثّق الآلية المعتمدة لإدارة الابتكار الرقمي ودورة حياتها من الفكرة والتصميم إلى التطوير ثم التنفيذ، وسجّل تقدّم كل مبادرة عبر مراحل الرحلة.", sections:[{key:"mechanism",title:"الآلية ودورة الحياة",fields:[f("framework","الآلية/الإطار المعتمد","textarea"),f("ideaDesign","الفكرة والتصميم","textarea"),f("development","التطوير","textarea"),f("implementation","التنفيذ","textarea")]},{key:"lifecycleStages",title:"سجل مراحل رحلة الابتكار",repeatable:true,minItems:1,fields:[f("initiative","المبادرة/الحل"),f("stage","المرحلة الحالية (تحدٍ / فكرة / فرز / تقييم / دراسة جدوى / اعتماد / Prototype / PoC / Pilot / تنفيذ / قياس أثر / توسع واستدامة)"),f("date","تاريخ آخر تحديث للمرحلة","date"),f("owner","المالك"),f("notes","ملاحظات المرحلة","textarea",false)]}], evidence:[e("DIGITAL_INNOVATION_MECHANISM","إطار أو آلية معتمدة لإدارة الابتكار الرقمي")] },
  { requirementId:"5-23-3-r5", code:"5.23.3.5", explanation:"وثّق آلية الاستقبال الآلي للمقترحات والتغذية الراجعة على الحلول المطورة ومصادرها وفئاتها.", sections:[{key:"mechanism",title:"قنوات الاستقبال",fields:[f("proposalReceiving","استقبال المقترحات","textarea"),f("feedbackReceiving","استقبال التغذية الراجعة على الحلول المطورة","textarea"),f("sourceAudience","المصدر/الفئة","textarea",false)]}], evidence:[e("AUTOMATED_PROPOSAL_SCREENSHOTS","لقطات حديثة تثبت الاستقبال الآلي للمقترحات والتغذية الراجعة")] },
] as const;

export function getWorkspaceConfig(requirementId: string) { return REQUIREMENT_WORKSPACES.find((item) => item.requirementId === requirementId); }
export function getRequirementByCode(code: string) { return REQUIREMENT_WORKSPACES.find((item) => item.code === code); }
