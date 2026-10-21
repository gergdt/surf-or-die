export default function ProgressLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-36 rounded-md bg-muted" />
      <div className="h-4 w-52 rounded-md bg-muted" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/70" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-muted/70" />
      <div className="h-40 rounded-xl bg-muted/70" />
    </div>
  );
}
