"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, CheckCircle, ChevronDown, Clock, Loader2, Minus, Plus, RotateCcw, X, ChefHat } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  getKitchenItems,
  markItemAsCooked,
  getCustomerOrders,
  updateCustomerOrders,
  updateKitchenItems,
  type KitchenItem,
  type CustomerOrder,
} from "@/lib/inventory-store"

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

export default function KitchenPage() {
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([])
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [todayOrders, setTodayOrders] = useState<CustomerOrder[]>([])
  // Set initial filter based on current time
  const getCurrentMealType = () => {
    const hours = new Date().getHours()
    if (hours >= 6 && hours < 11) return 'breakfast'
    return (hours >= 11 && hours < 17) ? 'lunch' : 'dinner'
  }

  const [filterMealType, setFilterMealType] = useState<"all" | "breakfast" | "lunch" | "dinner" | "other">(getCurrentMealType())
  const [autoMealType, setAutoMealType] = useState<"breakfast" | "lunch" | "dinner">(getCurrentMealType())
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ordersPerPage = 5

  const handleFilterChange = (mealType: "all" | "breakfast" | "lunch" | "dinner" | "other") => {
    setFilterMealType(mealType)
  }

  const loadData = () => {
    const allOrders = getCustomerOrders()
    setKitchenItems(getKitchenItems())
    setCustomerOrders(allOrders)
    
    // Get current date at midnight for comparison
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Filter orders for today and exclude advanced orders
    const filtered = allOrders
      .filter(order => {
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
      // Sort orders: incomplete first, then complete, both sorted by time (newest first)
      .sort((a, b) => {
        // If one is complete and the other isn't, incomplete comes first
        if (a.status === 'complete' && b.status !== 'complete') return 1
        if (a.status !== 'complete' && b.status === 'complete') return -1
        
        // If both have the same status, sort by time (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    
    setTodayOrders(filtered)
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
    window.addEventListener("kitchen-updated", handleUpdate)
    window.addEventListener("orders-updated", handleUpdate)
    window.addEventListener("customer-orders-updated", handleUpdate)

    return () => {
      clearInterval(mealTypeInterval)
      window.removeEventListener("kitchen-updated", handleUpdate)
      window.removeEventListener("orders-updated", handleUpdate)
      window.removeEventListener("customer-orders-updated", handleUpdate)
    }
  }, [filterMealType])

  // Get today's date for filtering
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Only show items from today's orders with meal type filter
  const toCookItems = kitchenItems
    .filter((item) => {
      const order = customerOrders.find(order => order.id === item.orderId)
      if (!order) return false
      
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      
      const matchesDate = orderDate.getTime() === today.getTime()
      const matchesMealType = filterMealType === "all" || 
        (order.mealType && order.mealType.toLowerCase() === filterMealType) ||
        (order.originalMealType && order.originalMealType.toLowerCase() === filterMealType)
      
      return item.status === "to-cook" && matchesDate && matchesMealType
    })
    // Sort to put completed items at the back
    .sort((a, b) => {
      const aOrder = customerOrders.find(order => order.id === a.orderId)
      const bOrder = customerOrders.find(order => order.id === b.orderId)
      const aComplete = aOrder?.status === 'complete' ? 1 : 0
      const bComplete = bOrder?.status === 'complete' ? 1 : 0
      return aComplete - bComplete
    })
  
  const cookedItems = kitchenItems.filter((item) => {
    const order = customerOrders.find(order => order.id === item.orderId)
    if (!order) return false
    
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    
    const matchesDate = orderDate.getTime() === today.getTime()
    const matchesMealType = filterMealType === "all" || 
      (order.mealType && order.mealType.toLowerCase() === filterMealType) ||
      (order.originalMealType && order.originalMealType.toLowerCase() === filterMealType)
    
    return item.status === "cooked" && matchesDate && matchesMealType
  })

  // Group items by name and sort by completion status
  const groupItemsByName = (items: KitchenItem[]) => {
    const grouped: Record<string, { count: number; items: KitchenItem[]; customers: string[] }> = {}
    
    // Create a map of customer names to their order status
    const customerStatus = new Map<string, boolean>()
    customerOrders.forEach(order => {
      customerStatus.set(order.customerName, order.status === 'complete')
    })
    
    // Sort items: incomplete first, then complete, both sorted by customer name
    const sortedItems = [...items].sort((a, b) => {
      const aComplete = customerStatus.get(a.customerName) ? 1 : 0
      const bComplete = customerStatus.get(b.customerName) ? 1 : 0
      
      // First sort by completion status (incomplete first)
      if (aComplete !== bComplete) {
        return aComplete - bComplete
      }
      
      // Then sort by customer name
      return a.customerName.localeCompare(b.customerName)
    })
    
    // Group the sorted items
    sortedItems.forEach(item => {
      if (!grouped[item.itemName]) {
        grouped[item.itemName] = { count: 0, items: [], customers: [] }
      }
      grouped[item.itemName].count += 1
      grouped[item.itemName].items.push(item)
      if (!grouped[item.itemName].customers.includes(item.customerName)) {
        grouped[item.itemName].customers.push(item.customerName)
      }
    })
    
    // Sort customers within each group to keep completed ones at the end
    Object.values(grouped).forEach(group => {
      group.customers.sort((a, b) => {
        const aComplete = customerStatus.get(a) ? 1 : 0
        const bComplete = customerStatus.get(b) ? 1 : 0
        return aComplete - bComplete || a.localeCompare(b)
      })
    })
    
    return grouped
  }

  const groupedToCookItems = Object.fromEntries(
    Object.entries(groupItemsByName(toCookItems)).sort(([a], [b]) => a.localeCompare(b))
  )
  const groupedCookedItems = Object.fromEntries(
    Object.entries(groupItemsByName(cookedItems)).sort(([a], [b]) => a.localeCompare(b))
  )

  // Initialize quantity inputs with actual group counts (avoiding infinite loop)
  const getInitialQuantity = (itemName: string, isUndo: boolean = false) => {
    const key = isUndo ? `undo-${itemName}` : itemName
    const group = isUndo ? groupedCookedItems[itemName] : groupedToCookItems[itemName]
    return quantityInputs[key] || (group ? group.count.toString() : "1")
  }

  const handleMarkAsCooked = (itemName: string, quantity: number = 1) => {
    const itemsToCook = kitchenItems.filter(item => {
      // Only include items from today's orders
      const order = customerOrders.find(order => order.id === item.orderId)
      if (!order) return false
      
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      
      return item.status === "to-cook" && item.itemName === itemName && orderDate.getTime() === today.getTime()
    })
    
    if (itemsToCook.length === 0 || quantity <= 0) return
    
    // Mark the specified number of items as cooked
    const itemsToMark = itemsToCook.slice(0, Math.min(quantity, itemsToCook.length))
    
    itemsToMark.forEach(itemToMark => {
      markItemAsCooked(itemToMark.id)
    })

    const orders = getCustomerOrders()
    const updated = orders.map((order) => {
      const orderItemsToMark = itemsToMark.filter(item => item.customerName === order.customerName)
      if (orderItemsToMark.length === 0) return order
      
      const existingCooked = order.cookedItems.find((item) => item.name === itemName)
      if (existingCooked) {
        return {
          ...order,
          cookedItems: order.cookedItems.map((item) =>
            item.name === itemName ? { ...item, quantity: item.quantity + orderItemsToMark.length } : item,
          ),
        }
      } else {
        return {
          ...order,
          cookedItems: [...order.cookedItems, { name: itemName, quantity: orderItemsToMark.length }],
        }
      }
    })

    const updatedWithStatus = updated.map((order) => {
      const totalOrdered = order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalCooked = order.cookedItems.reduce((sum, item) => sum + item.quantity, 0)
      return {
        ...order,
        status: totalOrdered === totalCooked && totalOrdered > 0 ? ("complete" as const) : ("incomplete" as const),
      }
    })

    updateCustomerOrders(updatedWithStatus)
    window.dispatchEvent(new Event("delivery-updated"))
    loadData()
    
    // Reset quantity input
    setQuantityInputs(prev => ({ ...prev, [itemName]: "" }))
  }

  const handleMarkAllAsCooked = () => {
    const allItemsToCook = kitchenItems.filter(item => {
      // Only include items from today's orders
      const order = customerOrders.find(order => order.id === item.orderId)
      if (!order) return false
      
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      
      return item.status === "to-cook" && orderDate.getTime() === today.getTime()
    })
    
    if (allItemsToCook.length === 0) return
    
    // Mark all items as cooked
    allItemsToCook.forEach(itemToMark => {
      markItemAsCooked(itemToMark.id)
    })

    // Update customer orders
    const orders = getCustomerOrders()
    const updated = orders.map((order) => {
      const orderItemsToMark = allItemsToCook.filter(item => item.customerName === order.customerName)
      if (orderItemsToMark.length === 0) return order
      
      const updatedCookedItems = [...order.cookedItems]
      
      orderItemsToMark.forEach(itemToMark => {
        const existingCooked = updatedCookedItems.find((item) => item.name === itemToMark.itemName)
        if (existingCooked) {
          existingCooked.quantity += 1
        } else {
          updatedCookedItems.push({ name: itemToMark.itemName, quantity: 1 })
        }
      })
      
      return {
        ...order,
        cookedItems: updatedCookedItems,
      }
    })

    const updatedWithStatus = updated.map((order) => {
      const totalOrdered = order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalCooked = order.cookedItems.reduce((sum, item) => sum + item.quantity, 0)
      return {
        ...order,
        status: totalOrdered === totalCooked && totalOrdered > 0 ? ("complete" as const) : ("incomplete" as const),
      }
    })

    updateCustomerOrders(updatedWithStatus)
    window.dispatchEvent(new Event("delivery-updated"))
    loadData()
    
    // Reset all quantity inputs
    setQuantityInputs({})
  }

  const handleUndoCooked = (itemName: string, quantity: number = 1) => {
    const cookedItemsForName = kitchenItems.filter(item => {
      // Only include items from today's orders
      const order = customerOrders.find(order => order.id === item.orderId)
      if (!order) return false
      
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      
      return item.status === "cooked" && item.itemName === itemName && orderDate.getTime() === today.getTime()
    })
    
    if (cookedItemsForName.length === 0 || quantity <= 0) return
    
    // Get the most recently cooked items
    const sortedItems = cookedItemsForName.sort((a, b) => {
      if (!a.cookedAt) return 1
      if (!b.cookedAt) return -1
      return new Date(b.cookedAt).getTime() - new Date(a.cookedAt).getTime()
    })
    
    const itemsToUndo = sortedItems.slice(0, Math.min(quantity, sortedItems.length))
    
    // Mark items as to-cook again
    const items = getKitchenItems()
    const updated = items.map((item) => {
      const itemToUndo = itemsToUndo.find(undoItem => undoItem.id === item.id)
      if (itemToUndo) {
        return { ...item, status: "to-cook" as const, cookedAt: undefined }
      }
      return item
    })
    updateKitchenItems(updated)

    // Update customer orders
    const orders = getCustomerOrders()
    const updatedOrders = orders.map((order) => {
      const orderItemsToUndo = itemsToUndo.filter(item => item.customerName === order.customerName)
      if (orderItemsToUndo.length === 0) return order
      
      return {
        ...order,
        cookedItems: order.cookedItems
          .map((item) => {
            if (item.name === itemName) {
              const newQuantity = item.quantity - orderItemsToUndo.length
              return newQuantity > 0 ? { ...item, quantity: newQuantity } : null
            }
            return item
          })
          .filter(Boolean) as Array<{ name: string; quantity: number }>,
      }
    })

    const updatedWithStatus = updatedOrders.map((order) => {
      const totalOrdered = order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalCooked = order.cookedItems.reduce((sum, item) => sum + item.quantity, 0)
      return {
        ...order,
        status: totalOrdered === totalCooked && totalOrdered > 0 ? ("complete" as const) : ("incomplete" as const),
      }
    })

    updateCustomerOrders(updatedWithStatus)
    window.dispatchEvent(new Event("delivery-updated"))
    loadData()
    
    // Reset quantity input
    setQuantityInputs(prev => ({ ...prev, [itemName]: "" }))
  }

  const completeOrders = todayOrders.filter((order) => order.status === "complete").length
  const incompleteOrders = todayOrders.filter((order) => order.status === "incomplete").length

  // Calculate meal type counts
  const breakfastOrders = customerOrders.filter((order: CustomerOrder) => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'breakfast') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'breakfast'))
  }).length

  const lunchOrders = customerOrders.filter((order: CustomerOrder) => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'lunch') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'lunch'))
  }).length

  const dinnerOrders = customerOrders.filter((order: CustomerOrder) => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'dinner') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'dinner'))
  }).length

  const otherOrders = customerOrders.filter((order: CustomerOrder) => {
    const orderDate = new Date(order.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime() && 
           ((order.mealType && order.mealType.toLowerCase() === 'other') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'other'))
  }).length

  // Sort orders to ensure completed ones are at the bottom
  const sortedTodayOrders = [...todayOrders].sort((a, b) => {
    // First, sort by completion status (incomplete first, then complete)
    if (a.status === 'complete' && b.status !== 'complete') return 1
    if (a.status !== 'complete' && b.status === 'complete') return -1
    
    // If status is the same, sort by time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedTodayOrders.length / ordersPerPage)
  const indexOfLastOrder = currentPage * ordersPerPage
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
  const currentOrders = sortedTodayOrders.slice(indexOfFirstOrder, indexOfLastOrder)

  const getMissingItems = (order: CustomerOrder) => {
    const missingItems = order.orderedItems.filter(
      (orderedItem) => !order.cookedItems.some((cookedItem) => cookedItem.name === orderedItem.name),
    )
    return missingItems
  }

  // Helper function to aggregate cooked items by name
  const getAggregatedCookedItems = (cookedItems: Array<{ name: string; quantity: number }>) => {
    const aggregated: Record<string, number> = {}
    
    cookedItems.forEach((item) => {
      if (aggregated[item.name]) {
        aggregated[item.name] += item.quantity
      } else {
        aggregated[item.name] = item.quantity
      }
    })
    
    return Object.entries(aggregated).map(([name, quantity]) => ({ name, quantity }))
  }

  const renderOrderDetails = (order: CustomerOrder) => {
    const missingItems = getMissingItems(order)
    const isComplete = order.status === "complete"
    
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">Order #{order.orderNumber || 'N/A'}</h3>
            <Badge variant={isComplete ? "default" : "destructive"} className={cn("w-fit", isComplete ? "bg-green-600" : "")}>
              {isComplete ? "Complete" : "In Progress"}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="font-medium text-sm sm:text-base">{order.customerName}</p>
            </div>
            
            <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Meal Type</p>
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="text-xs">
                  {order.originalMealType || order.mealType || 'Meal'}
                </Badge>
                {order.originalMealType === "Other" && order.mealType && order.mealType !== "Other" && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {order.mealType}
                  </Badge>
                )}
              </div>
            </div>
            
            {order.cookTime && (
              <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Cook Time</p>
                <p className="font-medium text-sm sm:text-base">{formatTimeForDisplay(order.cookTime)}</p>
              </div>
            )}
            
            <div className="space-y-1 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Order Status</p>
              <div className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                <span className="text-sm sm:text-base">{isComplete ? 'Ready to Serve' : 'In Progress'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-4">
            <h4 className="font-semibold text-sm sm:text-base mb-3 flex items-center gap-2">
              <span>Ordered Items</span>
              <span className="text-xs text-muted-foreground">
                ({order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)} items)
              </span>
            </h4>
            <div className="space-y-3">
              {[...order.orderedItems].sort((a, b) => {
                const aCookedQty = order.cookedItems.find(ci => ci.name === a.name)?.quantity || 0
                const bCookedQty = order.cookedItems.find(ci => ci.name === b.name)?.quantity || 0
                const aIsFullyCooked = aCookedQty >= a.quantity
                const bIsFullyCooked = bCookedQty >= b.quantity
                
                // Sort by completion status (incomplete first, then complete)
                if (aIsFullyCooked && !bIsFullyCooked) return 1
                if (!aIsFullyCooked && bIsFullyCooked) return -1
                
                // If same status, sort by name
                return a.name.localeCompare(b.name)
              }).map((item, idx) => {
                const cookedQty = order.cookedItems.find(ci => ci.name === item.name)?.quantity || 0
                const isFullyCooked = cookedQty >= item.quantity
                
                return (
                  <div key={idx} className="flex items-start justify-between py-2 border-b last:border-0 last:pb-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm sm:text-base">{item.quantity}x {item.name}</span>
                        {isFullyCooked && (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      {!isFullyCooked && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                          <div 
                            className="bg-amber-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, (cookedQty / item.quantity) * 100)}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs sm:text-sm ${isFullyCooked ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {cookedQty}/{item.quantity} {isFullyCooked ? 'Done' : 'Cooking'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          
          {missingItems.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="font-semibold text-sm sm:text-base text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Waiting for {missingItems.length} {missingItems.length === 1 ? 'item' : 'items'}</span>
              </h4>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                {missingItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white/50 dark:bg-gray-800/50 px-3 py-2 rounded-md">
                    <span className="text-sm">{item.quantity}x</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isComplete && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm sm:text-base font-medium text-green-800 dark:text-green-200">
                  All items have been cooked and ready to serve
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Kitchen View</h1>
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
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button
              variant={filterMealType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMealType("all")}
              className={cn("relative flex-1 sm:flex-none", filterMealType === "all" && "bg-primary")}
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
              className={cn("relative flex-1 sm:flex-none", filterMealType === "breakfast" && "bg-orange-500")}
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
              className={cn("relative flex-1 sm:flex-none", filterMealType === "lunch" && "bg-blue-500")}
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
              className={cn("relative flex-1 sm:flex-none", filterMealType === "dinner" && "bg-purple-500")}
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
              className={cn("relative flex-1 sm:flex-none", filterMealType === "other" && "bg-teal-500")}
            >
              Other
            </Button>
          </div>
        </div>

        {/* Missing Items Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Missing Items Only
              </span>
              <Badge variant="destructive">
                {(() => {
                  const allMissingItems = todayOrders.flatMap(order => getMissingItems(order))
                  const aggregatedMissing = allMissingItems.reduce((acc, item) => {
                    acc[item.name] = (acc[item.name] || 0) + item.quantity
                    return acc
                  }, {} as Record<string, number>)
                  return Object.keys(aggregatedMissing).length
                })()} {(() => {
                  const allMissingItems = todayOrders.flatMap(order => getMissingItems(order))
                  const aggregatedMissing = allMissingItems.reduce((acc, item) => {
                    acc[item.name] = (acc[item.name] || 0) + item.quantity
                    return acc
                  }, {} as Record<string, number>)
                  return Object.keys(aggregatedMissing).length === 1 ? 'item' : 'items'
                })()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const allMissingItems = todayOrders.flatMap(order => getMissingItems(order))
              const aggregatedMissing = allMissingItems.reduce((acc, item) => {
                acc[item.name] = (acc[item.name] || 0) + item.quantity
                return acc
              }, {} as Record<string, number>)
              
              const missingItemsArray = Object.entries(aggregatedMissing)
                .map(([name, quantity]) => ({ name, quantity }))
                .sort((a, b) => b.quantity - a.quantity)
              
              if (missingItemsArray.length === 0) {
                return (
                  <div className="text-center py-6">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                    <p className="text-sm text-muted-foreground">No missing items! All orders are complete.</p>
                  </div>
                )
              }
              
              return (
                <div className="flex flex-wrap gap-2">
                  {missingItemsArray.map((item, idx) => (
                    <Badge 
                      key={idx} 
                      variant="destructive" 
                      className="text-sm px-3 py-1 bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                    >
                      {item.quantity}x {item.name}
                    </Badge>
                  ))}
                </div>
              )
            })()}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 min-h-0">
          {/* Items to Cook */}
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                <span className="flex items-center gap-2 text-xl font-bold">
                  <ChefHat className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>Items to Cook</span>
                </span>
                <div className="flex items-center gap-2">
                  {Object.keys(groupedToCookItems).length > 0 && (
                    <Button
                      onClick={handleMarkAllAsCooked}
                      className="bg-green-600 hover:bg-green-700 text-white text-sm px-3 h-8"
                      size="sm"
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                      <span className="whitespace-nowrap">Mark All as Cooked</span>
                    </Button>
                  )}
                  <Badge variant="secondary" className="w-fit bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 text-base px-2.5 py-1">
                    {Object.keys(groupedToCookItems).length} {Object.keys(groupedToCookItems).length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 sm:p-1">
              {Object.keys(groupedToCookItems).length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center">
                  <ChefHat className="h-14 w-14 text-muted-foreground/50 mb-4" />
                  <h3 className="text-base font-medium text-foreground mb-1">No items to cook</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">All caught up! No orders need cooking right now.</p>
                </div>
              ) : (
                <div className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
                  <div className="overflow-y-auto max-h-[calc(100vh-400px)] px-4 sm:px-6 py-4 scrollbar-thin">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-2 sm:p-3">
                      {Object.entries(groupedToCookItems).map(([itemName, group]) => (
                        <div
                          key={itemName}
                          className="flex flex-col p-3 bg-amber-50 dark:bg-amber-950/50 rounded-lg border border-amber-100 dark:border-amber-900 hover:border-amber-200 dark:hover:border-amber-800 transition-colors min-h-[120px]"
                        >
                          <div className="flex-1 mb-3">
                            <p className="font-semibold text-lg text-amber-900 dark:text-amber-100 break-words">{itemName}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-amber-700 dark:text-amber-300">
                              <span className="inline-flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                                {group.count} {group.count === 1 ? 'item' : 'items'}
                              </span>
                              <span className="text-amber-500 dark:text-amber-400">•</span>
                              <span>{group.customers.length} {group.customers.length === 1 ? 'customer' : 'customers'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const current = parseInt(getInitialQuantity(itemName)) || group.count;
                                  const newQty = Math.max(1, current - 1);
                                  setQuantityInputs(prev => ({ ...prev, [itemName]: newQty.toString() }));
                                }}
                                className="h-7 w-7 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <input
                                type="number"
                                min="1"
                                max={group.count}
                                value={getInitialQuantity(itemName)}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === "" || /^\d+$/.test(value)) {
                                    setQuantityInputs(prev => ({ ...prev, [itemName]: value }))
                                  }
                                }}
                                className="w-8 text-center border-0 text-xs focus:outline-none bg-transparent text-amber-900 dark:text-amber-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const current = parseInt(getInitialQuantity(itemName)) || group.count
                                  const newQty = Math.min(group.count, current + 1)
                                  setQuantityInputs(prev => ({ ...prev, [itemName]: newQty.toString() }))
                                }}
                                className="h-7 w-7 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              onClick={() => handleMarkAsCooked(itemName, parseInt(getInitialQuantity(itemName)) || group.count)}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-7 w-full"
                              size="sm"
                            >
                              <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="whitespace-nowrap">Mark Done</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cooked Items */}
          <Card className="flex flex-col h-full">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2">
                <span className="flex items-center gap-2 text-xl font-bold">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <span>Cooked Items</span>
                </span>
                <div className="flex items-center gap-2">
                  {Object.keys(groupedCookedItems).length > 0 && (
                    <Button
                      onClick={() => {
                        // Undo all cooked items
                        Object.entries(groupedCookedItems).forEach(([itemName, group]) => {
                          handleUndoCooked(itemName, group.count);
                        });
                      }}
                      variant="outline"
                      className="bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 border-red-200 dark:border-red-800 text-sm px-3 h-8"
                      size="sm"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      <span className="whitespace-nowrap">Undo All</span>
                    </Button>
                  )}
                  <Badge variant="secondary" className="w-fit bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 text-base px-2.5 py-1">
                    {Object.keys(groupedCookedItems).length} {Object.keys(groupedCookedItems).length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 sm:p-1">
              {Object.keys(groupedCookedItems).length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center">
                  <CheckCircle className="h-14 w-14 text-muted-foreground/50 mb-4" />
                  <h3 className="text-base font-medium text-foreground mb-1">No cooked items</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Cooked items will appear here when ready</p>
                </div>
              ) : (
                <div className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
                  <div className="overflow-y-auto max-h-[calc(100vh-400px)] px-4 sm:px-6 py-4 scrollbar-thin">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-2 sm:p-3">
                      {Object.entries(groupedCookedItems).map(([itemName, group]) => (
                        <div
                          key={itemName}
                          className="flex flex-col p-3 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-100 dark:border-green-900 hover:border-green-200 dark:hover:border-green-800 transition-colors min-h-[120px]"
                        >
                          <div className="flex-1 mb-3">
                            <p className="font-semibold text-lg text-green-900 dark:text-green-100 break-words">{itemName}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-green-700 dark:text-green-300">
                              <span className="inline-flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                {group.count} {group.count === 1 ? 'item' : 'items'}
                              </span>
                              <span className="text-green-500 dark:text-green-400">•</span>
                              <span>{group.customers.length} {group.customers.length === 1 ? 'customer' : 'customers'}</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const current = parseInt(getInitialQuantity(itemName, true)) || group.count;
                                  const newQty = Math.max(1, current - 1);
                                  setQuantityInputs(prev => ({ ...prev, [`undo-${itemName}`]: newQty.toString() }));
                                }}
                                className="h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <input
                                type="number"
                                min="1"
                                max={group.count}
                                value={getInitialQuantity(itemName, true)}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === "" || /^\d+$/.test(value)) {
                                    setQuantityInputs(prev => ({ ...prev, [`undo-${itemName}`]: value }))
                                  }
                                }}
                                className="w-8 text-center border-0 text-xs focus:outline-none bg-transparent text-green-900 dark:text-green-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const current = parseInt(getInitialQuantity(itemName, true)) || group.count
                                  const newQty = Math.min(group.count, current + 1)
                                  setQuantityInputs(prev => ({ ...prev, [`undo-${itemName}`]: newQty.toString() }))
                                }}
                                className="h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              onClick={() => handleUndoCooked(itemName, parseInt(getInitialQuantity(itemName, true)) || group.count)}
                              className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1 h-7 w-full"
                              size="sm"
                            >
                              <RotateCcw className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="whitespace-nowrap">Undo</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Customer Orders Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-accent" />
                Customer Orders Details
              </span>
              {todayOrders.length > 0 && (
                <Badge variant="secondary">
                  {todayOrders.length} {todayOrders.length === 1 ? 'order' : 'orders'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No orders for today. Orders will appear here once placed for the current date.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {todayOrders
                  .slice((currentPage - 1) * ordersPerPage, currentPage * ordersPerPage)
                  .map((order) => {
                    const missingItems = getMissingItems(order)
                    const isComplete = order.status === "complete"

                    return (
                    <div
                      key={order.id}
                      className={cn(
                        "p-4 border-2 rounded-lg cursor-pointer hover:shadow-md transition-shadow",
                        isComplete
                          ? "bg-green-50 dark:bg-green-950 border-green-500 hover:border-green-600"
                          : "bg-amber-50 dark:bg-amber-950 border-amber-500 hover:border-amber-600",
                      )}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{order.customerName}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {order.orderNumber || 'N/A'}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
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
                        <Badge
                          variant={isComplete ? "default" : "destructive"}
                          className={cn(isComplete && "bg-green-600")}
                        >
                          {isComplete ? "Complete" : "Incomplete"}
                        </Badge>
                      </div>

                      {missingItems.length > 0 && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                          <p className="text-sm font-semibold text-red-600 mb-2">Missing Items:</p>
                          <div className="flex flex-wrap gap-2">
                            {missingItems.map((item, idx) => (
                              <Badge 
                                key={idx} 
                                variant="destructive" 
                                className="text-xs px-2 py-1 bg-red-100 text-red-800 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                              >
                                {item.quantity}x {item.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {isComplete && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">Completed Items:</p>
                          <div className="flex flex-wrap gap-2">
                            {order.orderedItems.map((item, idx) => (
                              <Badge 
                                key={idx} 
                                className="text-xs px-2 py-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                              >
                                {item.quantity}x {item.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
                </div>
                
                {/* Pagination Controls */}
                {todayOrders.length > 0 && (
                  <div className="pt-4 border-t">
                    <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {Math.ceil(todayOrders.length / ordersPerPage)}
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
                          {Array.from({ length: Math.min(5, Math.ceil(todayOrders.length / ordersPerPage)) }, (_, i) => {
                            // Show pages around current page
                            let pageNum = i + 1;
                            if (currentPage > 3 && Math.ceil(todayOrders.length / ordersPerPage) > 5) {
                              if (currentPage > Math.ceil(todayOrders.length / ordersPerPage) - 3) {
                                pageNum = Math.ceil(todayOrders.length / ordersPerPage) - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }
                            }
                            if (pageNum < 1 || pageNum > Math.ceil(todayOrders.length / ordersPerPage)) return null;
                            
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
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(todayOrders.length / ordersPerPage), p + 1))}
                          disabled={currentPage === Math.ceil(todayOrders.length / ordersPerPage)}
                        >
                          Next
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Showing {Math.min((currentPage - 1) * ordersPerPage + 1, todayOrders.length)}-{Math.min(currentPage * ordersPerPage, todayOrders.length)} of {todayOrders.length} orders
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-2xl w-[calc(100%-2rem)] sm:w-full max-h-[90vh] overflow-y-auto mx-0 sm:mx-4 p-0">
          <DialogHeader className="sticky top-0 bg-background z-10 border-b px-6 py-4">
            <DialogTitle className="text-base sm:text-lg">
              Order Details
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 px-1">
            {selectedOrder && renderOrderDetails(selectedOrder)}
          </div>
          <div className="sticky bottom-0 bg-background border-t px-6 py-3 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setSelectedOrder(null)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </POSLayout>
  )
}
