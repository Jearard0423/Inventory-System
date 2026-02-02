"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Check, Copy, Loader2, Phone, Truck, AlertCircle, CheckCircle, Clock, Package, MapPin, AlertTriangle, X, RotateCcw } from "lucide-react"
import { useEffect, useState } from "react"
import { getCustomerOrders, markOrderAsDelivered, getMissingItems, type CustomerOrder, markOrderAsUndelivered } from "@/lib/inventory-store"
import { saveNotification } from "@/lib/notifications-store"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/pagination"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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

export default function DeliveryPage() {
  const [allCustomerOrders, setAllCustomerOrders] = useState<CustomerOrder[]>([])
  const [copiedText, setCopiedText] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  
  // Modal states
  const [markDeliveredModalOpen, setMarkDeliveredModalOpen] = useState(false)
  const [orderDetailsModalOpen, setOrderDetailsModalOpen] = useState(false)
  const [lalamoveModalOpen, setLalamoveModalOpen] = useState(false)
  const [lalamoveDetailsModalOpen, setLalamoveDetailsModalOpen] = useState(false)
  const [undoDeliveryModalOpen, setUndoDeliveryModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [verificationChecked, setVerificationChecked] = useState(false)
  // Set initial filter based on current time
  const getCurrentMealType = () => {
    const hours = new Date().getHours()
    if (hours >= 6 && hours < 11) return 'breakfast'
    return (hours >= 11 && hours < 17) ? 'lunch' : 'dinner'
  }

  const [filterStatus, setFilterStatus] = useState<"all" | "complete" | "incomplete" | "delivered">("all")
  const [filterMealType, setFilterMealType] = useState<"all" | "breakfast" | "lunch" | "dinner" | "other">(getCurrentMealType())
  const [autoMealType, setAutoMealType] = useState<"breakfast" | "lunch" | "dinner">(getCurrentMealType())
  const [userSelectedFilter, setUserSelectedFilter] = useState<boolean>(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const loadData = () => {
    const allOrders = getCustomerOrders()
    
    // Get current date at midnight for comparison
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Filter orders for today and exclude advanced orders
    const filtered = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      
      // Check if order is for today
      const isToday = orderDate.getTime() === today.getTime()
      
      // Check if it's an advanced order (order is for a future date)
      const isAdvancedOrder = orderDate > today
      
      // Check meal type filter
      const matchesMealType = filterMealType === "all" || 
        (order.mealType && order.mealType.toLowerCase() === filterMealType) ||
        (order.originalMealType && order.originalMealType.toLowerCase() === filterMealType)
      
      // Only include orders from today that match the meal type and are not advanced orders
      return isToday && !isAdvancedOrder && matchesMealType
    })
    
    setAllCustomerOrders(filtered)
  }

  // Track the current time-based meal type (for display only)
  const updateMealType = () => {
    const now = new Date()
    const hours = now.getHours()
    // Assume breakfast is 6:00-10:59, lunch is 11:00-16:59, dinner is 17:00-22:59
    let currentMealType: 'breakfast' | 'lunch' | 'dinner'
    if (hours >= 6 && hours < 11) {
      currentMealType = 'breakfast'
    } else if (hours >= 11 && hours < 17) {
      currentMealType = 'lunch'
    } else {
      currentMealType = 'dinner'
    }
    setAutoMealType(currentMealType)
  }

  useEffect(() => {
    loadData()
    updateMealType()

    // Update meal type every minute
    const mealTypeInterval = setInterval(updateMealType, 60000)

    const handleUpdate = () => loadData()
    window.addEventListener("customer-orders-updated", handleUpdate)
    window.addEventListener("kitchen-updated", handleUpdate)

    return () => {
      clearInterval(mealTypeInterval)
      window.removeEventListener("customer-orders-updated", handleUpdate)
      window.removeEventListener("kitchen-updated", handleUpdate)
    }
  }, [filterMealType])

  const filteredOrders = allCustomerOrders.filter((order) => {
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesCustomerName = order.customerName.toLowerCase().includes(query)
      const matchesOrderNumber = order.orderNumber?.toLowerCase().includes(query)
      
      if (!matchesCustomerName && !matchesOrderNumber) {
        return false
      }
    }
    
    if (filterStatus === "all") return true
    if (filterStatus === "delivered") return order.status === "delivered"
    if (filterStatus === "complete") return order.status === "complete"
    if (filterStatus === "incomplete") return order.status === "incomplete"
    return true
  }).filter((order) => {
    if (filterMealType === "all") return true
    return (order.mealType && order.mealType.toLowerCase() === filterMealType) ||
           (order.originalMealType && order.originalMealType.toLowerCase() === filterMealType)
  }).sort((a, b) => {
    // Sort order: incomplete > complete > delivered
    const statusOrder = { 'incomplete': 0, 'complete': 1, 'delivered': 2 }
    return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
  })

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterMealType])

  const completeOrders = allCustomerOrders.filter((order) => order.status === "complete")
  const incompleteOrders = allCustomerOrders.filter((order) => order.status === "incomplete")
  const deliveredOrders = allCustomerOrders.filter((order) => order.status === "delivered")


  const handleMarkAsDelivered = (order: CustomerOrder) => {
    setSelectedOrder(order)
    setMarkDeliveredModalOpen(true)
  }

  const confirmDelivery = () => {
    if (selectedOrder && verificationChecked) {
      markOrderAsDelivered(selectedOrder.id)
      saveNotification({
        type: "delivery",
        title: "Order Delivered",
        message: `Order ${selectedOrder.orderNumber || `#${selectedOrder.id}`} for ${selectedOrder.customerName} has been successfully delivered`,
        priority: "low",
      })
      setVerificationChecked(false)
      setOrderDetailsModalOpen(false)
      setMarkDeliveredModalOpen(false)
      setSelectedOrder(null)
      loadData()
    }
  }

  const handleUndoDelivery = (order: CustomerOrder) => {
    setSelectedOrder(order)
    setUndoDeliveryModalOpen(true)
  }

  const confirmUndoDelivery = () => {
    if (selectedOrder) {
      markOrderAsUndelivered(selectedOrder.id)
      saveNotification({
        type: "delivery",
        title: "Delivery Undone",
        message: `Delivery for Order ${selectedOrder.orderNumber || `#${selectedOrder.id}`} (${selectedOrder.customerName}) has been undone`,
        priority: "medium",
      })
      setUndoDeliveryModalOpen(false)
      setSelectedOrder(null)
      loadData()
    }
  }

  const handleLalamove = (order: CustomerOrder) => {
    setSelectedOrder(order)
    setLalamoveModalOpen(true)
  }

  const confirmLalamoveDelivery = () => {
    if (selectedOrder) {
      saveNotification({
        type: "delivery",
        title: "Lalamove Delivery Initiated",
        message: `Lalamove delivery requested for Order ${selectedOrder.orderNumber || `#${selectedOrder.id}`} (${selectedOrder.customerName})`,
        priority: "medium",
      })
      setLalamoveDetailsModalOpen(false)
      setLalamoveModalOpen(false)
      setSelectedOrder(null)
      window.open("https://www.lalamove.com/", "_blank")
    }
  }

  const getItemPrice = (itemName: string): number => {
    // This would typically come from inventory, for now using placeholder prices
    const prices: { [key: string]: number } = {
      "Roast Chicken": 360,
      "Chicken Yangchow Meal": 160,
      "Roast Liempo - Jumbo": 590,
      "Roast Liempo - Medium": 295,
      "Sisig - Family": 450,
      "Sisig - Sharing": 250,
      "Kare Kare Liempo Meal": 280,
      "Sisig Meal": 180,
      "Yang Chow Fried - Sharing": 220,
      "Yang Chow Fried - Party Tray": 450
    }
    return prices[itemName] || 0
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(label)
      setTimeout(() => setCopiedText(""), 2000)
    })
  }

  const getTotalCookedItems = (order: CustomerOrder) => {
    return order.cookedItems.reduce((sum, item) => sum + item.quantity, 0)
  }

  const getTotalOrderedItems = (order: CustomerOrder) => {
    return order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)
  }

  // Calculate meal type counts for delivery page
  const breakfastOrders = allCustomerOrders.filter(order => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'breakfast') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'breakfast'))
  }).length

  const lunchOrders = allCustomerOrders.filter(order => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'lunch') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'lunch'))
  }).length

  const dinnerOrders = allCustomerOrders.filter(order => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'dinner') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'dinner'))
  }).length

  const otherOrders = allCustomerOrders.filter(order => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'other') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'other'))
  }).length

  return (
    <POSLayout>
      <div className="space-y-6">
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold">Delivery Process</h1>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
              <div className="text-center bg-orange-100 dark:bg-orange-900/50 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-800">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-200">Breakfast</p>
                <p className="text-base md:text-lg font-bold text-orange-800 dark:text-orange-100">{breakfastOrders}</p>
              </div>
              <div className="text-center bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-200">Lunch</p>
                <p className="text-base md:text-lg font-bold text-blue-800 dark:text-blue-100">{lunchOrders}</p>
              </div>
              <div className="text-center bg-purple-100 dark:bg-purple-900/50 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-200">Dinner</p>
                <p className="text-base md:text-lg font-bold text-purple-800 dark:text-purple-100">{dinnerOrders}</p>
              </div>
              <div className="text-center bg-teal-100 dark:bg-teal-900/50 px-3 py-2 rounded-lg border border-teal-200 dark:border-teal-800">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-200">Other</p>
                <p className="text-base md:text-lg font-bold text-teal-800 dark:text-teal-100">{otherOrders}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <Card className="p-2">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-center text-green-600">
                <CheckCircle className="h-7 w-7" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-center">
              <p className="text-3xl font-bold text-green-600">{completeOrders.length}</p>
              <p className="text-xs text-muted-foreground hidden md:block">Ready for delivery</p>
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-center text-amber-600">
                <AlertCircle className="h-7 w-7" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-center">
              <p className="text-3xl font-bold text-amber-600">{incompleteOrders.length}</p>
              <p className="text-xs text-muted-foreground hidden md:block">Waiting for items</p>
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-center text-blue-600">
                <Truck className="h-7 w-7" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-center">
              <p className="text-3xl font-bold text-blue-600">{deliveredOrders.length}</p>
              <p className="text-xs text-muted-foreground hidden md:block">Successfully delivered</p>
            </CardContent>
          </Card>

          <Card className="p-2">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-center text-primary">
                <Package className="h-7 w-7" />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-center">
              <p className="text-3xl font-bold text-primary">{allCustomerOrders.length}</p>
              <p className="text-xs text-muted-foreground hidden md:block">All orders today</p>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-visible">
          <CardContent className="pt-6">
            {/* Action Buttons */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="w-full">
                <h2 className="text-xl font-bold">Customer Orders Details</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <Button
                  onClick={() => setMarkDeliveredModalOpen(true)}
                  disabled={completeOrders.length === 0}
                  className="bg-green-600 hover:bg-green-700 w-full justify-center"
                  size="lg"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="text-center">Mark as Delivered ({completeOrders.length})</span>
                </Button>
                <Button
                  onClick={() => setLalamoveModalOpen(true)}
                  disabled={completeOrders.length === 0}
                  variant="outline"
                  className="w-full justify-center"
                  size="lg"
                >
                  <Truck className="h-4 w-4 mr-2" />
                  <span className="text-center">Deliver by Lalamove ({completeOrders.length})</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-1/3">
                <label className="block text-sm font-medium mb-2">Search Orders</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by customer name or order number..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              
              <div className="w-full lg:w-1/3">
                <label className="block text-sm font-medium mb-2">Filter Orders</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="all">All Orders ({allCustomerOrders.length})</option>
                  <option value="complete">Complete Orders ({completeOrders.length})</option>
                  <option value="incomplete">Incomplete Orders ({incompleteOrders.length})</option>
                  <option value="delivered">Delivered Orders ({deliveredOrders.length})</option>
                </select>
              </div>
              
              <div className="w-full lg:w-2/3">
                <label className="block text-sm font-medium mb-2">Meal Type</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filterMealType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMealType("all")}
                    className={cn("relative flex-1 sm:flex-none min-w-[80px]", filterMealType === "all" && "bg-primary")}
                  >
                    {filterMealType === "all" && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500"></span>
                    )}
                    All
                  </Button>
                  <Button
                    variant={filterMealType === "breakfast" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMealType("breakfast")}
                    className={cn("relative flex-1 sm:flex-none min-w-[100px]", filterMealType === "breakfast" && "bg-orange-500")}
                  >
                    {autoMealType === "breakfast" && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500"></span>
                    )}
                    Breakfast
                  </Button>
                  <Button
                    variant={filterMealType === "lunch" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMealType("lunch")}
                    className={cn("relative flex-1 sm:flex-none min-w-[80px]", filterMealType === "lunch" && "bg-blue-500")}
                  >
                    {autoMealType === "lunch" && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500"></span>
                    )}
                    Lunch
                  </Button>
                  <Button
                    variant={filterMealType === "dinner" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMealType("dinner")}
                    className={cn("relative flex-1 sm:flex-none min-w-[80px]", filterMealType === "dinner" && "bg-purple-500")}
                  >
                    {autoMealType === "dinner" && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-500"></span>
                    )}
                    Dinner
                  </Button>
                  <Button
                    variant={filterMealType === "other" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterMealType("other")}
                    className={cn("flex-1 sm:flex-none min-w-[80px]", filterMealType === "other" && "bg-teal-500")}
                  >
                    Other
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>


        {/* Customer Orders List - Matching Kitchen View Layout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-accent" />
                Orders
              </span>
              {filteredOrders.length > 0 && (
                <Badge variant="secondary">
                  {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedOrders.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-20 w-20 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {filterStatus === "all" ? "No orders for delivery" : `No ${filterStatus} orders`}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {filterStatus === "all"
                    ? "Customer orders will appear here once items are being cooked in the Kitchen View."
                    : `There are currently no ${filterStatus} orders.`}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedOrders.map((order) => {
                    const missingItems = getMissingItems(order)
                    const isComplete = order.status === "complete"
                    const isDelivered = order.status === "delivered"
                    const totalCooked = getTotalCookedItems(order)
                    const totalOrdered = getTotalOrderedItems(order)
                    const hasDeliveryInfo = order.deliveryPhone || order.deliveryAddress

                    return (
                      <div
                        key={order.id}
                        className={cn(
                          "p-4 border-2 rounded-lg hover:shadow-md transition-shadow w-full relative",
                          isDelivered
                            ? "bg-blue-50 dark:bg-blue-950 border-blue-500 hover:border-blue-600"
                            : isComplete
                              ? "bg-green-50 dark:bg-green-950 border-green-500 hover:border-green-600"
                              : "bg-amber-50 dark:bg-amber-950 border-amber-500 hover:border-amber-600",
                        )}
                      >
                        {/* Undo button for delivered orders */}
                        {isDelivered && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUndoDelivery(order)}
                            className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/90 hover:bg-white border-red-200 hover:border-red-300"
                            title="Undo Delivery"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        )}
                        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate">{order.customerName}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              {order.orderNumber && (
                                <Badge variant="outline" className="text-xs font-mono">
                                  {order.orderNumber}
                                </Badge>
                              )}
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
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge
                                variant={isComplete ? "default" : "secondary"}
                                className={isComplete ? "bg-green-600 text-white" : "bg-amber-600 text-white"}
                              >
                                {totalCooked}/{totalOrdered} items cooked
                              </Badge>
                              {isDelivered ? (
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                  <Truck className="h-3 w-3 mr-1" />
                                  Delivered
                                </Badge>
                              ) : isComplete ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Complete
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Incomplete
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons for complete orders */}
                          {isComplete && !isDelivered && (
                            <div className="flex flex-col gap-2 w-full lg:w-auto lg:min-w-48">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setOrderDetailsModalOpen(true)
                                }}
                                className="bg-green-600 hover:bg-green-700 w-full"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Mark as Delivered
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setLalamoveDetailsModalOpen(true)
                                }}
                                className="w-full"
                              >
                                <Truck className="h-3 w-3 mr-1" />
                                Deliver by Lalamove
                              </Button>
                            </div>
                          )}
                        </div>

                        {isComplete && (
                          <div className="mb-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                            <h4 className="font-semibold text-sm mb-2 text-green-900 dark:text-green-100">
                              Completed Items:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {order.cookedItems.map((item, idx) => (
                                <Badge 
                                  key={idx} 
                                  className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700"
                                >
                                  {item.quantity}x {item.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {missingItems.length > 0 && !isDelivered && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                            <p className="text-sm font-semibold text-red-600 mb-2">Missing Items:</p>
                            <div className="flex flex-wrap gap-2">
                              {missingItems.map((item, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant="destructive" 
                                  className="text-xs px-2 py-1 bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                                >
                                  {item.needed}x {item.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {isComplete && (
                          <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">Order is Complete</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* Pagination Controls - Matching Kitchen View Style */}
                {totalPages > 1 && (
                  <div className="pt-4 border-t">
                    <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Show pages around current page
                            let pageNum = i + 1;
                            if (currentPage > 3 && totalPages > 5) {
                              if (currentPage > totalPages - 3) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                            }
                            if (pageNum < 1 || pageNum > totalPages) return null;
                            
                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className="w-8 h-8 p-0"
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredOrders.length)}-{Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div>
        {/* Mark as Delivered Modal */}
        <Dialog open={markDeliveredModalOpen} onOpenChange={setMarkDeliveredModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Mark as Delivered</DialogTitle>
              <DialogDescription>
                Select an order to mark as delivered
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {filteredOrders
                .filter(order => order.status === 'complete')
                .map((order) => (
                  <div
                    key={order.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setSelectedOrder(order)
                      setOrderDetailsModalOpen(true)
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{order.customerName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {order.orderedItems.length} items • {order.originalMealType || order.mealType}
                        </p>
                      </div>
                      <Badge variant="outline">{order.status}</Badge>
                    </div>
                  </div>
                ))}
            </div>
            
            {filteredOrders.filter(order => order.status === 'complete').length > 0 && (
              <div className="flex items-start space-x-3 mt-4 pt-4 border-t">
                <Checkbox
                  id="bulk-verification"
                  checked={verificationChecked}
                  onCheckedChange={(checked) => setVerificationChecked(checked as boolean)}
                  className="mt-1"
                />
                <label
                  htmlFor="bulk-verification"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I have verified all the selected orders and quantities before delivery
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkDeliveredModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // Mark all complete orders as delivered
                  const completeOrders = filteredOrders.filter(order => order.status === 'complete')
                  completeOrders.forEach((order) => {
                    markOrderAsDelivered(order.id)
                    saveNotification({
                      type: "delivery",
                      title: "Order Delivered",
                      message: `Order ${order.orderNumber || `#${order.id}`} for ${order.customerName} has been successfully delivered`,
                      priority: "low",
                    })
                  })
                  setVerificationChecked(false)
                  setMarkDeliveredModalOpen(false)
                  loadData()
                }}
                disabled={!verificationChecked || filteredOrders.filter(order => order.status === 'complete').length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Delivered ({filteredOrders.filter(order => order.status === 'complete').length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Details Modal for Delivery Confirmation */}
        <Dialog open={orderDetailsModalOpen} onOpenChange={setOrderDetailsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                Review the order details before confirming delivery
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Customer</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">{selectedOrder.customerName}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Order #</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">{selectedOrder.orderNumber || `#${selectedOrder.id}`}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Date</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">
                        {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Ordered at</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">
                        {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}, {new Date(selectedOrder.createdAt).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Meal Type</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">{selectedOrder.originalMealType || selectedOrder.mealType}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Payment Status</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium text-red-600">NOT PAID</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Order Items:</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                    {selectedOrder.orderedItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded">
                        <div className="flex items-center gap-3">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{item.quantity}x {item.name}</span>
                        </div>
                        <span className="font-medium">₱{(getItemPrice(item.name) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Total</span>
                        <span className="font-bold text-lg">
                          ₱{selectedOrder.orderedItems.reduce((sum, item) => sum + (getItemPrice(item.name) * item.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="verification"
                    checked={verificationChecked}
                    onCheckedChange={(checked) => setVerificationChecked(checked as boolean)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="verification"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have verified the selected orders and quantities before delivery
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setOrderDetailsModalOpen(false)
                setVerificationChecked(false)
              }}>
                Cancel
              </Button>
              <Button
                onClick={confirmDelivery}
                disabled={!verificationChecked}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Delivery
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lalamove Modal */}
        <Dialog open={lalamoveModalOpen} onOpenChange={setLalamoveModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Deliver by Lalamove</DialogTitle>
              <DialogDescription>
                Select an order for Lalamove delivery
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {filteredOrders
                .filter(order => order.status === 'complete')
                .map((order) => (
                  <div
                    key={order.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => {
                      setSelectedOrder(order)
                      setLalamoveDetailsModalOpen(true)
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold">{order.customerName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {order.orderedItems.length} items • {order.originalMealType || order.mealType}
                        </p>
                      </div>
                      <Badge variant="outline">{order.status}</Badge>
                    </div>
                  </div>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLalamoveModalOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lalamove Order Details Modal */}
        <Dialog open={lalamoveDetailsModalOpen} onOpenChange={setLalamoveDetailsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>
                Copy the customer information for Lalamove delivery
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Customer</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">{selectedOrder.customerName}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Order #</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">{selectedOrder.orderNumber || `#${selectedOrder.id}`}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Date</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">
                        {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Ordered at</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">
                        {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}, {new Date(selectedOrder.createdAt).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Meal Type</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium">{selectedOrder.originalMealType || selectedOrder.mealType}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Payment Status</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <p className="font-medium text-red-600">NOT PAID</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Order Items:</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
                    {selectedOrder.orderedItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded">
                        <div className="flex items-center gap-3">
                          <Check className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{item.quantity}x {item.name}</span>
                        </div>
                        <span className="font-medium">₱{(getItemPrice(item.name) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Total</span>
                        <span className="font-bold text-lg">
                          ₱{selectedOrder.orderedItems.reduce((sum, item) => sum + (getItemPrice(item.name) * item.quantity), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Customer Information</h4>
                  <div className="space-y-3">
                    {selectedOrder.deliveryPhone && (
                      <div className="flex items-center justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">{selectedOrder.deliveryPhone}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(selectedOrder.deliveryPhone!, `lalamove-phone-${selectedOrder.id}`)}
                          className={cn(
                            "h-7 text-xs",
                            copiedText === `lalamove-phone-${selectedOrder.id}` && "bg-green-100 border-green-300",
                          )}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copiedText === `lalamove-phone-${selectedOrder.id}` ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    )}
                    
                    {selectedOrder.deliveryAddress && (
                      <div className="flex items-start justify-between gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-start gap-2 flex-1">
                          <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span className="font-medium">{selectedOrder.deliveryAddress}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(selectedOrder.deliveryAddress!, `lalamove-address-${selectedOrder.id}`)}
                          className={cn(
                            "h-7 text-xs flex-shrink-0",
                            copiedText === `lalamove-address-${selectedOrder.id}` && "bg-green-100 border-green-300",
                          )}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copiedText === `lalamove-address-${selectedOrder.id}` ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="lalamove-verification"
                    checked={verificationChecked}
                    onCheckedChange={(checked) => setVerificationChecked(checked as boolean)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="lalamove-verification"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have verified the selected orders and quantities before delivery
                  </label>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setLalamoveDetailsModalOpen(false)
                setVerificationChecked(false)
              }}>
                Cancel
              </Button>
              <Button
                onClick={confirmLalamoveDelivery}
                disabled={!verificationChecked}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Deliver by Lalamove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      {/* Undo Delivery Confirmation Dialog */}
      {undoDeliveryModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => {}}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Undo Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-gray-700">
                Are you sure you want to undo delivery for <strong>{selectedOrder.customerName}</strong>? 
                This will mark the order as complete but not delivered.
              </p>
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setUndoDeliveryModalOpen(false)
                    setSelectedOrder(null)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="outline"
                  onClick={confirmUndoDelivery}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                >
                  Undo Delivery
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
      </div>
    </POSLayout>
  )
}
