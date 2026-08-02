import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
