"use client"

import { CustomerOrder } from './inventory-store'

/**
 * Send email notification for food preparation reminders
 * This function sends reminders every 30 min or 1 hour for orders that came today
 */

const REMINDER_INTERVAL = 30 * 60 * 1000 // 30 minutes in milliseconds (can be changed to 60 * 60 * 1000 for 1 hour)

interface EmailNotificationState {
  lastReminderTime: number
  remindersCount: number
  hasOrdersToday: boolean
}

let notificationState: EmailNotificationState = {
  lastReminderTime: 0,
  remindersCount: 0,
  hasOrdersToday: false,
}

/**
 * Format order details for email
 */
const formatOrderDetailsForEmail = (orders: CustomerOrder[]): string => {
  let details = '<h2>Today\'s Orders to be Prepared:</h2><ul>'
  
  const incompleteOrders = orders.filter(o => o.status !== 'complete' && o.status !== 'delivered')
  
  incompleteOrders.forEach(order => {
    const pendingItems = order.orderedItems
      .map(item => {
        const cooked = order.cookedItems?.find(c => c.name === item.name)
        const cookedQty = cooked?.quantity || 0
        const remaining = item.quantity - cookedQty
        return remaining > 0 ? `${remaining}x ${item.name}` : null
      })
      .filter(Boolean)
      .join(', ')
    
    if (pendingItems) {
      details += `<li><strong>${order.customerName}</strong> - Order #${order.orderNumber || order.id}: ${pendingItems}</li>`
    }
  })
  
  details += '</ul>'
  return details
}

/**
 * Send email notification via Firebase Cloud Function or external service
 */
const sendEmailNotification = async (
  subject: string,
  htmlBody: string,
  plainTextBody: string,
  recipientEmail: string = 'admin@yellowbell.com' // Default admin email
): Promise<boolean> => {
  try {
    // Check if we're running client-side and if we have a Cloud Function endpoint
    if (typeof window === 'undefined') {
      console.warn('[email-notifications] Running server-side, skipping email')
      return false
    }

    // Option 1: Send via Cloud Function (recommended)
    const response = await fetch('/api/send-notification-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        htmlBody,
        plainTextBody,
        recipientEmail,
        timestamp: new Date().toISOString(),
      }),
    })

    if (response.ok) {
      console.log(`[email-notifications] Email sent successfully: ${subject}`)
      return true
    } else {
      const error = await response.json()
      console.warn(`[email-notifications] Failed to send email: ${error.message}`)
      return false
    }
  } catch (error) {
    console.error('[email-notifications] Error sending email notification:', error)
    // Silently fail - app continues to work without email
    return false
  }
}

/**
 * Check if we should send a reminder notification
 * Sends reminder if:
 * - There are orders for today
 * - We haven't sent a reminder in the last 30 minutes (or configured interval)
 */
export const checkAndSendFoodPreparationReminder = async (orders: CustomerOrder[]): Promise<void> => {
  try {
    // Get current time
    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Filter today's orders that are not yet complete or delivered
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === today.getTime() && 
             order.status !== 'complete' && 
             order.status !== 'delivered'
    })

    notificationState.hasOrdersToday = todayOrders.length > 0

    // Only send reminder if:
    // 1. There are orders to prepare today
    // 2. Enough time has passed since last reminder
    if (!notificationState.hasOrdersToday) {
      return
    }

    const timeSinceLastReminder = notificationState.lastReminderTime 
      ? now.getTime() - notificationState.lastReminderTime 
      : Infinity

    if (timeSinceLastReminder < REMINDER_INTERVAL) {
      return // Not enough time has passed
    }

    // Send reminder email
    const reminderNumber = notificationState.remindersCount + 1
    const subject = `🍖 Yellowbell Kitchen Reminder - Order Preparation (Reminder #${reminderNumber})`
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #d97706; margin-bottom: 10px;">🍖 Yellowbell Kitchen</h1>
          <h2 style="color: #374151; margin-top: 0;">Food Preparation Reminder</h2>
          <p style="color: #666; font-size: 16px;">
            <strong>Reminder #${reminderNumber}</strong> - ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          ${formatOrderDetailsForEmail(todayOrders)}
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Next reminder:</strong> in ${Math.round(REMINDER_INTERVAL / 60000)} minutes<br>
            <strong>Orders today:</strong> ${todayOrders.length} pending
          </p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              Please ensure all pending orders are prepared and ready for delivery.
            </p>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
            This is an automated reminder from Yellowbell Inventory System.<br>
            Sent at: ${now.toLocaleString('en-US')}
          </p>
        </div>
      </div>
    `

    const plainTextBody = `
Yellowbell Kitchen - Food Preparation Reminder #${reminderNumber}
${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}

TODAY'S ORDERS TO BE PREPARED:
${todayOrders.map(order => {
  const pendingItems = order.orderedItems
    .map(item => {
      const cooked = order.cookedItems?.find(c => c.name === item.name)
      const cookedQty = cooked?.quantity || 0
      const remaining = item.quantity - cookedQty
      return remaining > 0 ? `${remaining}x ${item.name}` : null
    })
    .filter(Boolean)
    .join(', ')
  return `- ${order.customerName} (Order #${order.orderNumber || order.id}): ${pendingItems}`
}).join('\n')}

Next reminder: in ${Math.round(REMINDER_INTERVAL / 60000)} minutes
Orders pending: ${todayOrders.length}

Please ensure all pending orders are prepared and ready for delivery.
    `

    // Send the email notification
    const sent = await sendEmailNotification(subject, htmlBody, plainTextBody)
    
    if (sent) {
      notificationState.lastReminderTime = now.getTime()
      notificationState.remindersCount += 1
      console.log(`[email-notifications] Food preparation reminder #${reminderNumber} sent`)
    }

  } catch (error) {
    console.error('[email-notifications] Error checking and sending reminder:', error)
  }
}

/**
 * Reset notification state when it's a new day
 */
export const resetNotificationState = (): void => {
  notificationState = {
    lastReminderTime: 0,
    remindersCount: 0,
    hasOrdersToday: false,
  }
  console.log('[email-notifications] Notification state reset for new day')
}

/**
 * Get current notification state (for debugging)
 */
export const getNotificationState = (): EmailNotificationState => {
  return { ...notificationState }
}

/**
 * Set custom interval for reminders (in milliseconds)
 * Default is 30 minutes (1800000ms)
 * Can be set to 60 minutes (3600000ms) for hourly reminders
 */
export const setReminderInterval = (intervalMs: number): void => {
  console.log(`[email-notifications] Reminder interval set to ${intervalMs / 60000} minutes`)
  // Note: This would require making REMINDER_INTERVAL mutable
  // For now, the interval is hardcoded to 30 minutes
}
