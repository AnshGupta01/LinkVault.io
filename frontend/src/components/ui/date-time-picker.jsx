import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function DateTimePicker({ value, onChange }) {
    const [isOpen, setIsOpen] = React.useState(false);

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);

    const handleDateSelect = (selectedDate) => {
        if (selectedDate) {
            // If we have an existing date with time, preserve the time
            if (value) {
                const newDate = new Date(selectedDate);
                newDate.setHours(value.getHours());
                newDate.setMinutes(value.getMinutes());
                onChange(newDate);
            } else {
                // Set default time to current time
                const newDate = new Date(selectedDate);
                const now = new Date();
                newDate.setHours(now.getHours());
                newDate.setMinutes(now.getMinutes());
                onChange(newDate);
            }
        }
    };

    const handleTimeChange = (type, timeValue) => {
        if (value) {
            const newDate = new Date(value);
            if (type === "hour") {
                const currentHours = newDate.getHours();
                const isPM = currentHours >= 12;
                newDate.setHours((parseInt(timeValue) % 12) + (isPM ? 12 : 0));
            } else if (type === "minute") {
                newDate.setMinutes(parseInt(timeValue));
            } else if (type === "ampm") {
                const currentHours = newDate.getHours();
                if (timeValue === "PM" && currentHours < 12) {
                    newDate.setHours(currentHours + 12);
                } else if (timeValue === "AM" && currentHours >= 12) {
                    newDate.setHours(currentHours - 12);
                }
            }
            onChange(newDate);
        } else {
            // If no date selected yet, set to today with the selected time
            const newDate = new Date();
            if (type === "hour") {
                newDate.setHours((parseInt(timeValue) % 12) + (newDate.getHours() >= 12 ? 12 : 0));
            } else if (type === "minute") {
                newDate.setMinutes(parseInt(timeValue));
            }
            onChange(newDate);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !value && "text-slate-400"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value ? (
                        format(value, "MMM dd, yyyy hh:mm aa")
                    ) : (
                        <span>Pick date and time</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="sm:flex">
                    <Calendar
                        mode="single"
                        selected={value}
                        onSelect={handleDateSelect}
                        disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date < today;
                        }}
                        initialFocus
                    />
                    <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x divide-slate-700">
                        <ScrollArea className="w-64 sm:w-auto">
                            <div className="flex sm:flex-col p-2">
                                {hours.map((hour) => (
                                    <Button
                                        key={hour}
                                        size="icon"
                                        variant={
                                            value && value.getHours() % 12 === hour % 12
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="sm:w-full shrink-0 aspect-square"
                                        onClick={() => handleTimeChange("hour", hour.toString())}
                                    >
                                        {hour}
                                    </Button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="sm:hidden" />
                        </ScrollArea>
                        <ScrollArea className="w-64 sm:w-auto">
                            <div className="flex sm:flex-col p-2">
                                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                                    <Button
                                        key={minute}
                                        size="icon"
                                        variant={
                                            value && value.getMinutes() === minute
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="sm:w-full shrink-0 aspect-square"
                                        onClick={() =>
                                            handleTimeChange("minute", minute.toString())
                                        }
                                    >
                                        {minute.toString().padStart(2, '0')}
                                    </Button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="sm:hidden" />
                        </ScrollArea>
                        <ScrollArea className="">
                            <div className="flex sm:flex-col p-2">
                                {["AM", "PM"].map((ampm) => (
                                    <Button
                                        key={ampm}
                                        size="icon"
                                        variant={
                                            value &&
                                                ((ampm === "AM" && value.getHours() < 12) ||
                                                    (ampm === "PM" && value.getHours() >= 12))
                                                ? "default"
                                                : "ghost"
                                        }
                                        className="sm:w-full shrink-0 aspect-square"
                                        onClick={() => handleTimeChange("ampm", ampm)}
                                    >
                                        {ampm}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
