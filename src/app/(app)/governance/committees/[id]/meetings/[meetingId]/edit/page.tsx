import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requirePermission, getAccessContext } from "@/server/authz";
import { isAuthorizationError } from "@/server/authorization";
import { getCommittee } from "@/modules/committees/service";
import { MeetingForm } from "@/modules/committees/components/meeting-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "تعديل المحضر" };

const day = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default async function EditMeetingPage({ params }: { params: { id: string; meetingId: string } }) {
  await requirePermission("committee.meeting.manage");
  const ctx = (await getAccessContext())!;

  let committee;
  try {
    committee = await getCommittee(ctx, params.id);
  } catch (e) {
    if (isAuthorizationError(e) && (e.code === "NOT_FOUND" || e.code === "OUT_OF_SCOPE")) notFound();
    throw e;
  }
  const meeting = committee.meetings.find((m: { id: string }) => m.id === params.meetingId);
  if (!meeting || meeting.archivedAt) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/governance/committees/${committee.id}`} className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-primary">
          <ArrowRight className="h-3.5 w-3.5" />
          العودة إلى {committee.nameAr}
        </Link>
        <h1 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">تعديل محضر {meeting.sequenceNumber}</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <MeetingForm
            mode="edit"
            committeeId={committee.id}
            initial={{
              meetingId: meeting.id,
              meetingDate: day(meeting.meetingDate),
              status: meeting.status,
              agenda: meeting.agenda,
              topicsDiscussed: meeting.topicsDiscussed,
              decisionsAndRecommendations: meeting.decisionsAndRecommendations,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
