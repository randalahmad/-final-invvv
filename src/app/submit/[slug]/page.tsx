import { notFound } from "next/navigation";

import { isUxPreviewMode } from "@/lib/ux-preview";
import { PublicIdeaSubmissionPreview } from "@/modules/solutions/components/intake-preview";

export const metadata = { title: "شارك فكرتك أو حلك الابتكاري" };

export default function PublicIdeaSubmissionPage({ params }: { params: { slug: string } }) {
  if (!isUxPreviewMode() || params.slug !== "innovation-ideas") notFound();
  return <PublicIdeaSubmissionPreview />;
}
