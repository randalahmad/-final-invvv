import { notFound } from "next/navigation";
import { PublicIntakeForm } from "@/modules/dga/components/public-intake-form";
import { getPublicIntake, IntakeError } from "@/modules/dga/intake-service";

export default async function FeedbackIntakePage({ params }: { params: { token: string } }) {
  try {
    const intake = await getPublicIntake(params.token);
    return <PublicIntakeForm intake={intake} />;
  } catch (error) {
    if (error instanceof IntakeError && error.code === "CLOSED") {
      return (
        <main dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
          <p className="max-w-md text-sm leading-7 text-muted">{error.message}</p>
        </main>
      );
    }
    notFound();
  }
}
