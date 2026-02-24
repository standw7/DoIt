"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, addDays, subDays, isToday } from "date-fns";

interface DateSelectorProps {
  date: string;
  onChange: (date: string) => void;
}

export function DateSelector({ date, onChange }: DateSelectorProps) {
  const parsed = parseISO(date);
  const today = isToday(parsed);

  function goBack() {
    onChange(format(subDays(parsed, 1), "yyyy-MM-dd"));
  }

  function goForward() {
    onChange(format(addDays(parsed, 1), "yyyy-MM-dd"));
  }

  function goToday() {
    onChange(format(new Date(), "yyyy-MM-dd"));
  }

  return (
    <div className="relative flex items-center justify-center gap-2">
      <Button variant="ghost" size="icon" onClick={goBack}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[200px]">
            <CalendarDays className="h-4 w-4 mr-2" />
            {format(parsed, "EEEE, MMM d")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))}
          />
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" onClick={goForward}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!today && (
        <Button variant="ghost" size="sm" onClick={goToday} className="absolute left-full ml-2">
          Today
        </Button>
      )}
    </div>
  );
}
