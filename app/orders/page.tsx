"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Plus, ChevronLeft, ChevronRight, X, Trash2, RotateCcw, ChevronDown, ChevronUp, Search } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getOrders, deleteOrder } from "@/lib/orders"
import { Pagination } from "@/components/pagination"

// Helper function to convert 24-hour time to 12-hour format
const formatTimeForDisplay = (time24: string): string => {
  if (!time24) return ""
  
  try {
    const [hour24, minute] = time24.split(":").map(Number)
    const period = hour24 >= 12 ? "PM" : "AM"
    const displayHour = hour24 % 12 || 12 // Convert 0 to 12, 13 to 1, etc.
    
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  } catch (error) {
    return time24 // Fallback to original format if parsing fails
  }
}

type Order = {
  id: string
  orderNumber: string
  customerName: string
  date: string
  createdAt?: string
  items: { id: string; name: string; price: number; quantity: number }[]
  total: number
  paymentStatus: "paid" | "not-paid"
  paymentMethod?: "cash" | "gcash"
  gcashPhone?: string
  gcashReference?: string
  specialRequests?: string
  remarks?: string
  mealType?: string
  originalMealType?: string
  cookTime?: string
  isPreparedOrder?: boolean
}

export default function OrdersPage() {
  const [orderType, setOrderType] = useState<"today" | "advanced">("today")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [mounted, setMounted] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [showUndoPaymentModal, setShowUndoPaymentModal] = useState(false)
  const [orderToUndoPayment, setOrderToUndoPayment] = useState<Order | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid-cash" | "paid-gcash" | "unpaid">("all")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash")
  const [amountGiven, setAmountGiven] = useState("")
  const [gcashPhone, setGcashPhone] = useState("")
  const [gcashReference, setGcashReference] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 4
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [mealTypeFilter, setMealTypeFilter] = useState<"all" | "breakfast" | "lunch" | "dinner" | "other">("all")
  const [isPaymentSummaryCollapsed, setIsPaymentSummaryCollapsed] = useState(true)
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false)
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showGcashQrModal, setShowGcashQrModal] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle body scroll when modals are open
  useEffect(() => {
    const isAnyModalOpen = showPaymentModal || showOrderDetailsModal || showDeleteModal || showUndoPaymentModal
    
    const preventScroll = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
    
    const preventKeyScroll = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }
    
    if (isAnyModalOpen) {
      // Disable body scroll - more comprehensive approach
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      
      // Also prevent scroll on html element
      document.documentElement.style.position = 'fixed'
      document.documentElement.style.top = `-${scrollY}px`
      document.documentElement.style.overflow = 'hidden'
      
      // Add global event listeners
      window.addEventListener('wheel', preventScroll, { passive: false })
      window.addEventListener('touchmove', preventScroll, { passive: false })
      window.addEventListener('keydown', preventKeyScroll)
      window.addEventListener('scroll', preventScroll, { passive: false })
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      document.documentElement.style.position = ''
      document.documentElement.style.top = ''
      document.documentElement.style.overflow = ''
      
      if (scrollY) {
        const top = parseInt(scrollY || '0', 10) * -1
        window.scrollTo(0, top)
      }
      
      // Remove global event listeners
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
      window.removeEventListener('keydown', preventKeyScroll)
      window.removeEventListener('scroll', preventScroll)
    }
    
    return () => {
      // Always restore on cleanup
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      document.documentElement.style.position = ''
      document.documentElement.style.top = ''
      document.documentElement.style.overflow = ''
      
      // Remove event listeners on cleanup
      window.removeEventListener('wheel', preventScroll)
      window.removeEventListener('touchmove', preventScroll)
      window.removeEventListener('keydown', preventKeyScroll)
      window.removeEventListener('scroll', preventScroll)
    }
  }, [showPaymentModal, showOrderDetailsModal, showDeleteModal, showUndoPaymentModal])

  // Helper function to create items summary
  const createItemsSummary = (items: { id: string; name: string; price: number; quantity: number }[]) => {
    if (items.length <= 2) {
      return items.map(item => `${item.quantity}x ${item.name}`).join(', ')
    }
    
    const firstTwo = items.slice(0, 2).map(item => `${item.quantity}x ${item.name}`).join(', ')
    const remainingCount = items.length - 2
    return `${firstTwo}, ... ${remainingCount} more`
  }

  useEffect(() => {
    if (!mounted) return
    
    const loadOrders = () => {
      // Get regular orders
      const regularOrders = getOrders()
      
      // Only include regular orders (not converted prepared orders since they're already in regularOrders)
      setOrders(regularOrders)
    }

    loadOrders()
    window.addEventListener("orders-updated", loadOrders)
    window.addEventListener("prepared-orders-updated", loadOrders)
    return () => {
      window.removeEventListener("orders-updated", loadOrders)
      window.removeEventListener("prepared-orders-updated", loadOrders)
    }
  }, [mounted])

  // Auto-fill amount given with order total when payment method is cash
  useEffect(() => {
    if (showPaymentModal && selectedOrder && paymentMethod === "cash") {
      setAmountGiven(selectedOrder.total.toString())
    }
  }, [showPaymentModal, selectedOrder, paymentMethod])

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayOfMonth = getFirstDayOfMonth(currentDate)
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const calendarDays = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i)
  }

  const displayDate = mounted ? new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }) : ""

  const getOrderCountForDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    return orders.filter((order) => {
      const orderDate = new Date(order.date)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.toDateString() === date.toDateString()
    }).length
  }

  const handleDateClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(date)
    setCurrentPage(1)
  }

  const handleDateDoubleClick = () => {
    setSelectedDate(null)
    setOrderType("today")
    setCurrentPage(1)
  }

  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.date)
    orderDate.setHours(0, 0, 0, 0)

    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      const matchesOrderNumber = order.orderNumber?.toLowerCase().includes(query)
      const matchesCustomerName = order.customerName?.toLowerCase().includes(query)
      const matchesItems = order.items.some(item => 
        item.name.toLowerCase().includes(query)
      )
      
      if (!matchesOrderNumber && !matchesCustomerName && !matchesItems) {
        return false
      }
    }

    // Apply payment filter
    if (paymentFilter === "paid-cash" && (order.paymentStatus !== "paid" || order.paymentMethod !== "cash")) {
      return false
    }
    if (paymentFilter === "paid-gcash" && (order.paymentStatus !== "paid" || order.paymentMethod !== "gcash")) {
      return false
    }
    if (paymentFilter === "unpaid" && order.paymentStatus !== "not-paid") {
      return false
    }

    // Apply meal type filter
    if (mealTypeFilter !== "all") {
      const matchesMealType = order.mealType?.toLowerCase() === mealTypeFilter
      const matchesOriginalMealType = order.originalMealType?.toLowerCase() === mealTypeFilter
      if (!matchesMealType && !matchesOriginalMealType) {
        return false
      }
    }

    // Then apply date filter
    if (selectedDate) {
      const selected = new Date(selectedDate)
      selected.setHours(0, 0, 0, 0)
      return orderDate.toDateString() === selected.toDateString()
    }

    const todayDate = mounted ? new Date() : new Date(0)
    todayDate.setHours(0, 0, 0, 0)

    if (orderType === "today") {
      return orderDate.toDateString() === todayDate.toDateString()
    } else if (orderType === "advanced") {
      return orderDate > todayDate
    } else {
      // Default to today's orders only
      return orderDate.toDateString() === todayDate.toDateString()
    }
  }).sort((a, b) => {
    // Sort by payment status: unpaid orders first, then paid orders
    if (a.paymentStatus === "not-paid" && b.paymentStatus === "paid") {
      return -1
    }
    if (a.paymentStatus === "paid" && b.paymentStatus === "not-paid") {
      return 1
    }
    // If same payment status, sort by date (newest first)
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const paymentSummary = filteredOrders.reduce(
    (acc, order) => {
      acc.total += order.total
      if (order.paymentStatus === "paid") {
        if (order.paymentMethod === 'gcash') {
          acc.paidGcash += order.total
        } else {
          acc.paidCash += order.total
        }
        acc.paidTotal = acc.paidCash + acc.paidGcash
      } else {
        acc.unpaid += order.total
      }
      return acc
    },
    { paidCash: 0, paidGcash: 0, unpaid: 0, paidTotal: 0, total: 0 },
  )

  const clearPaymentFilter = () => {
    setPaymentFilter("all")
  }

  const getMealTypeCounts = () => {
    const targetDate = selectedDate || (mounted ? new Date() : new Date(0))
    targetDate.setHours(0, 0, 0, 0)
    
    const dayOrders = orders.filter((order) => {
      const orderDate = new Date(order.date)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.toDateString() === targetDate.toDateString()
    })

    return {
      breakfast: dayOrders.filter(order => 
        order.mealType?.toLowerCase() === 'breakfast' || 
        order.originalMealType?.toLowerCase() === 'breakfast'
      ).length,
      lunch: dayOrders.filter(order => 
        order.mealType?.toLowerCase() === 'lunch' || 
        order.originalMealType?.toLowerCase() === 'lunch'
      ).length,
      dinner: dayOrders.filter(order => 
        order.mealType?.toLowerCase() === 'dinner' || 
        order.originalMealType?.toLowerCase() === 'dinner'
      ).length,
      other: dayOrders.filter(order => 
        order.mealType?.toLowerCase() === 'other' || 
        order.originalMealType?.toLowerCase() === 'other'
      ).length,
    }
  }

  const mealTypeCounts = getMealTypeCounts()

  const clearMealTypeFilter = () => {
    setMealTypeFilter("all")
  }

  const getPaymentFilterLabel = () => {
    switch (paymentFilter) {
      case "paid-cash":
        return "Paid Cash Orders"
      case "paid-gcash":
        return "Paid GCash Orders"
      case "unpaid":
        return "Unpaid Orders"
      default:
        return "All Orders"
    }
  }

  const getMealTypeFilterLabel = () => {
    switch (mealTypeFilter) {
      case "breakfast":
        return "Breakfast Orders"
      case "lunch":
        return "Lunch Orders"
      case "dinner":
        return "Dinner Orders"
      case "other":
        return "Other Orders"
      default:
        return "All Meal Types"
    }
  }

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [orderType, mealTypeFilter])

  const handlePayOrder = () => {
    if (!selectedOrder) return

    const newErrors: Record<string, string> = {}
    const orderTotal = selectedOrder.total
    const amountGivenNum = Number.parseFloat(amountGiven) || 0

    if (paymentMethod === "cash") {
      if (!amountGiven || amountGivenNum <= 0) {
        newErrors.amountGiven = "Amount given is required"
      } else if (amountGivenNum < orderTotal) {
        newErrors.amountGiven = "Amount given must be greater than or equal to total"
      }
    } else if (paymentMethod === "gcash") {
      const phoneRegex = /^(09|\+639)\d{9}$/
      if (gcashPhone.trim() && !phoneRegex.test(gcashPhone.replace(/[-\s]/g, ""))) {
        newErrors.gcashPhone = "Invalid phone number format"
      }

      if (gcashReference.trim() && gcashReference.length < 10) {
        newErrors.gcashReference = "Reference number must be at least 10 characters if provided"
      }
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const updatedOrders = orders.map((order) =>
      order.id === selectedOrder.id 
        ? { 
            ...order, 
            paymentStatus: "paid" as const,
            paymentMethod: paymentMethod, // Include the payment method
            gcashPhone: paymentMethod === "gcash" ? gcashPhone : undefined,
            gcashReference: paymentMethod === "gcash" ? gcashReference : undefined
          } 
        : order,
    )

    localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))
    window.dispatchEvent(new Event("orders-updated"))

    setShowPaymentModal(false)
    setSelectedOrder(null)
    setAmountGiven("")
    setGcashPhone("")
    setGcashReference("")
    setErrors({})
  }

  const handleDeleteOrder = () => {
    if (!orderToDelete) return
    
    deleteOrder(orderToDelete.id)
    setShowDeleteModal(false)
    setOrderToDelete(null)
  }

  const openDeleteModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    setOrderToDelete(order)
    setShowDeleteModal(true)
  }

  const openUndoPaymentModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation()
    setOrderToUndoPayment(order)
    setShowUndoPaymentModal(true)
  }

  const handleUndoPayment = () => {
    if (!orderToUndoPayment) return
    
    const updatedOrders = orders.map((order) =>
      order.id === orderToUndoPayment.id ? { ...order, paymentStatus: "not-paid" as const } : order,
    )

    localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))
    window.dispatchEvent(new Event("orders-updated"))
    
    setShowUndoPaymentModal(false)
    setOrderToUndoPayment(null)
  }

  const handleGcashPhoneChange = (value: string) => {
    // Remove all non-digit characters
    let digitsOnly = value.replace(/\D/g, '')
    
    // Ensure it starts with 09 and limit to 11 digits
    if (digitsOnly.length > 0) {
      // If user starts with 9, prepend 0
      if (digitsOnly.startsWith('9') && digitsOnly.length <= 10) {
        digitsOnly = '0' + digitsOnly
      }
      // If user starts with 0, ensure next digit is 9
      else if (digitsOnly.startsWith('0')) {
        if (digitsOnly.length === 1) {
          digitsOnly = '09'
        } else if (!digitsOnly.startsWith('09')) {
          digitsOnly = '09' + digitsOnly.slice(1)
        }
      }
      // If user starts with other digits, replace with 09
      else if (!digitsOnly.startsWith('09')) {
        digitsOnly = '09'
      }
      
      // Limit to 11 digits
      digitsOnly = digitsOnly.slice(0, 11)
      
      // Format with dashes: 09XXX-XXX-XXX
      if (digitsOnly.length > 0) {
        let formatted = digitsOnly
        if (digitsOnly.length > 4) {
          formatted = digitsOnly.slice(0, 4) + '-' + digitsOnly.slice(4)
        }
        if (digitsOnly.length > 7) {
          formatted = formatted.slice(0, 8) + '-' + digitsOnly.slice(7)
        }
        setGcashPhone(formatted)
      } else {
        setGcashPhone('')
      }
    } else {
      setGcashPhone('')
    }
    
    setErrors((prev) => ({ ...prev, gcashPhone: "" }))
  }

  const handleGcashPaymentDone = () => {
    // Just close the QR modal, don't auto-fill anything
    setShowGcashQrModal(false)
  }


  const openOrderDetailsModal = (order: Order) => {
    setSelectedOrderForDetails(order)
    setShowOrderDetailsModal(true)
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Orders</h1>
              <p className="text-muted-foreground mt-1">{displayDate}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                <Link href="/new-order">
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Link>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Meal Type:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={mealTypeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMealTypeFilter('all')}
                className="min-w-[100px]"
              >
                All
              </Button>
              <Button
                variant={mealTypeFilter === 'breakfast' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMealTypeFilter('breakfast')}
                className="min-w-[100px]"
              >
                Breakfast
              </Button>
              <Button
                variant={mealTypeFilter === 'lunch' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMealTypeFilter('lunch')}
                className="min-w-[100px]"
              >
                Lunch
              </Button>
              <Button
                variant={mealTypeFilter === 'dinner' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMealTypeFilter('dinner')}
                className="min-w-[100px]"
              >
                Dinner
              </Button>
              <Button
                variant={mealTypeFilter === 'other' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMealTypeFilter('other')}
                className="min-w-[100px]"
              >
                Other
              </Button>
            </div>
          </div>
        </div>

        {/* Meal Type Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <div 
            className={`rounded-lg p-2 sm:p-3 text-center cursor-pointer transition-colors ${mealTypeFilter === 'all' ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            onClick={() => setMealTypeFilter('all')}
          >
            <p className={`text-xs sm:text-sm ${mealTypeFilter === 'all' ? 'text-white' : 'text-primary'}`}>Total</p>
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${mealTypeFilter === 'all' ? 'text-white' : 'text-primary'}`}>
              {mealTypeCounts.breakfast + mealTypeCounts.lunch + mealTypeCounts.dinner + mealTypeCounts.other}
            </p>
          </div>
          <div 
            className={`rounded-lg p-2 sm:p-3 text-center cursor-pointer transition-colors ${mealTypeFilter === 'breakfast' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
            onClick={() => setMealTypeFilter('breakfast')}
          >
            <p className={`text-xs sm:text-sm ${mealTypeFilter === 'breakfast' ? 'text-white' : 'text-orange-700'}`}>Breakfast</p>
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${mealTypeFilter === 'breakfast' ? 'text-white' : 'text-orange-700'}`}>
              {mealTypeCounts.breakfast}
            </p>
          </div>
          <div 
            className={`rounded-lg p-2 sm:p-3 text-center cursor-pointer transition-colors ${mealTypeFilter === 'lunch' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            onClick={() => setMealTypeFilter('lunch')}
          >
            <p className={`text-xs sm:text-sm ${mealTypeFilter === 'lunch' ? 'text-white' : 'text-blue-700'}`}>Lunch</p>
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${mealTypeFilter === 'lunch' ? 'text-white' : 'text-blue-700'}`}>
              {mealTypeCounts.lunch}
            </p>
          </div>
          <div 
            className={`rounded-lg p-2 sm:p-3 text-center cursor-pointer transition-colors ${mealTypeFilter === 'dinner' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
            onClick={() => setMealTypeFilter('dinner')}
          >
            <p className={`text-xs sm:text-sm ${mealTypeFilter === 'dinner' ? 'text-white' : 'text-purple-700'}`}>Dinner</p>
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${mealTypeFilter === 'dinner' ? 'text-white' : 'text-purple-700'}`}>
              {mealTypeCounts.dinner}
            </p>
          </div>
          <div 
            className={`rounded-lg p-2 sm:p-3 text-center cursor-pointer transition-colors ${mealTypeFilter === 'other' ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-700 hover:bg-teal-200'}`}
            onClick={() => setMealTypeFilter('other')}
          >
            <p className={`text-xs sm:text-sm ${mealTypeFilter === 'other' ? 'text-white' : 'text-teal-700'}`}>Other</p>
            <p className={`text-xl sm:text-2xl md:text-3xl font-bold ${mealTypeFilter === 'other' ? 'text-white' : 'text-teal-700'}`}>
              {mealTypeCounts.other}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Calendar
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={previousMonth} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{monthName}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                      <div key={idx} className="text-center text-xs font-medium text-muted-foreground p-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                      const today = mounted ? new Date() : new Date(0) // Use epoch date on server
                      const isToday =
                        mounted &&
                        day === today.getDate() &&
                        currentDate.getMonth() === today.getMonth() &&
                        currentDate.getFullYear() === today.getFullYear()

                      const isSelected =
                        selectedDate &&
                        day === selectedDate.getDate() &&
                        currentDate.getMonth() === selectedDate.getMonth() &&
                        currentDate.getFullYear() === selectedDate.getFullYear()

                      const orderCount = day ? getOrderCountForDate(day) : 0

                      return (
                        <button
                          key={idx}
                          onClick={() => day && handleDateClick(day)}
                          onDoubleClick={handleDateDoubleClick}
                          className={cn(
                            "aspect-square p-1 text-sm rounded-md transition-colors relative",
                            day && "hover:bg-muted",
                            isToday && "bg-primary text-primary-foreground font-bold",
                            isSelected && "ring-2 ring-primary ring-offset-2",
                            !day && "invisible",
                          )}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{day}</span>
                            {orderCount > 0 && (
                              <span
                                className={cn(
                                  "absolute bottom-0 right-0 text-[8px] font-bold px-1 rounded-tl rounded-br bg-red-500 text-white",
                                  isToday && "bg-white text-primary",
                                )}
                              >
                                {orderCount}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Summary - Correct position below calendar */}
            <Card className={cn(
              "transition-all duration-300",
              isPaymentSummaryCollapsed ? "lg:mb-6" : ""
            )}>
              <CardHeader className={cn(
                "pb-3 transition-all duration-300",
                isPaymentSummaryCollapsed ? "pb-0 lg:pb-3" : ""
              )}>
                <div className="flex items-center justify-between">
                  <CardTitle>Payment Summary</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPaymentSummaryCollapsed(!isPaymentSummaryCollapsed)}
                    className="lg:hidden h-8 w-8 p-0"
                  >
                    {isPaymentSummaryCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={cn(
                "space-y-3 transition-all duration-300",
                isPaymentSummaryCollapsed ? "max-h-0 overflow-hidden opacity-0 p-0 lg:max-h-none lg:overflow-visible lg:opacity-100 lg:p-6" : "opacity-100"
              )}>
                {(paymentFilter === 'all' || paymentFilter === 'paid-cash' || paymentSummary.paidCash > 0) && (
                  <div 
                    className={cn(
                      "flex flex-col p-3 rounded-lg border cursor-pointer",
                      paymentFilter === "paid-cash" 
                        ? "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700" 
                        : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900"
                    )}
                    onClick={() => setPaymentFilter(paymentFilter === "paid-cash" ? "all" : "paid-cash")}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Paid (Cash)</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ₱{paymentSummary.paidCash.toFixed(2)}
                      </span>
                    </div>
                    {paymentFilter === "paid-cash" && (
                      <div className="mt-1 text-xs text-green-700 dark:text-green-300 font-medium">
                        {orders.filter(o => o.paymentStatus === 'paid' && o.paymentMethod === 'cash').length} orders • Total: ₱{paymentSummary.paidCash.toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
                {(paymentFilter === 'all' || paymentFilter === 'paid-gcash' || paymentSummary.paidGcash > 0) && (
                  <div 
                    className={cn(
                      "flex flex-col p-3 rounded-lg border cursor-pointer",
                      paymentFilter === "paid-gcash" 
                        ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700" 
                        : "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900"
                    )}
                    onClick={() => setPaymentFilter(paymentFilter === "paid-gcash" ? "all" : "paid-gcash")}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Paid (GCash)</span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        ₱{paymentSummary.paidGcash.toFixed(2)}
                      </span>
                    </div>
                    {paymentFilter === "paid-gcash" && (
                      <div className="mt-1 text-xs text-blue-700 dark:text-blue-300 font-medium">
                        {orders.filter(o => o.paymentStatus === 'paid' && o.paymentMethod === 'gcash').length} orders • Total: ₱{paymentSummary.paidGcash.toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
                {(paymentFilter === 'all' || paymentFilter === 'unpaid' || paymentSummary.unpaid > 0) && (
                  <div 
                    className={cn(
                      "flex flex-col p-3 rounded-lg border cursor-pointer",
                      paymentFilter === "unpaid" 
                        ? "bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700" 
                        : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900"
                    )}
                    onClick={() => setPaymentFilter(paymentFilter === "unpaid" ? "all" : "unpaid")}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Unpaid</span>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        ₱{paymentSummary.unpaid.toFixed(2)}
                      </span>
                    </div>
                    {paymentFilter === "unpaid" && (
                      <div className="mt-1 text-xs text-red-700 dark:text-red-300 font-medium">
                        {orders.filter(o => o.paymentStatus === 'not-paid').length} orders • Total: ₱{paymentSummary.unpaid.toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
                {paymentFilter === 'all' && (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-green-100 dark:bg-green-900/50 rounded-lg border-2 border-green-300 dark:border-green-700">
                        <span className="text-sm font-bold text-green-800 dark:text-green-200">Paid Total</span>
                        <span className="text-xl font-bold text-green-700 dark:text-green-300">
                          ₱{paymentSummary.paidTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border-2 border-primary">
                        <span className="text-sm font-bold text-primary dark:text-primary-foreground">Overall Total</span>
                        <span className="text-xl font-bold text-primary dark:text-primary-foreground">
                          ₱{paymentSummary.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-1">
                      Paid Total: Cash + GCash | Overall Total: All Orders
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order number, customer name, or items..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1) // Reset to first page when searching
                    }}
                    className="pl-10 pr-20"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("")
                        setCurrentPage(1)
                      }}
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle>Orders List</CardTitle>
                  {selectedDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedDate.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {searchQuery && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Searching: <span className="font-medium text-primary">"{searchQuery}"</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("")
                          setCurrentPage(1)
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  {paymentFilter !== "all" && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Filtering: <span className="font-medium text-primary">{getPaymentFilterLabel()}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearPaymentFilter}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                  {mealTypeFilter !== "all" && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Meal Type: <span className="font-medium text-primary">{getMealTypeFilterLabel()}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearMealTypeFilter}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {selectedDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDate(null)
                        setOrderType("advanced")
                      }}
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      View Advanced Orders
                    </Button>
                  )}
                  <Button
                    variant={orderType === "today" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setOrderType("today")
                      setSelectedDate(null)
                    }}
                    className={cn(orderType === "today" && "bg-primary")}
                  >
                    Orders Today
                  </Button>
                  <Button
                    variant={orderType === "advanced" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setOrderType("advanced")
                      setSelectedDate(null)
                    }}
                    className={cn(orderType === "advanced" && "bg-primary")}
                  >
                    Advanced Orders
                  </Button>
                </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? "No matching orders found" : "No orders yet"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {searchQuery 
                      ? `No orders match your search for "${searchQuery}". Try different keywords or clear the search.`
                      : orderType === "today" 
                        ? "No orders have been placed today." 
                        : "No advanced orders scheduled."
                    }
                  </p>
                  {searchQuery ? (
                    <Button
                      onClick={() => {
                        setSearchQuery("")
                        setCurrentPage(1)
                      }}
                      variant="outline"
                    >
                      Clear Search
                    </Button>
                  ) : (
                    <Button asChild className="bg-primary hover:bg-primary/90">
                      <Link href="/new-order">
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Order
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {paginatedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer"
                        onClick={() => openOrderDetailsModal(order)}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{order.customerName}</h3>
                              <Badge variant="outline" className="text-xs font-mono">
                                {order.orderNumber || `ID: ${order.id}`}
                              </Badge>
                              {order.isPreparedOrder && (
                                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                                  PREPARED ORDER
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.date).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            {order.createdAt && (
                              <p className="text-xs text-muted-foreground">
                                Ordered at: {new Date(order.createdAt).toLocaleString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric"
                                }).replace(',', ' -')}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-1">
                              {/* Show original 'Other' selection */}
                              <Badge variant="outline" className="text-xs">
                                {order.originalMealType || order.mealType || 'Meal'}
                              </Badge>
                              
                              {/* Show determined meal type if different from original */}
                              {order.originalMealType === "Other" && order.mealType && order.mealType !== "Other" && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  {order.mealType}
                                </Badge>
                              )}
                              
                              {/* Show cook time if available */}
                              {order.cookTime && (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                  🕒 {formatTimeForDisplay(order.cookTime)}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              variant={order.paymentStatus === "paid" ? "default" : "destructive"}
                              className={cn(
                                order.paymentStatus === "paid" && order.paymentMethod === "cash" && "bg-green-600 hover:bg-green-600/90",
                                order.paymentStatus === "paid" && order.paymentMethod === "gcash" && "bg-blue-600 hover:bg-blue-600/90",
                                order.paymentStatus !== "paid" && "bg-destructive"
                              )}
                            >
                              {order.paymentStatus === "paid" 
                                ? order.paymentMethod === "gcash" 
                                  ? "PAID - GCASH" 
                                  : "PAID - CASH"
                                : 'UNPAID'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => openDeleteModal(e, order)}
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Order"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Summarized items view */}
                        <div className="text-sm text-muted-foreground mb-3">
                          {createItemsSummary(order.items)}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t">
                          <span className="font-bold">Total</span>
                          <span className="text-lg font-bold text-primary">₱{order.total.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-6">
                      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {showPaymentModal && selectedOrder && (
          <div 
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              width: '100vw',
              height: '100vh',
              maxWidth: '100vw',
              minWidth: '100vw',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Process Payment</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowPaymentModal(false)
                      setErrors({})
                      setShowOrderDetailsModal(true)
                      setSelectedOrderForDetails(selectedOrder)
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Order for {selectedOrder.customerName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Amount</span>
                    <span className="text-2xl font-bold text-primary">₱{selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Payment Method</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={paymentMethod === "cash" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("cash")}
                      className={cn("flex-1", paymentMethod === "cash" && "bg-primary")}
                    >
                      Cash
                    </Button>
                    <Button
                      variant={paymentMethod === "gcash" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("gcash")}
                      className={cn("flex-1", paymentMethod === "gcash" && "bg-primary")}
                    >
                      GCash
                    </Button>
                  </div>
                </div>

                {paymentMethod === "cash" && (
                  <div className="space-y-2">
                    <Label htmlFor="modal-amount-given" className={cn(errors.amountGiven && "text-destructive")}>
                      Amount Given *
                    </Label>
                    <Input
                      id="modal-amount-given"
                      type="number"
                      step="0.01"
                      placeholder="₱0.00"
                      value={amountGiven}
                      onChange={(e) => {
                        setAmountGiven(e.target.value)
                        setErrors((prev) => ({ ...prev, amountGiven: "" }))
                      }}
                      className={cn(errors.amountGiven && "border-destructive")}
                    />
                    {errors.amountGiven && <p className="text-sm text-destructive">{errors.amountGiven}</p>}
                    <div className="p-2 bg-muted rounded text-sm">
                      <span className="text-muted-foreground">Change: </span>
                      <span className="font-bold text-green-600">
                        ₱
                        {(Number.parseFloat(amountGiven) || 0) >= selectedOrder.total
                          ? ((Number.parseFloat(amountGiven) || 0) - selectedOrder.total).toFixed(2)
                          : "0.00"}
                      </span>
                    </div>
                  </div>
                )}

                {paymentMethod === "gcash" && (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowGcashQrModal(true)}
                      className="w-full"
                    >
                      Share QR
                    </Button>
                    <div className="space-y-2">
                      <Label htmlFor="modal-phone" className={cn(errors.gcashPhone && "text-destructive")}>
                        Phone Number *
                      </Label>
                      <Input
                        id="modal-phone"
                        placeholder="09XX-XXX-XXXX"
                        value={gcashPhone}
                        onChange={(e) => handleGcashPhoneChange(e.target.value)}
                        className={cn(errors.gcashPhone && "border-destructive")}
                        maxLength={13}
                      />
                      {errors.gcashPhone && <p className="text-sm text-destructive">{errors.gcashPhone}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modal-reference" className={cn(errors.gcashReference && "text-destructive")}>
                        Reference Number
                      </Label>
                      <Input
                        id="modal-reference"
                        placeholder="Enter reference number"
                        value={gcashReference}
                        onChange={(e) => {
                          setGcashReference(e.target.value)
                          setErrors((prev) => ({ ...prev, gcashReference: "" }))
                        }}
                        className={cn(errors.gcashReference && "border-destructive")}
                      />
                      {errors.gcashReference && <p className="text-sm text-destructive">{errors.gcashReference}</p>}
                    </div>
                  </div>
                )}

                <Button onClick={handlePayOrder} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                  Confirm Payment
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {showUndoPaymentModal && orderToUndoPayment && (
          <div 
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              width: '100vw',
              height: '100vh',
              maxWidth: '100vw',
              minWidth: '100vw',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-orange-600">Undo Payment</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowUndoPaymentModal(false)
                      setOrderToUndoPayment(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Order for {orderToUndoPayment.customerName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    Are you sure you want to undo the payment for this order? This will change the status back to "Unpaid".
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{orderToUndoPayment.customerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {new Date(orderToUndoPayment.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold text-orange-600">₱{orderToUndoPayment.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowUndoPaymentModal(false)
                      setOrderToUndoPayment(null)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUndoPayment}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    Undo Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showDeleteModal && orderToDelete && (
          <div 
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              width: '100vw',
              height: '100vh',
              maxWidth: '100vw',
              minWidth: '100vw',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-red-600">Delete Order</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setOrderToDelete(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Order for {orderToDelete.customerName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    Are you sure you want to delete this order? This action cannot be undone.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{orderToDelete.customerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">
                      {new Date(orderToDelete.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-bold text-red-600">₱{orderToDelete.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setOrderToDelete(null)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteOrder}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    Delete Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showOrderDetailsModal && selectedOrderForDetails && (
          <div 
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-2 sm:p-4"
            style={{
              position: 'fixed',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              width: '100vw',
              height: '100vh',
              maxWidth: '100vw',
              minWidth: '100vw',
              WebkitOverflowScrolling: 'touch'
            }}
            onWheel={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <div 
              className="bg-background rounded-lg shadow-2xl w-full max-w-md sm:max-w-sm mx-auto max-h-[90vh] overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg sm:text-xl font-bold">Order Details</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowOrderDetailsModal(false)
                      setSelectedOrderForDetails(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span className="font-medium">{selectedOrderForDetails.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order #</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{selectedOrderForDetails.orderNumber || `ID: ${selectedOrderForDetails.id}`}</span>
                        {selectedOrderForDetails.isPreparedOrder && (
                          <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            PREPARED ORDER
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{new Date(selectedOrderForDetails.date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}</span>
                    </div>
                    {selectedOrderForDetails.createdAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ordered at</span>
                        <span>{new Date(selectedOrderForDetails.createdAt).toLocaleString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        }).replace(',', ' -')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Meal Type</span>
                      <span>{selectedOrderForDetails.originalMealType || selectedOrderForDetails.mealType || 'Meal'}</span>
                    </div>
                    {selectedOrderForDetails.cookTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cook Time</span>
                        <span>{formatTimeForDisplay(selectedOrderForDetails.cookTime)}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <p className="font-semibold text-sm">Order Items:</p>
                    {selectedOrderForDetails.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-medium">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {(selectedOrderForDetails.specialRequests || selectedOrderForDetails.remarks) && (
                    <div className="space-y-2 border-t pt-4">
                      {selectedOrderForDetails.specialRequests && (
                        <div>
                          <p className="text-sm font-medium text-blue-600">Special Requests:</p>
                          <p className="text-sm text-muted-foreground">{selectedOrderForDetails.specialRequests}</p>
                        </div>
                      )}
                      {selectedOrderForDetails.remarks && (
                        <div>
                          <p className="text-sm font-medium text-orange-600">Remarks:</p>
                          <p className="text-sm text-muted-foreground">{selectedOrderForDetails.remarks}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t">
                    <span className="font-bold text-lg">Total</span>
                    <span className="text-lg font-bold text-primary">₱{selectedOrderForDetails.total.toFixed(2)}</span>
                  </div>

<div className="flex justify-between items-center pt-4 border-t">
                    <span className="text-sm text-muted-foreground">Payment Status</span>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={selectedOrderForDetails.paymentStatus === "paid" ? "default" : "destructive"}
                        className={cn(
                          selectedOrderForDetails.paymentStatus === "paid" && selectedOrderForDetails.paymentMethod === "cash" && "bg-green-600 hover:bg-green-600/90",
                          selectedOrderForDetails.paymentStatus === "paid" && selectedOrderForDetails.paymentMethod === "gcash" && "bg-blue-600 hover:bg-blue-600/90"
                        )}
                      >
                        {selectedOrderForDetails.paymentStatus === "paid" 
                          ? `PAID - ${selectedOrderForDetails.paymentMethod?.toUpperCase() || 'CASH'}`
                          : 'NOT PAID'}
                      </Badge>
                    </div>
                  </div>

                  {/* GCash Payment Details */}
                  {selectedOrderForDetails.paymentMethod === "gcash" && (
                    <div className="space-y-2 pt-2">
                      {selectedOrderForDetails.gcashPhone && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">GCash Phone</span>
                          <span className="font-medium">{selectedOrderForDetails.gcashPhone}</span>
                        </div>
                      )}
                      {selectedOrderForDetails.gcashReference && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Reference Number</span>
                          <span className="font-medium">{selectedOrderForDetails.gcashReference}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 p-4 sm:p-6 border-t">
                {selectedOrderForDetails.paymentStatus === "not-paid" && (
                  <Button 
                    onClick={() => {
                      setShowOrderDetailsModal(false)
                      setSelectedOrder(selectedOrderForDetails)
                      setShowPaymentModal(true)
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Process Payment
                  </Button>
                )}
                {selectedOrderForDetails.paymentStatus === "paid" && (
                  <Button 
                    onClick={() => {
                      setShowOrderDetailsModal(false)
                      openUndoPaymentModal({ stopPropagation: () => {} } as React.MouseEvent, selectedOrderForDetails)
                    }}
                    variant="outline"
                    className="flex-1 text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    Undo Payment
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowOrderDetailsModal(false)
                    setSelectedOrderForDetails(null)
                  }}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* GCash QR Modal */}
        {showGcashQrModal && (
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-background rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative z-[10000]">
              <h3 className="text-xl font-bold mb-4">GCash QR Code</h3>
              <div className="flex flex-col items-center space-y-4">
                <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                  <img 
                    src="/gcash-qr.png" 
                    alt="GCash QR Code" 
                    className="w-64 h-64 object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.className = 'w-64 h-64 flex items-center justify-center bg-gray-100 text-gray-500 text-center p-4';
                      fallback.innerHTML = 'QR Code Image Not Found';
                      target.parentNode?.replaceChild(fallback, target);
                    }}
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold">Payment Amount</p>
                  <p className="text-2xl font-bold text-primary">₱{selectedOrder?.total.toFixed(2) || '0.00'}</p>
                  <p className="text-sm text-muted-foreground">Scan this QR code with your GCash app to complete the payment</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowGcashQrModal(false)} className="flex-1">
                  Close
                </Button>
                <Button onClick={handleGcashPaymentDone} className="flex-1 bg-green-600 hover:bg-green-700">
                  Done
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </POSLayout>
  )
}
