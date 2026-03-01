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
    
    const orderData = {
      id: order.id,
      orderNumber: order.orderNumber || "N/A",
      customerName: order.customerName,
      status: order.status,
      mealType: order.mealType || order.originalMealType || "Unknown",
      createdAt: order.createdAt,
      deliveredAt: order.status === 'delivered' ? timestamp : null,
      completedAt: order.status === 'complete' ? timestamp : null,
      items: order.orderedItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      cookedItems: order.cookedItems.map(item => ({
        name: item.name,
        quantity: item.quantity
      })),
      total: order.total,
      paymentStatus: order.paymentStatus || 'unpaid',
      paymentMethod: order.paymentMethod || 'unknown',
      deliveryMethod: order.deliveryMethod || 'hand-in',
      isDelivery: order.isDelivery || false,
      deliveryPhone: order.deliveryPhone,
      deliveryAddress: order.deliveryAddress,
      remarks: order.remarks,
      specialRequests: order.specialRequests,
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
