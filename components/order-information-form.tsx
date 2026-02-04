"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface OrderInformationFormProps {
  customerName: string
  setCustomerName: (value: string) => void
  cookingDate: string
  setCookingDate: (value: string) => void
  selectedMealType: string
  setSelectedMealType: (value: string) => void
  cookTime: string
  setCookTime: (value: string) => void
  deliveryType: "Hand in" | "Lalamove"
  setDeliveryType: (value: "Hand in" | "Lalamove") => void
  deliveryPhone: string
  setDeliveryPhone: (value: string) => void
  deliveryAddress: string
  setDeliveryAddress: (value: string) => void
  specialRequests: string
  setSpecialRequests: (value: string) => void
  remarks: string
  setRemarks: (value: string) => void
  errors?: Record<string, string>
  onDateClick?: () => void
  showDatePicker?: boolean
}

export function OrderInformationForm({
  customerName,
  setCustomerName,
  cookingDate,
  setCookingDate,
  selectedMealType,
  setSelectedMealType,
  cookTime,
  setCookTime,
  deliveryType,
  setDeliveryType,
  deliveryPhone,
  setDeliveryPhone,
  deliveryAddress,
  setDeliveryAddress,
  specialRequests,
  setSpecialRequests,
  remarks,
  setRemarks,
  errors = {},
  onDateClick,
}: OrderInformationFormProps) {
  // Format date for display
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString + "T00:00:00")
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return dateString
    }
  }

  // Handle delivery phone input
  const handleDeliveryPhoneChange = (value: string) => {
    let digitsOnly = value.replace(/\D/g, "")

    if (digitsOnly.length > 0) {
      if (digitsOnly.startsWith("9") && digitsOnly.length <= 10) {
        digitsOnly = "0" + digitsOnly
      } else if (digitsOnly.startsWith("0")) {
        if (digitsOnly.length === 1) {
          digitsOnly = "09"
        } else if (!digitsOnly.startsWith("09")) {
          digitsOnly = "09" + digitsOnly.slice(1)
        }
      } else if (!digitsOnly.startsWith("09")) {
        digitsOnly = "09"
      }

      digitsOnly = digitsOnly.slice(0, 11)

      if (digitsOnly.length > 0) {
        let formatted = digitsOnly
        if (digitsOnly.length > 4) {
          formatted = digitsOnly.slice(0, 4) + "-" + digitsOnly.slice(4)
        }
        if (digitsOnly.length > 7) {
          formatted = formatted.slice(0, 8) + "-" + digitsOnly.slice(7)
        }
        setDeliveryPhone(formatted)
      } else {
        setDeliveryPhone("")
      }
    } else {
      setDeliveryPhone("")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Order Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Name */}
        <div className="space-y-2">
          <Label htmlFor="customer-name" className={cn(errors.customerName && "text-destructive")}>
            Customer Name *
          </Label>
          <Input
            id="customer-name"
            placeholder="Enter customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className={cn(errors.customerName && "border-destructive")}
          />
          {errors.customerName && <p className="text-sm text-destructive">{errors.customerName}</p>}
        </div>

        {/* Cooking Date */}
        <div className="space-y-2">
          <Label htmlFor="cooking-date" className={cn(errors.cookingDate && "text-destructive")}>
            Cooking Date *
          </Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDateClick}
              className={cn(
                "flex-1 px-3 py-2 border border-input rounded-md bg-background hover:bg-accent transition-colors text-left flex items-center gap-2",
                errors.cookingDate && "border-destructive"
              )}
            >
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className={!cookingDate ? "text-muted-foreground" : ""}>
                {cookingDate ? formatDateForDisplay(cookingDate) : "Select date"}
              </span>
            </button>
          </div>
          {errors.cookingDate && <p className="text-sm text-destructive">{errors.cookingDate}</p>}
        </div>

        {/* Meal Type Selector */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Meal Type *</Label>
          <div className="flex flex-wrap gap-3">
            {["Breakfast", "Lunch", "Dinner", "Other"].map((meal) => (
              <Button
                key={meal}
                type="button"
                variant={selectedMealType === meal ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMealType(meal)}
                className={cn(
                  "px-4 py-2",
                  selectedMealType === meal && "bg-primary text-primary-foreground"
                )}
              >
                {meal}
              </Button>
            ))}
          </div>
        </div>

        {/* Cook Time (only show for Other meal type) */}
        {selectedMealType === "Other" && (
          <div className="space-y-2">
            <Label htmlFor="cook-time" className={cn(errors.cookTime && "text-destructive")}>
              Cook Time * (Required for Other meal type)
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cook-time"
                  type="time"
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  className={cn("pl-10", errors.cookTime && "border-destructive")}
                />
              </div>
            </div>
            {errors.cookTime && <p className="text-sm text-destructive">{errors.cookTime}</p>}
          </div>
        )}

        {/* Delivery Method */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Delivery:</Label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={deliveryType === "Hand in" ? "default" : "outline"}
              size="sm"
              onClick={() => setDeliveryType("Hand in")}
              className={cn(
                "px-6 py-2 rounded-full",
                deliveryType === "Hand in" && "bg-primary text-primary-foreground"
              )}
            >
              Hand in
            </Button>
            <Button
              type="button"
              variant={deliveryType === "Lalamove" ? "default" : "outline"}
              size="sm"
              onClick={() => setDeliveryType("Lalamove")}
              className={cn(
                "px-6 py-2 rounded-full",
                deliveryType === "Lalamove" && "bg-primary text-primary-foreground"
              )}
            >
              Lalamove
            </Button>
          </div>
        </div>

        {/* Delivery Information (Optional) */}
        <div className="p-4 bg-muted rounded-lg space-y-4 border">
          <p className="text-sm font-semibold">Delivery Information (Optional)</p>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="delivery-phone" className="text-sm">
              Phone Number
            </Label>
            <Input
              id="delivery-phone"
              placeholder="09XX-XXX-XXXX"
              value={deliveryPhone}
              onChange={(e) => handleDeliveryPhoneChange(e.target.value)}
              maxLength={13}
              className={cn(errors.deliveryPhone && "border-destructive")}
            />
            {errors.deliveryPhone && <p className="text-sm text-destructive">{errors.deliveryPhone}</p>}
          </div>

          {/* Delivery Address */}
          <div className="space-y-2">
            <Label htmlFor="delivery-address" className="text-sm">
              Delivery Address
            </Label>
            <textarea
              id="delivery-address"
              placeholder="Enter complete address..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="special-requests" className="text-sm">
              Special Requests
            </Label>
            <textarea
              id="special-requests"
              placeholder="Any special requests..."
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks" className="text-sm">
              Remarks
            </Label>
            <textarea
              id="remarks"
              placeholder="Internal remarks..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
