"use client"

import { Button } from "./button"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

interface MobileTimePickerProps {
  value?: string
  onChange: (time: string) => void
  onClose: () => void
  cookingDate?: string
}

export function MobileTimePicker({ value, onChange, onClose, cookingDate }: MobileTimePickerProps) {
  const [selectedHour, setSelectedHour] = useState(12)
  const [selectedMinute, setSelectedMinute] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM")

  // Initialize with current value if provided
  useEffect(() => {
    if (value) {
      try {
        // Parse 24-hour format (e.g., "13:45")
        const [hour24, minute] = value.split(":").map(Number);
        const period = hour24 >= 12 ? "PM" : "AM";
        const displayHour = hour24 % 12 || 12; // Convert 0 to 12, 13 to 1, etc.
        
        setSelectedHour(displayHour);
        setSelectedMinute(minute);
        setSelectedPeriod(period);
      } catch (error) {
        console.error('Error parsing time:', error);
        // Default to current time if parsing fails
        const now = new Date();
        const hour24 = now.getHours();
        const period = hour24 >= 12 ? 'PM' : 'AM';
        const displayHour = hour24 % 12 || 12;
        
        setSelectedHour(displayHour);
        setSelectedMinute(now.getMinutes());
        setSelectedPeriod(period);
      }
    } else {
      // Default to current time if no value
      const now = new Date();
      const hour24 = now.getHours();
      const period = hour24 >= 12 ? 'PM' : 'AM';
      const displayHour = hour24 % 12 || 12;
      
      setSelectedHour(displayHour);
      setSelectedMinute(now.getMinutes());
      setSelectedPeriod(period);
    }
  }, [value])

  const isTimeInPast = (hour: number, minute: number, period: "AM" | "PM"): boolean => {
    if (!cookingDate) return false
    
    const today = new Date()
    const selectedDate = new Date(cookingDate)
    
    // If selected date is not today, don't restrict time
    if (selectedDate.toDateString() !== today.toDateString()) {
      return false
    }
    
    // Convert to 24-hour format for comparison
    const selectedHour24 = period === "AM" ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
    const currentTimeHours = today.getHours()
    const currentTimeMinutes = today.getMinutes()
    
    // If selected date is today, check if time is in the past
    if (selectedHour24 < currentTimeHours) {
      return true
    } else if (selectedHour24 === currentTimeHours && minute < currentTimeMinutes) {
      return true
    }
    
    return false
  }

  const handleSave = () => {
    try {
      // Convert 12-hour format to 24-hour format
      let hour24 = selectedHour;
      if (selectedPeriod === 'PM' && selectedHour < 12) {
        hour24 = selectedHour + 12;
      } else if (selectedPeriod === 'AM' && selectedHour === 12) {
        hour24 = 0;
      }
      
      // Ensure hour is between 0-23 and minutes between 0-59
      hour24 = hour24 % 24;
      const minute = Math.max(0, Math.min(59, selectedMinute));
      
      // Format as HH:MM (24-hour format for storage)
      const timeString = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      onChange(timeString);
      onClose();
    } catch (error) {
      console.error('Error saving time:', error);
      // Fallback to current time if there's an error
      const now = new Date();
      onChange(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      onClose();
    }
  }

  const hours = Array.from({ length: 12 }, (_, i) => i + 1).filter(hour => !isTimeInPast(hour, selectedMinute, selectedPeriod))
  const minutes = Array.from({ length: 60 }, (_, i) => i).filter(minute => !isTimeInPast(selectedHour, minute, selectedPeriod))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-background w-full max-w-lg rounded-t-2xl shadow-2xl">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Select time</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex justify-center gap-2 mb-6">
            {/* Hours */}
            <div className="flex-1">
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">Hours</div>
              <div className="h-48 overflow-y-auto border rounded-lg snap-y snap-mandatory">
                {hours.map((hour) => (
                  <button
                    key={hour}
                    onClick={() => setSelectedHour(hour)}
                    className={cn(
                      "w-full py-3 text-center snap-center transition-colors",
                      selectedHour === hour && "bg-primary text-primary-foreground font-semibold",
                      !selectedHour && "hover:bg-muted"
                    )}
                  >
                    {hour.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div className="flex-1">
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">Minutes</div>
              <div className="h-48 overflow-y-auto border rounded-lg snap-y snap-mandatory">
                {minutes.map((minute) => (
                  <button
                    key={minute}
                    onClick={() => setSelectedMinute(minute)}
                    className={cn(
                      "w-full py-3 text-center snap-center transition-colors",
                      selectedMinute === minute && "bg-primary text-primary-foreground font-semibold",
                      !selectedMinute && "hover:bg-muted"
                    )}
                  >
                    {minute.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            {/* AM/PM */}
            <div className="flex-1 max-w-20">
              <div className="text-center text-sm font-medium text-muted-foreground mb-2">Period</div>
              <div className="h-48 overflow-y-auto border rounded-lg snap-y snap-mandatory">
                {["AM", "PM"].filter(period => {
                  const isPast = period === "AM" ? isTimeInPast(selectedHour, selectedMinute, "AM" as const) : isTimeInPast(selectedHour, selectedMinute, "PM" as const)
                  return !isPast
                }).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period as "AM" | "PM")}
                    className={cn(
                      "w-full py-3 text-center snap-center transition-colors",
                      selectedPeriod === period && "bg-primary text-primary-foreground font-semibold",
                      !selectedPeriod && "hover:bg-muted"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
