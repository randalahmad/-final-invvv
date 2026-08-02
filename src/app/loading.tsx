export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg dark:bg-bg-dark">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted">جارٍ التحميل…</p>
      </div>
    </div>
  );
}
