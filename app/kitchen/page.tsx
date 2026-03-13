"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Check, CheckCircle, ChevronDown, Clock, Loader2, Minus, Plus, RotateCcw, X, ChefHat } from "lucide-react"
import React, { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  getKitchenItems,
  markItemAsCooked,
  getCustomerOrders,
  updateCustomerOrders,
  updateKitchenItems,
  archiveOrderToHistory,
  getOrderHistory,
  type KitchenItem,
  type CustomerOrder,
} from "@/lib/inventory-store"
import { checkAndSendFoodPreparationReminder, resetNotificationState, checkAndSendAdvancedOrderNotifications, resetAdvancedNotificationState, getAdminEmails, parseLocalDate } from "@/lib/email-notifications"
import { useAuth } from "@/components/AuthProvider"
import { checkAndFireOrderReminders, resetOrderReminders } from "@/lib/order-reminders"
import { syncOrderToRTDB, logOrderEvent } from "@/lib/rtdb-sync"
import { fetchOrdersNow, fetchKitchenNow } from "@/lib/firebase-inventory-sync"

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
  const auth = useAuth()
  // Guard: prevents loadData from re-entering itself when Firebase write → onValue → event → loadData
  const isLoadingRef = useRef(false)
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([])
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([])
  const [todayOrders, setTodayOrders] = useState<CustomerOrder[]>([])
  
  // Initialize to 'lunch' as default, will be updated on client only
  const [filterMealType, setFilterMealType] = useState<"all" | "breakfast" | "lunch" | "dinner" | "other">("lunch")
  // Ref so loadData always reads the latest filterMealType without needing it as a useEffect dep
  const filterMealTypeRef = useRef<"all" | "breakfast" | "lunch" | "dinner" | "other">("lunch")
  const [autoMealType, setAutoMealType] = useState<"breakfast" | "lunch" | "dinner">("lunch")
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({})
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ordersPerPage = 5
  const [markedItemDialogOpen, setMarkedItemDialogOpen] = useState(false)
  const [markedItemName, setMarkedItemName] = useState<string>("")
  const [markedItemQuantity, setMarkedItemQuantity] = useState<number>(0)

  // Set initial filter based on current time (client-side only)
  useEffect(() => {
    const getCurrentMealType = () => {
      const hours = new Date().getHours()
      if (hours >= 6 && hours < 11) return 'breakfast'
      return (hours >= 11 && hours < 17) ? 'lunch' : 'dinner'
    }
    setFilterMealType(getCurrentMealType())
    setAutoMealType(getCurrentMealType())
  }, [])

  const handleFilterChange = (mealType: "all" | "breakfast" | "lunch" | "dinner" | "other") => {
    filterMealTypeRef.current = mealType
    setFilterMealType(mealType)
  }

  // Returns only orders that are truly active — excludes anything finalized or already in history
  const getActiveOrders = () => {
    const history = getOrderHistory()
    const finalHistoryIds = new Set(history.map(o => o.id))
    const finalStatuses = new Set(['delivered', 'served', 'cancelled', 'canceled', 'complete', 'ready'])
    return getCustomerOrders().filter(o => {
      if (finalHistoryIds.has(o.id)) return false
      const s = (o.status || '').toLowerCase()
      if (finalStatuses.has(s)) return false
      return true
    })
  }

  const loadData = () => {
    if (isLoadingRef.current) return  // prevent re-entrant call loop
    isLoadingRef.current = true
    try {
    const allOrdersRaw = getCustomerOrders()
    const kItems = getKitchenItems()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Build a set of order IDs that are already in history as delivered/cancelled
    // This prevents Firebase from pushing stale data back into the kitchen view
    const history = getOrderHistory()
    const finalHistoryIds = new Set(
      history
        .filter(o => {
          const s = (o.status || '').toLowerCase()
          return s === 'delivered' || s === 'served' || s === 'cancelled' || s === 'canceled'
        })
        .map(o => o.id)
    )

    const recentOrders = allOrdersRaw.filter(order => {
      try {
        // Skip any order already archived as delivered/cancelled in history
        if (finalHistoryIds.has(order.id)) {
          console.log(`[Kitchen] Skipping history-finalized order: ${order.customerName} (${order.id})`)
          return false
        }
        // Always archive delivered/complete before any removal
        if (order.status === 'delivered' || order.status === 'complete' || order.status === 'ready') {
          archiveOrderToHistory(order)
        }

        const s = (order.status || '').toLowerCase()
        const isFinal = s === 'delivered' || s === 'served' || s === 'cancelled' || s === 'canceled'

        // Prefer order.date (delivery/scheduled date) over createdAt
        const dateStr = (order as any).date || order.createdAt
        const orderDate = dateStr ? new Date(dateStr) : null
        if (!orderDate) return !isFinal // keep undated non-final orders

        orderDate.setHours(0, 0, 0, 0)
        const isToday = orderDate.getTime() === today.getTime()

        // Remove if final status (delivered/cancelled) — always, regardless of date
        if (isFinal) {
          archiveOrderToHistory(order)
          console.log(`[Kitchen] Removing final-status order: ${order.customerName} (${order.id}) status=${order.status}`)
          return false
        }

        // Remove if not today
        if (!isToday) {
          archiveOrderToHistory(order)
          console.log(`[Kitchen] Removing old order: ${order.customerName} (${order.id}) date=${order.createdAt}`)
          return false
        }

        // Remove if incomplete/cooking but has NO kitchen items at all (stale ghost order)
        const hasKitchenItems = kItems.some(ki => ki.orderId === order.id)
        const isActiveStatus = s === 'incomplete' || s === 'cooking'
        if (isActiveStatus && !hasKitchenItems) {
          console.log(`[Kitchen] Removing ghost order with no kitchen items: ${order.customerName} (${order.id})`)
          return false
        }

        return true
      } catch {
        return true
      }
    })

    // Persist cleanup if anything was removed.
    // IMPORTANT: use localStorage directly (not updateCustomerOrders) to avoid
    // triggering a Firebase write → onValue → loadData infinite loop.
    if (recentOrders.length < allOrdersRaw.length) {
      try {
        localStorage.setItem('yellowbell_customer_orders', JSON.stringify(recentOrders))
      } catch { /* non-critical */ }
      console.log(`[Kitchen] Cleanup: removed ${allOrdersRaw.length - recentOrders.length} stale orders`)
    }

    const allOrders = recentOrders
    // Sanitize via JSON round-trip to prevent circular reference crash in React reconciler
    try {
      setKitchenItems(JSON.parse(JSON.stringify(getKitchenItems())))
      setCustomerOrders(JSON.parse(JSON.stringify(allOrders)))
    } catch {
      setKitchenItems(getKitchenItems())
      setCustomerOrders(allOrders)
    }
    
    // Helper to reliably check if an order is for today using local date string (avoids timezone issues)
    const isOrderForToday = (order: CustomerOrder) => {
      try {
        // Prefer order.date (delivery date set by admin) over createdAt
        // This ensures scheduled future orders appear on the correct day in kitchen
        const dateStr = (order as any).date || order.createdAt
        if (!dateStr) {
          console.warn('[Kitchen] Order missing date:', order.id, order.customerName)
          return true // show undated orders rather than hiding them
        }
        const od = parseLocalDate(dateStr)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        od.setHours(0, 0, 0, 0)
        const isToday = od.getTime() === today.getTime()
        if (!isToday) {
          console.log(`[Kitchen] Filtered out non-today order: ${order.customerName} - Date: ${od.toDateString()} vs Today: ${today.toDateString()}`)
        }
        return isToday
      } catch (e) {
        console.warn('[Kitchen] Error checking order date:', e)
        return true
      }
    }
    
    // Helper to check if order has a final status (should not appear in kitchen)
    // Note: 'complete' means cooked but not yet delivered, so it SHOULD still appear
    const isFinalStatus = (order: CustomerOrder) => {
      const s = (order.status || '').toLowerCase()
      // Hide delivered, served, and ALL spellings of cancelled
      const isFinal = s === 'delivered' || s === 'served' || s === 'cancelled' || s === 'canceled'
      if (isFinal) {
        console.log(`[Kitchen] Filtered out final status: ${order.customerName} - Status: ${order.status}`)
      }
      return isFinal
    }
  
  // Filter orders: not final status first (always), then today only, then meal type
    const filtered = allOrders
      .filter(order => {
        // ALWAYS hide delivered/cancelled/served regardless of date — check this first
        if (isFinalStatus(order)) return false

        // Only show today's orders for non-final statuses
        if (!isOrderForToday(order)) return false
        
        // Check meal type filter
        const matchesMealType = filterMealType === "all" || 
          (order.mealType && order.mealType.toLowerCase() === filterMealType) ||
          (order.originalMealType && order.originalMealType.toLowerCase() === filterMealType)
        if (!matchesMealType) return false
        
        return true
      })
      // Sort orders: incomplete first, then complete, both sorted by time (newest first)
      .sort((a, b) => {
        // If one is complete and the other isn't, incomplete comes first
        if ((a.status === 'complete' || a.status === 'ready') && b.status !== 'complete' && b.status !== 'ready') return 1
        if (a.status !== 'complete' && a.status !== 'ready' && (b.status === 'complete' || b.status === 'ready')) return -1
        
        // If both have the same status, sort by time (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
    
    try {
      setTodayOrders(JSON.parse(JSON.stringify(filtered)))
    } catch {
      setTodayOrders(filtered)
    }
    console.log(`[Kitchen] loadData complete: ${allOrders.length} total orders → ${filtered.length} today's orders for meal type "${filterMealTypeRef.current}"`,)
    } finally {
      isLoadingRef.current = false
    }
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
    fetchOrdersNow().catch(() => {}) // instant cross-admin sync
    fetchKitchenNow().catch(() => {}) // instant kitchen sync
    loadData()
    updateMealType()

    // Update meal type every minute
    const mealTypeInterval = setInterval(updateMealType, 60000)
    // also refresh order data periodically (ensures overnight/day‑change cleanup and delivered orders disappear)
    const dataInterval = setInterval(loadData, 60000)

    const handleUpdate = () => { loadData() }
    // firebase-orders-updated: RTDB pushed fresh data — reload immediately
    // This ensures deleted orders disappear on all clients as soon as Firebase fires
    const handleFirebaseOrders = (ev: Event) => {
      const detail = (ev as CustomEvent).detail
      if (detail?.orders) {
        // Directly invalidate in-memory cache so next loadData() reads fresh array
        if (typeof window !== 'undefined') {
          try { localStorage.setItem("yellowbell_customer_orders", JSON.stringify(detail.orders)) } catch {}
        }
      }
      loadData()
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener("kitchen-updated", handleUpdate)
      window.addEventListener("orders-updated", handleUpdate)
      window.addEventListener("customer-orders-updated", handleUpdate)
      window.addEventListener("inventory-updated", handleUpdate)
      window.addEventListener("delivery-updated", handleUpdate)
      window.addEventListener("storage", handleUpdate)
      window.addEventListener("firebase-orders-updated", handleFirebaseOrders)
      window.addEventListener("firebase-kitchen-updated", handleUpdate)
    } else {
      console.warn('[kitchen-page] window.addEventListener is not available in this environment')
    }

    // Set up email notification checker - checks every 5 minutes for orders that need reminders
    // also run immediately on load so first reminder doesn't wait 5 minutes
    (async () => {
      const orders = getActiveOrders()
      try {
        const recipients = await getAdminEmails()
        for (const r of recipients) {
          await checkAndSendFoodPreparationReminder(orders, r)
          await checkAndSendAdvancedOrderNotifications(orders, r)
        }
      } catch (e) {
        console.warn('[kitchen-page] error fetching admin emails for initial reminders', e)
      }
    })()

    const notificationCheckInterval = setInterval(async () => {
      const orders = getActiveOrders()
      try {
        // If an admin is logged in, send the immediate food-prep reminder only to that admin,
        // but ensure advanced reminders (1-day / 1-hour) are broadcast to all admin emails.
        if (auth && auth.user && auth.user.email) {
          // Send immediate prep reminder to the logged-in admin
          await checkAndSendFoodPreparationReminder(orders, auth.user.email)

          // Broadcast advanced reminders to all admins
          try {
            const allAdmins = await getAdminEmails()
            for (const a of allAdmins) {
              await checkAndSendAdvancedOrderNotifications(orders, a)
            }
          } catch (innerErr) {
            console.warn('[kitchen-page] error fetching admin emails for advanced reminders', innerErr)
          }
        } else {
          // No single logged-in admin: send both types to all admins
          const admins = await getAdminEmails()
          if (admins.length === 0) {
            console.log('[kitchen-page] 🔄 No admin emails available for reminders')
            return
          }
          for (const a of admins) {
            await checkAndSendFoodPreparationReminder(orders, a)
            await checkAndSendAdvancedOrderNotifications(orders, a)
          }
        }
      } catch (e) {
        console.warn('[kitchen-page] error preparing recipient list for reminders', e)
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    // In-app reminder check every minute (for 30-min, 10-min, overdue alerts)
    checkAndFireOrderReminders() // run immediately on load
    const reminderCheckInterval = setInterval(() => {
      checkAndFireOrderReminders()
    }, 60 * 1000) // Check every minute

    // Reset notification state at midnight (new day)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const msUntilMidnight = tomorrow.getTime() - now.getTime()
    
    const midnightResetTimeout = setTimeout(() => {
      resetNotificationState()
      resetAdvancedNotificationState()
      resetOrderReminders()
      // And reset again every 24 hours
      setInterval(() => {
        resetNotificationState()
        resetAdvancedNotificationState()
        resetOrderReminders()
      }, 24 * 60 * 60 * 1000)
    }, msUntilMidnight)

    return () => {
      clearInterval(mealTypeInterval)
      clearInterval(dataInterval)
      clearInterval(notificationCheckInterval)
      clearInterval(reminderCheckInterval)
      clearTimeout(midnightResetTimeout)
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener("kitchen-updated", handleUpdate)
        window.removeEventListener("orders-updated", handleUpdate)
        window.removeEventListener("customer-orders-updated", handleUpdate)
        window.removeEventListener("inventory-updated", handleUpdate)
        window.removeEventListener("delivery-updated", handleUpdate)
        window.removeEventListener("storage", handleUpdate)
        window.removeEventListener("firebase-orders-updated", handleUpdate)
        window.removeEventListener("firebase-kitchen-updated", handleUpdate)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to reliably check if an order is for today using local date string (avoids timezone midnight issues)
  const isOrderForToday = (order: CustomerOrder) => {
    try {
      const od = new Date(order.createdAt)
      return od.toDateString() === new Date().toDateString()
    } catch {
      return false
    }
  }
  
  // Helper to check if a date is today (for consistent date comparisons)
  const isDateToday = (date: Date | string) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date
      return d.toDateString() === new Date().toDateString()
    } catch {
      return false
    }
  }
  
  // Only show items from today's active orders (todayOrders is already filtered: no delivered/cancelled/wrong date)
  const toCookItems = kitchenItems
    .filter((item) => {
      const order = todayOrders.find(order => order.id === item.orderId)
      if (!order) return false

      const matchesMealType = filterMealType === "all" || 
        (order.mealType && order.mealType.toLowerCase() === filterMealTypeRef.current) ||
        (order.originalMealType && order.originalMealType.toLowerCase() === filterMealTypeRef.current)
      const isNotFinal = order.status !== 'delivered' && order.status !== 'complete' && order.status !== 'ready' && order.status !== 'served'
      
      return item.status === "to-cook" && matchesMealType && isNotFinal
    })
    // Sort to put completed items at the back
    .sort((a, b) => {
      const aOrder = todayOrders.find(order => order.id === a.orderId)
      const bOrder = todayOrders.find(order => order.id === b.orderId)
      const aComplete = (aOrder?.status === 'complete' || aOrder?.status === 'ready') ? 1 : 0
      const bComplete = (bOrder?.status === 'complete' || bOrder?.status === 'ready') ? 1 : 0
      return aComplete - bComplete
    })
  
  const cookedItems = kitchenItems.filter((item) => {
    // For cooked items, search from all customerOrders (not just todayOrders which filters out 'complete')
    // so that items from complete orders still appear in Cooked Items section
    const order = customerOrders.find(order => order.id === item.orderId)
    if (!order) return false

    const matchesMealType = filterMealType === "all" || 
      (order.mealType && order.mealType.toLowerCase() === filterMealType) ||
      (order.originalMealType && order.originalMealType.toLowerCase() === filterMealType)
    const isNotDelivered = order.status !== 'delivered' && order.status !== 'served'
    // Ensure the order is from today
    const orderIsToday = isOrderForToday(order)
    
    return item.status === "cooked" && matchesMealType && isNotDelivered && orderIsToday
  })

  // Group items by name and sort by completion status
  const groupItemsByName = (items: KitchenItem[], useAllOrders: boolean = false) => {
    const grouped: Record<string, { count: number; items: KitchenItem[]; customers: string[] }> = {}
    
    // Create a map of customer names to their order status
    // For cooked items, we need to check all customer orders (not just today's non-complete ones)
    const ordersToCheck = useAllOrders ? customerOrders : todayOrders
    const customerStatus = new Map<string, boolean>()
    ordersToCheck.forEach(order => {
      customerStatus.set(order.customerName, order.status === 'complete' || order.status === 'ready' || order.status === 'delivered')
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
    
    // Group the sorted items (sum quantities)
    sortedItems.forEach(item => {
      const qty = item.quantity || 1
      if (!grouped[item.itemName]) {
        grouped[item.itemName] = { count: 0, items: [], customers: [] }
      }
      grouped[item.itemName].count += qty
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
    Object.entries(groupItemsByName(toCookItems, false)).sort(([a], [b]) => a.localeCompare(b))
  )
  const groupedCookedItems = Object.fromEntries(
    Object.entries(groupItemsByName(cookedItems, true)).sort(([a], [b]) => a.localeCompare(b))
  )

  // Initialize quantity inputs with actual group counts (avoiding infinite loop)
  const getInitialQuantity = (itemName: string, isUndo: boolean = false) => {
    const key = isUndo ? `undo-${itemName}` : itemName
    const group = isUndo ? groupedCookedItems[itemName] : groupedToCookItems[itemName]
    return quantityInputs[key] || (group ? group.count.toString() : "1")
  }

  const handleMarkAsCooked = (itemName: string, quantity: number = 1) => {
    const itemsToCook = kitchenItems.filter(item => {
      // Only include items from active today's orders (todayOrders already excludes delivered/cancelled)
      const order = todayOrders.find(order => order.id === item.orderId)
      if (!order) return false
      
      return item.status === "to-cook" && item.itemName === itemName
    })
    
    if (itemsToCook.length === 0 || quantity <= 0) return
    
    // Sort by earliest delivery time so the most urgent order gets marked first
    itemsToCook.sort((a, b) => {
      const orderA = todayOrders.find(o => o.id === a.orderId)
      const orderB = todayOrders.find(o => o.id === b.orderId)
      const timeA = orderA?.cookTime || '99:99'
      const timeB = orderB?.cookTime || '99:99'
      return timeA.localeCompare(timeB)
    })
    
    // Mark the specified number of items as cooked
    const itemsToMark = itemsToCook.slice(0, Math.min(quantity, itemsToCook.length))
    
    itemsToMark.forEach(itemToMark => {
      markItemAsCooked(itemToMark.id, 1, itemToMark.orderId)
    })
    // `markItemAsCooked` updates customer orders and kitchen items (and persists them),
    // so avoid duplicating those updates here. Just refresh local view.
    window.dispatchEvent(new Event("delivery-updated"))
    loadData()
    
    // Show success dialog
    setMarkedItemName(itemName)
    setMarkedItemQuantity(itemsToMark.length)
    setMarkedItemDialogOpen(true)
    
    // Reset quantity input
    setQuantityInputs(prev => ({ ...prev, [itemName]: "" }))
  }

  const handleMarkAllAsCooked = () => {
    const allItemsToCook = kitchenItems.filter(item => {
      // Only include items from active today's orders (todayOrders already excludes delivered/cancelled)
      const order = todayOrders.find(order => order.id === item.orderId)
      if (!order) return false
      
      return item.status === "to-cook"
    })
    
    if (allItemsToCook.length === 0) return
    
    // Mark all items as cooked
    allItemsToCook.forEach(itemToMark => {
      markItemAsCooked(itemToMark.id, 1, itemToMark.orderId)
    })
    // `markItemAsCooked` already updated orders/kitchen state and persisted them.
    // Refresh local view instead of mutating orders here.
    window.dispatchEvent(new Event("delivery-updated"))
    loadData()
    
    // Show success dialog
    setMarkedItemName("All Items")
    setMarkedItemQuantity(allItemsToCook.length)
    setMarkedItemDialogOpen(true)
    
    // Reset all quantity inputs
    setQuantityInputs({})
  }

  const handleUndoCooked = (itemName: string, quantity: number = 1) => {
    // Search all customerOrders for cooked items (complete orders are excluded from todayOrders but we still want to undo them)
    let cookedItemsForName = kitchenItems.filter(item => {
      const order = customerOrders.find(order => order.id === item.orderId)
      if (!order) return false
      // Make sure the order is from today
      if (!isOrderForToday(order)) return false
      
      return item.status === "cooked" && item.itemName === itemName && order.status !== 'delivered'
    })

    // If no cooked items from incomplete orders found, don't fall back - prevent affecting delivered orders
    if (cookedItemsForName.length === 0) {
      return
    }
    
    if (quantity <= 0) return
    
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
        const newTotalCooked = Math.max(0, (item.totalCooked || 0) - (itemToUndo.quantity || 1))
        const newPending = (item.totalOrdered || 0) - newTotalCooked
        return { ...item, status: "to-cook" as const, cookedAt: undefined, totalCooked: newTotalCooked, pending: newPending }
      }
      return item
    })
    updateKitchenItems(updated)

    // Update customer orders
    // Use ALL customer orders (not just active) so 'complete' orders can be undone
    const orders = getCustomerOrders()
    const updatedOrders = orders.map((order) => {
      // Only affect the specific order(s) that correspond to the kitchen items being undone
      const orderItemsToUndo = itemsToUndo.filter(item => item.orderId === order.id)
      if (orderItemsToUndo.length === 0) return order

      const cookedItemsArr = order.cookedItems || []
      return {
        ...order,
        cookedItems: cookedItemsArr
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
      // keep delivered orders untouched so they don't reappear
      if (order.status === 'delivered') return order

      const orderedItemsArr = order.orderedItems || []
      const cookedItemsArr = order.cookedItems || []
      const totalOrdered = orderedItemsArr.reduce((sum, item) => sum + item.quantity, 0)
      const totalCooked = cookedItemsArr.reduce((sum, item) => sum + item.quantity, 0)
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

  const completeOrders = todayOrders.filter((order) => order.status === "complete" || order.status === "ready").length
  const incompleteOrders = todayOrders.filter((order) => order.status === "incomplete").length

  // Calculate meal type counts using already-filtered todayOrders
  // todayOrders excludes delivered/served/complete/cancelled orders
  const breakfastOrders = todayOrders.filter((order) =>
    (order.mealType && order.mealType.toLowerCase() === 'breakfast') ||
    (order.originalMealType && order.originalMealType.toLowerCase() === 'breakfast')
  ).length

  const lunchOrders = todayOrders.filter((order) =>
    (order.mealType && order.mealType.toLowerCase() === 'lunch') ||
    (order.originalMealType && order.originalMealType.toLowerCase() === 'lunch')
  ).length

  const dinnerOrders = todayOrders.filter((order) =>
    (order.mealType && order.mealType.toLowerCase() === 'dinner') ||
    (order.originalMealType && order.originalMealType.toLowerCase() === 'dinner')
  ).length

  const otherOrders = customerOrders.filter((order: CustomerOrder) => {
    return isOrderForToday(order) && 
           ((order.mealType && order.mealType.toLowerCase() === 'other') ||
            (order.originalMealType && order.originalMealType.toLowerCase() === 'other'))
  }).length

  // Sort orders to ensure completed ones are at the bottom
  const sortedTodayOrders = [...todayOrders].sort((a, b) => {
    // First, sort by completion status (incomplete first, then complete)
    if ((a.status === 'complete' || a.status === 'ready') && b.status !== 'complete' && b.status !== 'ready') return 1
    if (a.status !== 'complete' && a.status !== 'ready' && (b.status === 'complete' || b.status === 'ready')) return -1
    
    // If status is the same, sort by time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedTodayOrders.length / ordersPerPage)
  const indexOfLastOrder = currentPage * ordersPerPage
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
  const currentOrders = sortedTodayOrders.slice(indexOfFirstOrder, indexOfLastOrder)

  const getMissingItems = (order: CustomerOrder) => {
    const orderedItemsArr = order.orderedItems || []
    const cookedItemsArr = order.cookedItems || []
    const missingItems = orderedItemsArr
      .map(orderedItem => {
        const cookedQty = cookedItemsArr?.find(ci => ci.name === orderedItem.name)?.quantity || 0
        const remainingQty = orderedItem.quantity - cookedQty
        return remainingQty > 0 ? { ...orderedItem, quantity: remainingQty } : null
      })
      .filter(Boolean) as typeof orderedItemsArr
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
    // If the order is already delivered, don't show details in Kitchen view
    if (order.status === 'delivered') {
      return (
        <div className="p-4 bg-muted/40 rounded-lg">
          <p className="font-medium">This order has been delivered and moved to Order History.</p>
        </div>
      )
    }
    const missingItems = getMissingItems(order)
    const isComplete = order.status === "complete" || order.status === "ready"
    const cookedItemsArr = order.cookedItems || []
    const orderedItemsArr = order.orderedItems || []
    
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
                ({orderedItemsArr.reduce((sum, item) => sum + item.quantity, 0)} items)
              </span>
            </h4>
            <div className="space-y-3">
              {[...orderedItemsArr].sort((a, b) => {
                const aCookedQty = cookedItemsArr.find((ci: any) => ci.name === a.name)?.quantity || 0
                const bCookedQty = cookedItemsArr.find((ci: any) => ci.name === b.name)?.quantity || 0
                const aIsFullyCooked = aCookedQty >= a.quantity
                const bIsFullyCooked = bCookedQty >= b.quantity

                // Sort by completion status (incomplete first, then complete)
                if (aIsFullyCooked && !bIsFullyCooked) return 1
                if (!aIsFullyCooked && bIsFullyCooked) return -1

                // If same status, sort by name
                return a.name.localeCompare(b.name)
              }).map((item, idx) => {
                const cookedQty = cookedItemsArr.find((ci: any) => ci.name === item.name)?.quantity || 0
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

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            {(!(['ready', 'delivered', 'served'] as string[]).includes(order.status)) ? (
              <Button
                onClick={() => handleMoveToDelivery(order.id)}
                disabled={!isComplete}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Ready for Delivery
              </Button>
            ) : order.status === 'ready' ? (
              <div className="flex-1 text-center py-2 bg-green-100 dark:bg-green-900/30 rounded-md">
                <span className="text-sm font-medium text-green-700">✓ Ready for Delivery</span>
              </div>
            ) : null}
            
            <Button
              variant="outline"
              onClick={() => setSelectedOrder(null)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Handler to mark order as complete and ready for delivery
  const handleMoveToDelivery = async (orderId: string) => {
    try {
      const orders = getActiveOrders()
      const orderIndex = orders.findIndex(o => o.id === orderId)
      
      if (orderIndex === -1) {
        console.error("Order not found")
        return
      }

      const order = orders[orderIndex]
      const updatedOrder = {
        ...order,
        status: 'ready' as const
      }

      // Update order status
      const updatedOrders = [...orders]
      updatedOrders[orderIndex] = updatedOrder
      updateCustomerOrders(updatedOrders)

      // Sync to RTDB
      await syncOrderToRTDB(updatedOrder)
      await logOrderEvent(orderId, order.customerName, 'ready', { 
        itemsCooked: order.cookedItems.length 
      })

      // Update selected order in modal
      setSelectedOrder(updatedOrder)

      // Reload data
      loadData()
      window.dispatchEvent(new Event("customer-orders-updated"))

      console.log(`[Kitchen] Order ${order.orderNumber} moved to ready for delivery`)
    } catch (error) {
      console.error("[Kitchen] Error moving order to delivery:", error)
    }
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col justify-between items-start gap-4 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">Kitchen View</h1>
          <div className="flex flex-wrap gap-3 w-full">
            <div className="text-center bg-orange-100 dark:bg-orange-900/50 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-800 flex-1 min-w-[70px]">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-200">Breakfast</p>
              <p className="text-base md:text-lg font-bold text-orange-800 dark:text-orange-100">{breakfastOrders}</p>
            </div>
            <div className="text-center bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 flex-1 min-w-[70px]">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-200">Lunch</p>
              <p className="text-base md:text-lg font-bold text-blue-800 dark:text-blue-100">{lunchOrders}</p>
            </div>
            <div className="text-center bg-purple-100 dark:bg-purple-900/50 px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 flex-1 min-w-[70px]">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-200">Dinner</p>
              <p className="text-base md:text-lg font-bold text-purple-800 dark:text-purple-100">{dinnerOrders}</p>
            </div>
            <div className="text-center bg-teal-100 dark:bg-teal-900/50 px-3 py-2 rounded-lg border border-teal-200 dark:border-teal-800 flex-1 min-w-[70px]">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-200">Other</p>
              <p className="text-base md:text-lg font-bold text-teal-800 dark:text-teal-100">{otherOrders}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full">
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
                .map(([name, quantity]) => ({ name, quantity: quantity as number }))
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
                    const isComplete = order.status === "complete" || order.status === "ready"

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
                            {(order.orderedItems || []).map((item, idx) => (
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
                  )})}
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
            <DialogDescription className="sr-only">
              View detailed information about the selected order
            </DialogDescription>
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

      {/* Marked Item Success Dialog */}
      <Dialog open={markedItemDialogOpen} onOpenChange={setMarkedItemDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <DialogTitle className="text-center">Items Marked as Done</DialogTitle>
            <DialogDescription className="text-center">
              Successfully completed
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Item:</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">{markedItemName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Quantity:</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">{markedItemQuantity}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              The customer has been notified that their item is ready.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setMarkedItemDialogOpen(false)}
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={() => setMarkedItemDialogOpen(false)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </POSLayout>
  )
}