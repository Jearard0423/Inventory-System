"use client"

import { CustomerOrder } from './inventory-store'

/**
 * Email Notification Service – Yellow Roast Co.
 * Sends preparation reminders to the admin 30 min or 1 hr after an order is placed.
 * Also sends an instant notification when a new order is placed.
 */

let REMINDER_INTERVAL = 30 * 60 * 1000 // 30 minutes (change to 60 * 60 * 1000 for 1 hour)

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

const todayLabel = () =>
  new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

const nowLabel = () =>
  new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })

/** Yellow Roast Co. branded email wrapper */
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Yellow Roast Co.</title>
</head>
<body style="margin:0;padding:0;background-color:#fef9f0;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef9f0;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);padding:28px 32px;text-align:center;">
              <img src="https://i.imgur.com/YOUR-YRC-LOGO.png" alt="Yellow Roast Co. Logo" style="width: 60px; height: 60px; margin-bottom: 12px; border-radius: 8px;" />
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.5px;">Yellow Roast Co.</h1>
              <p style="margin:4px 0 0;color:#fef3c7;font-size:13px;">Premium Roasted Chicken & More</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fecaca;padding:18px 32px;text-align:center;border-top:1px solid #fca5a5;">
              <p style="margin:0;color:#991b1b;font-size:12px;">
                This is an automated notification from <strong>Yellow Roast Co.</strong> Inventory System.<br/>
                Sent on ${todayLabel()} at ${nowLabel()}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

/**
 * Format order details for email
 */
const formatOrderDetailsForEmail = (orders: CustomerOrder[]): string => {
  let details = `<table width="100%" cellpadding="0" cellspacing="0">`

  const incompleteOrders = orders.filter(o => o.status !== 'complete' && o.status !== 'delivered')

  incompleteOrders.forEach(order => {
    const pendingItems = order.orderedItems
      .map(item => {
        const cooked = order.cookedItems?.find(c => c.name === item.name)
        const cookedQty = cooked?.quantity || 0
        const remaining = item.quantity - cookedQty
        return remaining > 0 ? `<li style="margin:2px 0;color:#374151">${remaining}\u00d7 ${item.name}</li>` : null
      })
      .filter(Boolean)
      .join('')

    if (pendingItems) {
      details += `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
            <strong style="color:#1f2937;font-size:15px">${order.customerName}</strong>
            <span style="color:#6b7280;font-size:12px;margin-left:8px">Order #${order.orderNumber || order.id}</span>
            <ul style="margin:6px 0 0 16px;padding:0;font-size:14px">${pendingItems}</ul>
          </td>
        </tr>`
    }
  })

  details += `</table>`
  return details
}

const sendEmailNotification = async (
  subject: string,
  htmlBody: string,
  plainTextBody: string,
  recipientEmail: string
): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') return false

    const response = await fetch('/api/send-notification-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, htmlBody, plainTextBody, recipientEmail, timestamp: new Date().toISOString() }),
    })

    if (response.ok) {
      console.log(`[email-notifications] Sent: ${subject}`)
      return true
    }
    const err = await response.json().catch(() => ({}))
    console.warn(`[email-notifications] Failed: ${err.message || response.statusText}`)
    return false
  } catch (error) {
    console.error('[email-notifications] Error:', error)
    return false
  }
}

/**
 * Check if we should send a reminder notification
 * Sends reminder if:
 * - There are orders for today
 * - We haven't sent a reminder in the last 30 minutes (or configured interval)
 */
