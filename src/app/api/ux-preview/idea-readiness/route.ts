import { Output, generateText } from "ai";
import mammoth from "mammoth";
import pdf from "pdf-parse";

import { isUxPreviewMode } from "@/lib/ux-preview";
import { ideaReadinessSchema } from "@/modules/ux-preview/idea-readiness-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_TEXT_LENGTH = 18_000;

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return (await pdf(buffer)).text;
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return (await mammoth.extractRawText({ buffer })).value;
  if (file.type === "text/plain" || name.endsWith(".txt")) return buffer.toString("utf8");
  throw new Error("UNSUPPORTED_FILE");
}

export async function POST(request: Request) {
  if (!isUxPreviewMode()) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "يرجى اختيار ملف الفكرة أو المشروع." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return Response.json({ error: "حجم الملف يتجاوز الحد الأقصى 8 MB." }, { status: 413 });
    const text = (await extractText(file)).replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
    if (text.length < 80) return Response.json({ error: "لم نتمكن من استخراج محتوى كافٍ من الملف." }, { status: 422 });

    const context = {
      submittedTitle: String(form.get("title") ?? ""),
      submittedDepartment: String(form.get("department") ?? ""),
      submittedProblem: String(form.get("problem") ?? ""),
    };
    const model = process.env.AI_READINESS_MODEL || "openai/gpt-6-luna";
    const result = await generateText({
      model,
      output: Output.object({ name: "IdeaReadiness", description: "تقييم أولي منظم لاكتمال ملف فكرة ابتكارية", schema: ideaReadinessSchema }),
      system: "أنت مساعد تحضيري لمنصة ابتكار مؤسسي. استخرج المعلومات المدعومة فقط من مدخلات المستخدم والمستند. اكتب بالعربية. إذا غابت معلومة فاكتب غير مذكور وأضفها للنواقص. قيّم اكتمال العرض وجاهزيته للمراجعة الأولية فقط، ولا تصدر قرار قبول أو رفض ولا تدّعِ اعتمادًا رسميًا. اجعل التوصية إجراءً عمليًا قصيرًا.",
      prompt: `بيانات أدخلها المستخدم:\n${JSON.stringify(context)}\n\nاسم الملف: ${file.name}\n\nنص المستند المستخرج:\n${text}`,
    });
    return Response.json({ result: result.output, model, file: { name: file.name, size: file.size, type: file.type || "unknown" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNSUPPORTED_FILE") return Response.json({ error: "نوع الملف غير مدعوم. استخدم PDF أو DOCX أو TXT." }, { status: 415 });
    console.error("Preview idea readiness analysis failed", error);
    return Response.json({ error: "تعذر إكمال الفحص الآن. تحقق من إعداد اتصال الذكاء الاصطناعي ثم أعد المحاولة." }, { status: 502 });
  }
}
