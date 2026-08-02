import { Card, CardContent } from "@/components/ui/card";

/**
 * Neutral placeholder for modules whose full UI is not yet built in this phase.
 * Preserves the navigation target without shipping fake data-driven screens.
 */
export function ModulePlaceholder({
  title,
  code,
  description,
}: {
  title: string;
  code?: string;
  description?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        {code && (
          <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-semibold text-primary-700">
            {code}
          </span>
        )}
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">{title}</h2>
        <p className="max-w-md text-sm text-muted">
          {description ?? "هذه الوحدة ضمن نطاق المراحل القادمة — البنية والتنقّل جاهزان."}
        </p>
      </CardContent>
    </Card>
  );
}
