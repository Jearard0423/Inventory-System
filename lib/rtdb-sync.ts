// RTDB Sync for Order History and Analytics
"use client"

import { database } from "./firebase"
import { ref, set, update, remove, push } from "firebase/database"
import type { CustomerOrder } from "./inventory-store"

/**
 * Sync a completed order to RTDB for history and analytics
 * Stores orders that are moved to delivery/complete status
 */
export const syncOrderToRTDB = async (order: CustomerOrder): Promise<boolean> => {
  if (typeof window === "undefined") return false
  
  try {
    const timestamp = new Date().toISOString()
    const orderRef = ref(database, `orderHistory/${order.id}`)
    
    // Sanitize order data: avoid undefined values (Realtime DB rejects undefined)
    const safe = <T,>(v: T | undefined | null): T | null => (typeof v === 'undefined' ? null : v as T)

    const orderData = {
      id: safe(order.id),
      orderNumber: safe(order.orderNumber) || "N/A",
      customerName: safe(order.customerName) || "",
      status: safe(order.status) || null,
      mealType: safe(order.mealType) || safe(order.originalMealType) || "Unknown",
      createdAt: safe(order.createdAt) || null,
      deliveredAt: order.status === 'delivered' ? timestamp : null,
      completedAt: order.status === 'complete' ? timestamp : null,
      items: (order.orderedItems || []).map(item => ({
        name: item.name || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : 0,
        price: typeof item.price === 'number' ? item.price : 0
      })),
      cookedItems: (order.cookedItems || []).map(item => ({
        name: item.name || '',
        quantity: typeof item.quantity === 'number' ? item.quantity : 0
      })),
      total: typeof order.total === 'number' ? order.total : 0,
      paymentStatus: safe(order.paymentStatus) || 'unpaid',
      paymentMethod: safe(order.paymentMethod) || 'unknown',
      deliveryMethod: safe(order.deliveryMethod) || 'hand-in',
      isDelivery: !!order.isDelivery,
      deliveryPhone: safe(order.deliveryPhone),
      deliveryAddress: safe(order.deliveryAddress),
      remarks: safe(order.remarks),
      specialRequests: safe(order.specialRequests),
    }
    
    await set(orderRef, orderData)
    console.log(`[RTDB Sync] Order synced: ${order.orderNumber} - ${order.customerName}`)
    return true
  } catch (error) {
    console.error("[RTDB Sync] Error syncing order:", error)
    return false
  }
}

/**
 * Sync multiple orders to RTDB (for batch operations)
 */
export const syncOrdersToRTDB = async (orders: CustomerOrder[]): Promise<number> => {
  if (typeof window === "undefined") return 0
  
  let synced = 0
  for (const order of orders) {
    const success = await syncOrderToRTDB(order)
    if (success) synced++
  }
  
  console.log(`[RTDB Sync] Batch sync complete: ${synced}/${orders.length} orders`)
  return synced
}

/**
 * Delete an order from RTDB history (if needed for data cleanup)
 */
export const removeOrderFromRTDB = async (orderId: string): Promise<boolean> => {
  if (typeof window === "undefined") return false
  
  try {
    const orderRef = ref(database, `orderHistory/${orderId}`)
    await remove(orderRef)
    console.log(`[RTDB Sync] Order removed: ${orderId}`)
    return true
  } catch (error) {
    console.error("[RTDB Sync] Error removing order:", error)
    return false
  }
}

/**
 * Log order event to RTDB analytics
 */
export const logOrderEvent = async (
  orderId: string,
  customerName: string,
  eventType: 'created' | 'cooking' | 'ready' | 'completed' | 'delivered',
  details?: Record<string, any>
): Promise<boolean> => {
  if (typeof window === "undefined") return false
  
  try {
    const eventsRef = ref(database, `orderEvents/${orderId}`)
    const newEventRef = push(eventsRef)
    
    const eventData = {
      type: eventType,
      customerName,
      timestamp: new Date().toISOString(),
      details: details || {}
    }
    
    await set(newEventRef, eventData)
    console.log(`[RTDB Analytics] Event logged: ${eventType} - ${orderId}`)
    return true
  } catch (error) {
    console.error("[RTDB Analytics] Error logging event:", error)
    return false
  }
}

/**
 * Sync daily sales summary to RTDB
 */
export const syncDailySummary = async (
  date: string,
  totalOrders: number,
  totalRevenue: number,
  completedOrders: number
): Promise<boolean> => {
  if (typeof window === "undefined") return false
  
  try {
    const summaryRef = ref(database, `dailySummary/${date}`)
    const summaryData = {
      date,
      totalOrders,
      totalRevenue,
      completedOrders,
      timestamp: new Date().toISOString()
    }
    
    await set(summaryRef, summaryData)
    console.log(`[RTDB Sync] Daily summary updated: ${date}`)
    return true
  } catch (error) {
    console.error("[RTDB Sync] Error syncing daily summary:", error)
    return false
  }
}
