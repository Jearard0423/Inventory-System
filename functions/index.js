let functions = null
let admin = null
try {
  functions = require("firebase-functions")
} catch (e) {
  console.warn("firebase-functions not installed — using minimal mock for local tests")
  functions = {
    config: () => ({}),
    pubsub: { schedule: () => ({ onRun: () => {} }) },
  }
}

try {
  admin = require("firebase-admin")
} catch (e) {
  console.warn("firebase-admin not installed — using minimal mock for local tests")
  admin = {
    initializeApp: () => {},
    database: () => ({ ref: () => ({ once: async () => ({ exists: () => false, val: () => ({}) }) }) }),
  }
}
let sgMail = null
try {
  sgMail = require("@sendgrid/mail")
} catch (e) {
  console.warn("@sendgrid/mail not installed — email send will be disabled for local tests")
}

// Initialize admin SDK
try {
  admin.initializeApp()
} catch (e) {
  // already initialized in emulator or repeated import
}

// Configure SendGrid from env var
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || process.env.SENDGRID_KEY || functions.config().sendgrid?.key
if (SENDGRID_KEY && sgMail) sgMail.setApiKey(SENDGRID_KEY)

// Helper to send an email via SendGrid
async function sendEmail(to, subject, htmlContent, plainText) {
  if (!SENDGRID_KEY || !sgMail) {
    console.warn("SendGrid not configured or module missing — skipping email to", to)
    return
  }
  const msg = {
    to,
    from: process.env.SENDGRID_FROM || functions.config().sendgrid?.from || "no-reply@example.com",
    subject,
    text: plainText || "",
    html: htmlContent,
  }

  await sgMail.send(msg)
}

// Export helpers for local testing
module.exports.buildOrderEmail = buildOrderEmail
module.exports.sendEmail = sendEmail

// Format order notification email
function buildOrderEmail(order, businessLogoUrl) {
  const when = new Date(order.date).toLocaleString()
  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb">${i.name}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${i.quantity}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">₱${(i.price||0).toFixed(2)}</td>
    </tr>`).join("")

  const total = (order.total || 0).toFixed(2)

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827">
      <div style="display:flex;align-items:center;gap:12px">
        ${businessLogoUrl ? `<img src="${businessLogoUrl}" alt="logo" style="height:48px;"/>` : ""}
        <h2 style="margin:0">New order scheduled</h2>
      </div>
      <p>Who: <strong>${order.customerName || "Customer"}</strong></p>
      <p>When: <strong>${when}</strong></p>
      <h4>Items</h4>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border:1px solid #e5e7eb">Item</th>
            <th style="text-align:center;padding:8px;border:1px solid #e5e7eb">Qty</th>
            <th style="text-align:right;padding:8px;border:1px solid #e5e7eb">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb"></td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right"><strong>Total</strong></td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right"><strong>₱${total}</strong></td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:12px;color:#6b7280;font-size:13px">This is an automated reminder.</p>
    </div>
  `

  return html
}

// Scheduled function runs every minute, checks orders in RTDB, sends reminders
exports.scheduledOrderNotifier = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  if (!SENDGRID_KEY) {
    console.log('SendGrid key not configured. Skipping email sends.')
  }

  const db = admin.database()
  const ordersSnap = await db.ref('inventories/orders').once('value')
  const usersSnap = await db.ref('users').once('value')

  const orders = ordersSnap.exists() ? ordersSnap.val() : {}
  const users = usersSnap.exists() ? usersSnap.val() : {}

  // Gather admin emails from users node (role === 'admin' or 'staff')
  const recipientEmails = []
  Object.values(users).forEach(u => {
    if (u && (u.role === 'admin' || u.role === 'staff') && u.email) recipientEmails.push(u.email)
  })

  // If no admin users, fallback to configured FROM as recipient (not ideal)
  if (recipientEmails.length === 0) {
    const fallback = process.env.SENDGRID_FALLBACK_TO
    if (fallback) recipientEmails.push(fallback)
  }

  const now = Date.now()

  for (const [orderId, order] of Object.entries(orders)) {
    try {
      const orderObj = order || {}
      if (!orderObj.date) continue

      const orderDate = new Date(orderObj.date).getTime()
      const diffMs = orderDate - now
      const diffMin = Math.round(diffMs / 60000)

      const notifications = orderObj.notifications || {}

      // Send 60-minute reminder if within window and not yet sent
      if (diffMin <= 60 && diffMin > 59 && !notifications['1h']) {
        const html = buildOrderEmail(orderObj, process.env.BUSINESS_LOGO_URL || functions.config().app?.logo)
        const subject = `Upcoming order in 1 hour — ${orderObj.customerName || ''}`
        await Promise.all(recipientEmails.map(email => sendEmail(email, subject, html)))
        await db.ref(`inventories/orders/${orderId}/notifications/1h`).set(true)
        console.log(`Sent 1h reminder for order ${orderId}`)
      }

      // Send 30-minute reminder (window 30-29 mins)
      if (diffMin <= 30 && diffMin > 29 && !notifications['30m']) {
        const html = buildOrderEmail(orderObj, process.env.BUSINESS_LOGO_URL || functions.config().app?.logo)
        const subject = `Upcoming order in 30 minutes — ${orderObj.customerName || ''}`
        await Promise.all(recipientEmails.map(email => sendEmail(email, subject, html)))
        await db.ref(`inventories/orders/${orderId}/notifications/30m`).set(true)
        console.log(`Sent 30m reminder for order ${orderId}`)
      }
    } catch (err) {
      console.error('Error handling order notify for', orderId, err)
    }
  }

  return null
})
