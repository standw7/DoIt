import { Clock } from "lucide-react";

export default function SchedulePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground p-6">
      <Clock className="h-12 w-12 mb-4" />
      <h1 className="text-xl font-semibold mb-2">Schedule</h1>
      <p className="text-center max-w-sm">
        Calendar scheduling is coming soon. You&apos;ll be able to schedule your daily tasks into Google Calendar free time.
      </p>
    </div>
  );
}
