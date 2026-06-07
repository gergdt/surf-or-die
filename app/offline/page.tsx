import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-muted p-4 text-muted-foreground">
        <WifiOff className="size-8" />
      </div>
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Your data lives on this device, so most of the app keeps working.
        Reconnect to load anything new.
      </p>
    </div>
  );
}
