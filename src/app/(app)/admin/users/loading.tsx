import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
