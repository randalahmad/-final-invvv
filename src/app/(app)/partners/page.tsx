import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { requirePermission } from "@/server/authz";

export default async function PartnersPage() {
  await requirePermission("agreement.view");
  return (
    <ModulePlaceholder
      title="سجل الجهات والشراكات"
      description="إدارة الشركاء واتفاقيات التعاون والاجتماعات الدورية والمستندات المرتبطة — ضمن المراحل القادمة."
    />
  );
}
