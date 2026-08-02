import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getCommittee } from "@/modules/committees/service";
import { MeetingForm } from "@/modules/committees/components/meeting-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "توثيق اجتماع" };

export default async function NewMeetingPage({ params }: { params: { id: string } }) {
  await requirePermission("committee.meeting.manage");
  const ctx = (await getAccessContext())!;

  let committee;
  try {
    committee = await getCommittee(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  if (committee.archivedAt) notFound();

  const nextSequence = (committee.meetings.at(-1)?.sequenceNumber ?? 0) + 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/governance/committees/${committee.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى {committee.nameAr}
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">توثيق محضر {nextSequence}</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <MeetingForm mode="create" committeeId={committee.id} sequenceNumber={nextSequence} />
        </CardContent>
      </Card>
    </div>
  );
}
