"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, Calendar, Check, Loader2 } from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { UserSettingsUpdate } from "@/lib/types";
import { toast } from "sonner";

interface SettingsPanelProps {
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  autoAssignEnabled: boolean;
  calendarConnected: boolean;
  onUpdate: (updates: UserSettingsUpdate) => Promise<void>;
  onSetupCalendar: () => Promise<string>;
}

export function SettingsPanel({
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  autoAssignEnabled,
  calendarConnected,
  onUpdate,
  onSetupCalendar,
}: SettingsPanelProps) {
  const [settingUp, setSettingUp] = useState(false);
  const [localStart, setLocalStart] = useState(workingHoursStart);
  const [localEnd, setLocalEnd] = useState(workingHoursEnd);
  const [localBudget, setLocalBudget] = useState(String(dailyBudget));

  async function commitTime(field: "working_hours_start" | "working_hours_end", value: string) {
    if (!value) return;
    try {
      await onUpdate({ [field]: value });
    } catch {
      toast.error("Failed to update setting");
    }
  }

  async function commitBudget() {
    const minutes = parseInt(localBudget, 10);
    if (isNaN(minutes) || minutes < 30 || minutes > 480) {
      setLocalBudget(String(dailyBudget));
      return;
    }
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
    } catch (err: any) {
      toast.error(err.message || "Failed to connect calendar");
    } finally {
      setSettingUp(false);
    }
  }

  async function handleAutoAssignToggle(checked: boolean) {
    try {
      await onUpdate({ auto_assign_enabled: checked });
    } catch {
      toast.error("Failed to update setting");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working hours */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="work-start">Work starts</Label>
            <Input
              id="work-start"
              type="time"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              onBlur={() => commitTime("working_hours_start", localStart)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="work-end">Work ends</Label>
            <Input
              id="work-end"
              type="time"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              onBlur={() => commitTime("working_hours_end", localEnd)}
            />
          </div>
        </div>

        {/* Daily budget */}
        <div className="space-y-2">
          <Label htmlFor="budget">
            Daily task budget{" "}
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
            value={localBudget}
            onChange={(e) => setLocalBudget(e.target.value)}
            onBlur={commitBudget}
            className="max-w-[200px]"
          />
        </div>

        {/* Auto-assign toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="auto-assign">Auto-assign tasks to days</Label>
            <p className="text-xs text-muted-foreground">
              Automatically assign new tasks to optimal days when no day is chosen
            </p>
          </div>
          <Switch
            id="auto-assign"
            checked={autoAssignEnabled}
            onCheckedChange={handleAutoAssignToggle}
          />
        </div>

        {/* Google Calendar */}
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
            <div>
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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
