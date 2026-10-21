export default function TechniqueLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-56 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted/70" />
        ))}
      </div>
    </div>
  );
}
