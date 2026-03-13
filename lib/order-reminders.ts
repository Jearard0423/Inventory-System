"use client"

import { saveNotification, getNotifications } from "./notifications-store"
import { getCustomerOrders } from "./inventory-store"

const REMINDER_SENT_KEY = "yellowbell_reminder_sent_v1"

/**
 * Get the set of reminder keys already sent (to avoid duplicates)
 */
const getSentReminders = (): Set<string> => {
  if (typeof window === "undefined") return new Set()
  const stored = localStorage.getItem(REMINDER_SENT_KEY)
  return stored ? new Set(JSON.parse(stored)) : new Set()
}

const markReminderSent = (key: string) => {
  if (typeof window === "undefined") return
  const sent = getSentReminders()
  sent.add(key)
  localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify(Array.from(sent)))
}

/**
 * Reset sent reminders (call at midnight or on new day)
 */
export const resetOrderReminders = () => {
  if (typeof window === "undefined") return
  localStorage.removeItem(REMINDER_SENT_KEY)
}

/**
 * Parse cookTime string "HH:MM" into a Date object for today (PH time)
 */
const parseCookTimeToday = (cookTime: string): Date | null => {
  try {
    const [hours, minutes] = cookTime.split(":").map(Number)
    if (isNaN(hours) || isNaN(minutes)) return null
    const now = new Date()
    const d = new Date(now)
    d.setHours(hours, minutes, 0, 0)
    return d
  } catch {
    return null
  }
}

/**
 * Parse delivery date from an order's date string
 */
const parseOrderDate = (dateStr: string): Date | null => {
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Check orders and fire in-app reminder notifications based on timing:
 * - 1 day before delivery: reminds the next day
 * - 2 hours before: alert getting ready
 * - 30 minutes before: urgent reminder
 * Also shows a "just placed" reminder 5 minutes after order is created
 */
export const checkAndFireOrderReminders = () => {
  if (typeof window === "undefined") return

  const orders = getCustomerOrders()
  const now = new Date()
  const sentReminders = getSentReminders()

  orders.forEach((order) => {
    // Skip all finalized orders — never fire reminders for these
    const s = (order.status || "").toLowerCase()
    if (s === "delivered" || s === "complete" || s === "served" ||
        s === "cancelled" || s === "canceled" || s === "ready") return
    if (!order.cookTime) return

    const deliveryTime = parseCookTimeToday(order.cookTime)
    if (!deliveryTime) return

    // Handle multi-day orders - parse the order creation date
    const orderDate = order.createdAt ? parseOrderDate(order.createdAt) : null

    // If the order has a date and it's not today, adjust deliveryTime
    if (orderDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const odDay = new Date(orderDate)
      odDay.setHours(0, 0, 0, 0)

      const diffDays = Math.round((odDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        // 1 day before - send "tomorrow" reminder once
        const reminderKey = `tomorrow-${order.id}`
        if (!sentReminders.has(reminderKey)) {
          saveNotification({
            type: "order",
            title: "📅 Order Due Tomorrow",
            message: `Reminder: ${order.customerName}'s order is scheduled for tomorrow at ${order.cookTime}. Start preparations early!`,
            priority: "medium",
            data: { orderId: order.id, orderNumber: order.orderNumber },
          })
          markReminderSent(reminderKey)
        }
        return
      }

      if (diffDays > 1) {
        // Future order - no reminder yet
        return
      }
    }

    // Today's order - check time-based reminders
    const msUntilDelivery = deliveryTime.getTime() - now.getTime()
    const minutesUntil = msUntilDelivery / (1000 * 60)
    const name = order.customerName || "Unknown customer"
    const orderNum = order.orderNumber ? `#${order.orderNumber}` : ""
    const itemsSummary = order.orderedItems && order.orderedItems.length > 0
      ? order.orderedItems.slice(0, 3).map((i: any) => `${i.quantity}× ${i.name}`).join(", ")
      : ""

    // 2 hours before (between 115-125 minutes)
    const twoHourKey = `2hr-${order.id}-${deliveryTime.toDateString()}`
    if (minutesUntil >= 110 && minutesUntil <= 130 && !sentReminders.has(twoHourKey)) {
      saveNotification({
        type: "order",
        title: `⏰ Order in 2 Hours`,
        message: `${name} ${orderNum} is due at ${order.cookTime}. Items: ${itemsSummary}`,
        priority: "medium",
        data: { orderId: order.id },
      })
      markReminderSent(twoHourKey)
    }

    // 30 minutes before (between 25-35 minutes)
    const thirtyMinKey = `30min-${order.id}-${deliveryTime.toDateString()}`
    if (minutesUntil >= 25 && minutesUntil <= 35 && !sentReminders.has(thirtyMinKey)) {
      saveNotification({
        type: "order",
        title: `🚨 Order Due in 30 Minutes!`,
        message: `${name} ${orderNum} is due at ${order.cookTime}. Get ready! Items: ${itemsSummary}`,
        priority: "high",
        data: { orderId: order.id },
      })
      markReminderSent(thirtyMinKey)
    }

    // 10 minutes before (between 8-12 minutes)
    const tenMinKey = `10min-${order.id}-${deliveryTime.toDateString()}`
    if (minutesUntil >= 8 && minutesUntil <= 12 && !sentReminders.has(tenMinKey)) {
      saveNotification({
        type: "order",
        title: `🔔 Order Due in 10 Minutes!`,
        message: `${name} ${orderNum} is almost due at ${order.cookTime}! Items: ${itemsSummary}`,
        priority: "high",
        data: { orderId: order.id },
      })
      markReminderSent(tenMinKey)
    }

    // Overdue (0-15 minutes past due time, only once)
    const overdueKey = `overdue-${order.id}-${deliveryTime.toDateString()}`
    if (minutesUntil < 0 && minutesUntil > -15 && !sentReminders.has(overdueKey)) {
      saveNotification({
        type: "order",
        title: `❗ Order Overdue!`,
        message: `${name} ${orderNum} was due at ${order.cookTime} and hasn't been marked delivered. Items: ${itemsSummary}`,
        priority: "high",
        data: { orderId: order.id },
      })
      markReminderSent(overdueKey)
    }
  })
}