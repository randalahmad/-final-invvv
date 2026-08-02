import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}
