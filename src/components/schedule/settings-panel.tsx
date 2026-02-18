"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Calendar, Check, Loader2 } from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { toast } from "sonner";

interface SettingsPanelProps {
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  calendarConnected: boolean;
  onUpdate: (updates: Record<string, any>) => Promise<void>;
  onSetupCalendar: () => Promise<string>;
}

export function SettingsPanel({
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  calendarConnected,
  onUpdate,
  onSetupCalendar,
}: SettingsPanelProps) {
  const [settingUp, setSettingUp] = useState(false);

  async function handleTimeChange(field: string, value: string) {
    try {
      await onUpdate({ [field]: value });
    } catch {
      toast.error("Failed to update setting");
    }
  }

  async function handleBudgetChange(value: string) {
    const minutes = parseInt(value, 10);
    if (isNaN(minutes) || minutes < 30 || minutes > 480) return;
    try {
      await onUpdate({ daily_minutes_budget: minutes });
    } catch {
      toast.error("Failed to update budget");
    }
  }

  async function handleSetupCalendar() {
    setSettingUp(true);
    try {
      await onSetupCalendar();
      toast.success("Calendar connected successfully");
    } catch {
      toast.error("Failed to connect calendar");
    } finally {
      setSettingUp(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Schedule Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Working hours start */}
          <div className="space-y-2">
            <Label htmlFor="work-start">Work starts</Label>
            <Input
              id="work-start"
              type="time"
              value={workingHoursStart}
              onChange={(e) =>
                handleTimeChange("working_hours_start", e.target.value)
              }
            />
          </div>

          {/* Working hours end */}
          <div className="space-y-2">
            <Label htmlFor="work-end">Work ends</Label>
            <Input
              id="work-end"
              type="time"
              value={workingHoursEnd}
              onChange={(e) =>
                handleTimeChange("working_hours_end", e.target.value)
              }
            />
          </div>

          {/* Daily task budget */}
          <div className="space-y-2">
            <Label htmlFor="budget">
              Daily budget{" "}
              <span className="text-muted-foreground text-xs">
                ({formatMinutes(dailyBudget)})
              </span>
            </Label>
            <Input
              id="budget"
              type="number"
              min={30}
              max={480}
              step={15}
              value={dailyBudget}
              onChange={(e) => handleBudgetChange(e.target.value)}
            />
          </div>

          {/* Google Calendar connection */}
          <div className="space-y-2">
            <Label>Google Calendar</Label>
            {calendarConnected ? (
              <Badge
                variant="secondary"
                className="flex w-fit items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              >
                <Check className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetupCalendar}
                disabled={settingUp}
              >
                {settingUp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calendar className="mr-2 h-4 w-4" />
                )}
                Connect Calendar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
