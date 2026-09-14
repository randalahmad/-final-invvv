"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runIdeaAnalysisAction, type IdeaAnalysisActionState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" disabled={pending}>{pending ? "جارٍ التحليل…" : "اطلب تحليل أولي (AI)"}</Button>;
}

export function IdeaAnalysisPanel({ ideaId, suggestion }: { ideaId: string; suggestion: { score: number; flags: unknown; provider: string; model: string; generatedAt: Date } | null }) {
  const [state, formAction] = useFormState<IdeaAnalysisActionState, FormData>(runIdeaAnalysisAction, {});
  const flags = Array.isArray(suggestion?.flags) ? suggestion.flags.filter((flag): flag is string => typeof flag === "string") : [];
  return (
    <Card className="border-primary/30 bg-primary-50/30">
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />تحليل أولي مساعد</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted">اقتراح AI مساعد للمراجع فقط؛ لا يغيّر التقييم أو القرار أو حالة الفكرة، ويستلزم حكمًا بشريًا مستقلًا.</p>
        <form action={formAction}><input type="hidden" name="ideaId" value={ideaId} /><Submit /></form>
        {state.error && <p className="text-xs text-danger">{state.error}</p>}
        {state.success && <p className="text-xs text-success">{state.success}</p>}
        {suggestion && <div className="rounded-xl border border-primary/20 bg-surface p-3 dark:bg-surface-dark"><p className="font-semibold">الدرجة المقترحة: {suggestion.score}/100</p><ul className="mt-2 list-disc space-y-1 pr-5 text-xs text-muted">{flags.map((flag) => <li key={flag}>{flag}</li>)}</ul><p className="mt-2 text-[11px] text-muted">مزود محلي: {suggestion.provider} · {suggestion.model} · {new Date(suggestion.generatedAt).toLocaleString("ar")}</p></div>}
      </CardContent>
    </Card>
  );
}