export const checkAndSendFoodPreparationReminder = async (orders: CustomerOrder[], recipientEmail?: string): Promise<void> => {
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

    // Also gather any future/advanced orders (for awareness)
    const advancedOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() > today.getTime() &&
             order.status !== 'complete' &&
             order.status !== 'delivered'
    })

    notificationState.hasOrdersToday = todayOrders.length > 0 || advancedOrders.length > 0

    // Only send reminder if there are orders (today or advanced) and interval passed
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
    const subject = `YellowBell Roast Co. Kitchen Reminder - Order Preparation (Reminder #${reminderNumber})`
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="text-align:center; margin-bottom: 10px;">
            <h1 style="margin:0; color:#d97706; font-size:24px;">YellowBell Roast Co.</h1>
            <img src="https://your-domain.com/logo.png" alt="Yellowbell Logo" style="height:50px; margin-top:5px;" />
          </div>
          <p style="color: #666; font-size: 16px; margin-top:15px;">
            <strong>Reminder #${reminderNumber}</strong> &ndash; ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
          <p style="color:#444; font-size:14px;">
            Orders below are scheduled for today. Please prepare them in time for delivery. A new reminder will be sent every ${Math.round(REMINDER_INTERVAL / 60000)} minutes.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          ${formatOrderDetailsForEmail(todayOrders)}
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="color: #666; font-size: 14px; margin-top: 10px;">
            <strong>Next reminder:</strong> in ${Math.round(REMINDER_INTERVAL / 60000)} minutes<br>
            <strong>Pending orders:</strong> ${todayOrders.length}
          </p>
          
          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              Please ensure all pending orders are prepared and ready before delivery time.
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
YellowBell Roast Co. Kitchen Reminder #${reminderNumber}
${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}

Orders to prepare today:
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

Please ensure all pending orders are prepared and ready before delivery time.
    `

    // determine who to send to (fallback to default admin)
    const to = recipientEmail || 'admin@yellowbell.com'
    // Send the email notification
    const sent = await sendEmailNotification(subject, htmlBody, plainTextBody, to)
    
    if (sent) {
      notificationState.lastReminderTime = now.getTime()
      notificationState.remindersCount += 1
      console.log(`[email-notifications] Food preparation reminder #${reminderNumber} sent to ${to}`)
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
  REMINDER_INTERVAL = intervalMs
  console.log(`[email-notifications] Reminder interval set to ${intervalMs / 60000} minutes`)
}

/**
 * Immediately notify when a new order for today is placed.
 * `order` may be a CustomerOrder or plain Order object – only the
 * date, customerName and items fields are used.
 * If no valid recipientEmail is provided nothing will be sent.
 */
