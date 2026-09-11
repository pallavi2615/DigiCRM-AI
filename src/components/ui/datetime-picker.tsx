import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";


// ============================================
// DATE PICKER 
// ============================================
interface DatePickerProps {
  value: string;          // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disablePast?: boolean;
  disableFuture?: boolean;
}

export function DatePicker({ 
  value, onChange, placeholder = "Pick a date", disabled, disablePast, disableFuture 
}: DatePickerProps) {
  const date = value ? new Date(value) : undefined;

  const handleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange("");
      return;
    }
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    onChange(`${year}-${month}-${day}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {date ? format(date, "dd/MM/yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          fromYear={1900}
          toYear={2100}
          captionLayout="dropdown"
          disabled={
            disablePast ? { before: new Date() } :
            disableFuture ? { after: new Date() } :
            undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}


// ============================================
// DATE TIME PICKER 
// ============================================
interface DateTimePickerProps {
  value: string; // ISO string or "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DateTimePicker({ value, onChange, placeholder = "Pick date & time", disabled }: DateTimePickerProps) {
  const date = value ? new Date(value) : undefined;
  const [time, setTime] = React.useState(date ? format(date, "HH:mm") : "09:00");

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange("");
      return;
    }
    // Combine selected date with current time
    const [hours, minutes] = time.split(":").map(Number);
    selectedDate.setHours(hours, minutes, 0, 0);
    onChange(selectedDate.toISOString());
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    if (date) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const updated = new Date(date);
      updated.setHours(hours, minutes, 0, 0);
      onChange(updated.toISOString());
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy 'at' HH:mm") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          initialFocus
          fromYear={1900}   // 4-digit year limit
          toYear={2100}     // 4-digit year limit
          captionLayout="dropdown"  // Month/Year dropdown 
        />
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="time"
              value={time}
              onChange={handleTimeChange}
              className="h-8"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}