"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IMPACT_TYPE_LABELS } from "../schema";
import { saveImpactAction, type ImpactActionState } from "../actions";

function Submit() { const { pending } = useFormStatus(); return <Button disabled={pending}>{pending ? "جارٍ الحفظ…" : "حفظ القياس"}</Button>; }
export function ImpactForm({ solutionId }: { solutionId: string }) {
  const [state, action] = useFormState(saveImpactAction, {} as ImpactActionState);
  return <form action={action} className="grid gap-3 md:grid-cols-2">
    <input type="hidden" name="solutionId" value={solutionId}/>
    <label className="text-xs">اسم المؤشر<Input name="nameAr" required placeholder="مثال: خفض زمن إنجاز الخدمة"/></label>
    <label className="text-xs">نوع الأثر<select name="type" className="mt-1 h-11 w-full rounded-xl border bg-surface px-3">{Object.entries(IMPACT_TYPE_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-xs">وحدة القياس<Input name="unit" placeholder="دقيقة، ريال، %…"/></label>
    <label className="text-xs">منهجية القياس<Input name="measurementMethod" placeholder="كيفية احتساب المؤشر"/></label>
    <label className="text-xs">خط الأساس<Input name="baselineValue" type="number" step="any"/></label>
    <label className="text-xs">القيمة المستهدفة<Input name="targetValue" type="number" step="any"/></label>
    <label className="text-xs">القيمة الفعلية<Input name="actualValue" type="number" step="any"/></label>
    <label className="text-xs">مصدر البيانات<Input name="dataSource" placeholder="النظام أو التقرير المصدر"/></label>
    <label className="text-xs">بداية الفترة<Input name="periodStart" type="date"/></label>
    <label className="text-xs">نهاية الفترة<Input name="periodEnd" type="date"/></label>
    <label className="text-xs md:col-span-2">ملاحظات<Input name="notes"/></label>
    <div className="flex items-center gap-3 md:col-span-2"><Submit/>{state.error && <span className="text-xs text-danger">{state.error}</span>}{state.success && <span className="text-xs text-success">{state.success}</span>}</div>
  </form>;
}