export const sendOrderPlacedNotification = async (
  order: { date: string; customerName: string; items: Array<{ name: string; quantity: number }> },
  recipientEmail?: string
): Promise<void> => {
  if (!recipientEmail) return
  try {
    // only notify for orders with a date equal to today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const orderDate = new Date(order.date)
    orderDate.setHours(0, 0, 0, 0)
    if (orderDate.getTime() !== today.getTime()) return

    const subject = `🆕 New Order Received for Today`;
    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">🐔</div>
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">New Order Received</h2>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">${todayLabel()} at ${nowLabel()}</p>
      </div>

      <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="color: #991b1b; margin: 0 0 12px; font-size: 18px;">👤 Customer: ${order.customerName}</h3>
        <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #d97706;">
          <h4 style="color: #374151; margin: 0 0 12px; font-size: 16px;">📋 Order Details:</h4>
          <ul style="margin: 0; padding-left: 20px;">
            ${order.items
              .map(i => `<li style="color: #374151; margin-bottom: 4px;">${i.quantity}× ${i.name}</li>`)
              .join('')}
          </ul>
        </div>
      </div>

      <div style="background: #ecfdf5; border: 1px solid #d1fae5; padding: 16px; border-radius: 8px;">
        <p style="color: #065f46; margin: 0; font-size: 14px;">
          <strong>⏰ Action Required:</strong> Please prepare this order within the next ${Math.round(REMINDER_INTERVAL / 60000)} minutes.
        </p>
      </div>
    `;
    const htmlBody = emailWrapper(content);
    const plainTextBody = `Yellow Roast Co. - New Order

Customer: ${order.customerName}
Order Date: ${todayLabel()} at ${nowLabel()}

Order Details:
${order.items
  .map(i => `- ${i.quantity}x ${i.name}`)
  .join('\n')}

Please prepare this order within the next ${Math.round(REMINDER_INTERVAL / 60000)} minutes.`;

    await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail);
  } catch (err) {
    console.error('[email-notifications] Error sending new-order notification:', err)
  }
}

/**
 * Send daily reminder about upcoming orders for tomorrow
 */
export const sendUpcomingOrdersReminder = async (
  tomorrowOrders: Array<{
    customerName: string;
    items: Array<{ name: string; quantity: number }>;
    date: string;
  }>,
  recipientEmail?: string
): Promise<void> => {
  if (!recipientEmail || tomorrowOrders.length === 0) return

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowLabel = tomorrow.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const subject = `📅 Upcoming Orders for ${tomorrowLabel}`

    const content = `
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 8px;">📅</div>
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">Upcoming Orders Reminder</h2>
        <p style="color: #6b7280; margin: 4px 0 0; font-size: 14px;">${tomorrowLabel}</p>
      </div>

      <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="color: #991b1b; margin: 0 0 16px; font-size: 18px;">📋 Orders for Tomorrow (${tomorrowOrders.length} customer${tomorrowOrders.length > 1 ? 's' : ''})</h3>

        ${tomorrowOrders.map((order, index) => `
          <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #d97706;">
            <h4 style="color: #374151; margin: 0 0 8px; font-size: 16px;">${index + 1}. 👤 ${order.customerName}</h4>
            <ul style="margin: 0; padding-left: 20px;">
              ${order.items
                .map(i => `<li style="color: #374151; margin-bottom: 2px;">${i.quantity}× ${i.name}</li>`)
                .join('')}
            </ul>
          </div>
        `).join('')}
      </div>

      <div style="background: #ecfdf5; border: 1px solid #d1fae5; padding: 16px; border-radius: 8px;">
        <p style="color: #065f46; margin: 0; font-size: 14px;">
          <strong>⏰ Preparation Reminder:</strong> These orders are scheduled for tomorrow. Please ensure all ingredients and preparations are ready.
        </p>
      </div>
    `

    const htmlBody = emailWrapper(content)
    const plainTextBody = `Yellow Roast Co. - Upcoming Orders for ${tomorrowLabel}

You have ${tomorrowOrders.length} order${tomorrowOrders.length > 1 ? 's' : ''} scheduled for tomorrow:

${tomorrowOrders.map((order, index) => `
${index + 1}. ${order.customerName}
${order.items.map(i => `   - ${i.quantity}x ${i.name}`).join('\n')}
`).join('\n')}

Please ensure all ingredients and preparations are ready for tomorrow's orders.`

    await sendEmailNotification(subject, htmlBody, plainTextBody, recipientEmail)
    console.log(`[email-notifications] Sent upcoming orders reminder for ${tomorrowLabel} to ${recipientEmail}`)
  } catch (err) {
    console.error('[email-notifications] Error sending upcoming orders reminder:', err)
  }
}

/**
 * Check for orders scheduled for tomorrow and send reminder if any exist
 */
export const checkAndSendUpcomingOrdersReminder = async (
  getOrdersForDate: (date: string) => Array<{
    customerName: string;
    items: Array<{ name: string; quantity: number }>;
    date: string;
  }>,
  recipientEmail?: string
): Promise<void> => {
  if (!recipientEmail) return

  try {
    // Get tomorrow's date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0] // YYYY-MM-DD format

    // Get all orders for tomorrow
    const tomorrowOrders = getOrdersForDate(tomorrowStr)

    if (tomorrowOrders.length > 0) {
      await sendUpcomingOrdersReminder(tomorrowOrders, recipientEmail)
    }
  } catch (error) {
    console.error('[email-notifications] Error checking upcoming orders:', error)
  }
}
