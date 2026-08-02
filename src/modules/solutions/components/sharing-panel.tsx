"use client";

import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  grantShareAction,
  revokeShareAction,
  addOrganizationAction,
  removeOrganizationAction,
  type SharingActionState,
} from "@/modules/solutions/sharing-actions";

const fieldClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-surface-dark";

const ACTION_LABELS: Record<string, string> = {
  update_fields: "تعديل الحقول",
  "evidence.create": "رفع الأدلة",
  respond_info_request: "الرد على طلب معلومات",
};
const FIELD_LABELS: Record<string, string> = {
  notes: "ملاحظات",
  description: "الوصف",
  technologies: "التقنيات",
  targetBeneficiaries: "الفئة المستفيدة",
  risks: "المخاطر",
};

export interface ShareRow {
  id: string;
  allowedActions: string[];
  allowedFields: string[];
  expiresAt: Date | string | null;
  revokedAt: Date | string | null;
  active: boolean;
  user: { id: string; name: string; email: string };
}
export interface OrgRow {
  id: string;
  nameAr: string;
  type: string;
}

function Feedback({ state }: { state: SharingActionState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-start gap-1.5 text-[12px] text-danger">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-success">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {state.success}
      </p>
    );
  return null;
}
function Pending({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "…" : label}</>;
}

export function SharingPanel({
  solutionId,
  shares,
  partners,
}: {
  solutionId: string;
  shares: ShareRow[];
  partners: { id: string; label: string }[];
}) {
  const [grantState, grant] = useFormState<SharingActionState, FormData>(grantShareAction, {});
  const [revokeState, revoke] = useFormState<SharingActionState, FormData>(revokeShareAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>مشاركة الحل مع شركاء</CardTitle>
        <span className="text-[11.5px] text-muted">قابلة للإلغاء ومسجّلة في السجل</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {shares.length === 0 ? (
          <p className="text-[12.5px] text-muted">لا توجد مشاركات على هذا الحل.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shares.map((s) => (
              <li key={s.id} className="rounded-xl border border-border p-3 dark:border-border-dark">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{s.user.name}</span>
                  <span className="text-[11.5px] text-muted">{s.user.email}</span>
                  <Badge variant={s.active ? "success" : "neutral"}>{s.active ? "سارية" : s.revokedAt ? "ملغاة" : "منتهية"}</Badge>
                  {s.expiresAt && (
                    <span className="text-[11px] text-muted">تنتهي: {new Date(s.expiresAt).toLocaleDateString("ar")}</span>
                  )}
                </div>
                <p className="text-[11.5px] text-muted">
                  الإجراءات: {s.allowedActions.map((a) => ACTION_LABELS[a] ?? a).join("، ") || "—"} · الحقول:{" "}
                  {s.allowedFields.map((f) => FIELD_LABELS[f] ?? f).join("، ") || "—"}
                </p>
                {s.active && (
                  <form
                    action={revoke}
                    className="mt-2"
                    onSubmit={(e) => {
                      if (!confirm("إلغاء هذه المشاركة؟ سيفقد الشريك الوصول فورًا.")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="solutionId" value={solutionId} />
                    <input type="hidden" name="shareId" value={s.id} />
                    <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-[12px] text-danger">
                      <Pending label="إلغاء المشاركة" />
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <Feedback state={revokeState} />

        <form action={grant} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
          <input type="hidden" name="solutionId" value={solutionId} />
          <div className="flex flex-col gap-2">
            <Label className="text-[12px]" htmlFor={`share-user-${solutionId}`}>الشريك</Label>
            <select id={`share-user-${solutionId}`} name="userId" required defaultValue="" className={fieldClass}>
              <option value="" disabled>اختر المستخدم…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">الإجراءات المسموحة</legend>
            {Object.entries(ACTION_LABELS).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                <input type="checkbox" name="allowedActions" value={v} className="h-4 w-4 accent-primary" />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-[12px] font-semibold text-slate-700 dark:text-slate-200">الحقول القابلة للتعديل</legend>
            {Object.entries(FIELD_LABELS).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5 text-[12px] text-slate-600 dark:text-slate-300">
                <input type="checkbox" name="allowedFields" value={v} className="h-4 w-4 accent-primary" />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <Label className="text-[12px]" htmlFor={`share-exp-${solutionId}`}>تاريخ الانتهاء (اختياري)</Label>
            <input id={`share-exp-${solutionId}`} type="date" name="expiresAt" className={fieldClass} />
          </div>
          <div>
            <Button type="submit" size="sm">
              <Pending label="منح المشاركة" />
            </Button>
          </div>
          <Feedback state={grantState} />
        </form>
      </CardContent>
    </Card>
  );
}

export function OrganizationsPanel({
  solutionId,
  organizations,
  available,
  canManage,
}: {
  solutionId: string;
  organizations: OrgRow[];
  available: { id: string; label: string }[];
  canManage: boolean;
}) {
  const [addState, add] = useFormState<SharingActionState, FormData>(addOrganizationAction, {});
  const [removeState, remove] = useFormState<SharingActionState, FormData>(removeOrganizationAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>الجهات المشاركة</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {organizations.length === 0 ? (
          <p className="text-[12.5px] text-muted">لا توجد جهات مشاركة.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {organizations.map((o) => (
              <li key={o.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 dark:border-border-dark">
                <span className="text-[12.5px] text-slate-700 dark:text-slate-200">{o.nameAr}</span>
                {canManage && (
                  <form
                    action={remove}
                    onSubmit={(e) => {
                      if (!confirm("إزالة هذه الجهة؟")) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="solutionId" value={solutionId} />
                    <input type="hidden" name="organizationId" value={o.id} />
                    <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-[12px]">
                      <Pending label="إزالة" />
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <Feedback state={removeState} />

        {canManage && (
          <form action={add} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="solutionId" value={solutionId} />
            <select name="organizationId" required defaultValue="" className={`${fieldClass} max-w-xs`} aria-label="إضافة جهة">
              <option value="" disabled>اختر جهة…</option>
              {available.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <Button type="submit" size="sm" variant="outline">
              <Pending label="إضافة" />
            </Button>
            <Feedback state={addState} />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
