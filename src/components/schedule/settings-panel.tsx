"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, Calendar, Check, Loader2, Mail, MapPin } from "lucide-react";
import { formatMinutes } from "@/lib/utils";
import { UserSettingsUpdate } from "@/lib/types";
import { geocodeCity } from "@/lib/weather";
import { toast } from "sonner";

interface SettingsPanelProps {
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  autoAssignEnabled: boolean;
  calendarConnected: boolean;
  digestEnabled: boolean;
  digestCity: string | null;
  digestLatitude: number | null;
  digestLongitude: number | null;
  onUpdate: (updates: UserSettingsUpdate) => Promise<void>;
  onSetupCalendar: () => Promise<string>;
}

export function SettingsPanel({
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  autoAssignEnabled,
  calendarConnected,
  digestEnabled,
  digestCity,
  digestLatitude,
  digestLongitude,
  onUpdate,
  onSetupCalendar,
}: SettingsPanelProps) {
  const [settingUp, setSettingUp] = useState(false);
  const [localStart, setLocalStart] = useState(workingHoursStart);
  const [localEnd, setLocalEnd] = useState(workingHoursEnd);
  const [localBudget, setLocalBudget] = useState(String(dailyBudget));
  const [localCity, setLocalCity] = useState(digestCity ?? "");
  const [verifying, setVerifying] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState<string | null>(
    digestLatitude && digestCity ? `${digestCity} ✓` : null
  );

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

  async function handleVerifyCity() {
    if (!localCity.trim()) return;
    setVerifying(true);
    try {
      const result = await geocodeCity(localCity.trim());
      if (result) {
        await onUpdate({
          digest_city: localCity.trim(),
          digest_latitude: result.latitude,
          digest_longitude: result.longitude,
        });
        setVerifiedLocation(result.displayName);
        toast.success(`Location set to ${result.displayName}`);
      } else {
        toast.error("City not found — try a different name");
      }
    } catch {
      toast.error("Failed to verify city");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDigestToggle(checked: boolean) {
    try {
      await onUpdate({ digest_enabled: checked });
    } catch {
      toast.error("Failed to update setting");
    }
  }

  return (
    <>
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

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Daily Digest
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Get a morning email with your tasks and weather forecast
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="digest-toggle">Send daily digest email</Label>
          <Switch
            id="digest-toggle"
            checked={digestEnabled}
            onCheckedChange={handleDigestToggle}
          />
        </div>

        {digestEnabled && (
          <div className="space-y-2">
            <Label>City for weather</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={localCity}
                  onChange={(e) => {
                    setLocalCity(e.target.value);
                    setVerifiedLocation(null);
                  }}
                  placeholder="e.g. Seattle"
                  className="pl-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerifyCity}
                disabled={verifying || !localCity.trim()}
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            </div>
            {verifiedLocation && (
              <p className="text-xs text-green-600">
                ✓ {verifiedLocation}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
}
