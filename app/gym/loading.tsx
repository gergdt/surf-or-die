export default function GymLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-64 rounded-md bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted/70" />
        ))}
      </div>
    </div>
  );
}
