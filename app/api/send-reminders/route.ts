import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

/**
 * POST /api/send-reminders
 *
 * Server-side reminder engine for Yellow Roast Co.
 * - Fetches all registered user emails from Firebase RTDB
 * - Checks each order's delivery time
 * - Sends the correct reminder email (1-hour before for same-day, 2-hours before for next-day)
 * - Works entirely server-side — NO browser session required
 *
 * Call this endpoint every 5 minutes from the frontend (even on the login page),
 * or from an external cron job.
 *
 * Required env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 *   NEXT_PUBLIC_FIREBASE_DATABASE_URL  (or hardcoded fallback below)
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || ''

// Firebase Realtime Database URL — reads from env or falls back to the hardcoded project URL
const FIREBASE_DB_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  'https://inventory-system-cc7dc-default-rtdb.firebaseio.com'

// ─── CORS helpers ────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

// ─── Nodemailer transporter ───────────────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null
const getTransporter = () => {
  if (transporter) return transporter
  if (!SMTP_USER || !SMTP_PASSWORD) return null
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10000,
    socketTimeout: 10000,
  })
  return transporter
}

// ─── Philippines time helper ─────────────────────────────────────────────────
const getPHTime = () => {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  return new Date(utc + 8 * 60 * 60 * 1000)
}

const formatTime12h = (time24: string) => {
  try {
    const [h, m] = time24.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`
  } catch { return time24 }
}

const todayPHLabel = () =>
  getPHTime().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Manila',
  })

const nowPHLabel = () =>
  getPHTime().toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    timeZone: 'Asia/Manila',
  })

// ─── Meal type color schemes ──────────────────────────────────────────────────
const getMealColors = (mealType?: string) => {
  const mt = (mealType || '').toLowerCase()
  if (mt === 'breakfast') return {
    headerBg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 60%, #fde68a 100%)',
    accentColor: '#92400e', badgeBg: '#fef3c7', badgeText: '#92400e',
    badgeBorder: '#fcd34d', tableThead: '#fef3c7', theadText: '#78350f',
    tableRow1: '#fffbeb', tableRow2: '#fef9f0', tableAccent: '#f59e0b',
    footerBg: '#fef3c7', footerBorder: '#fcd34d', footerText: '#92400e',
    emoji: '🌅', label: 'BREAKFAST ORDER',
  }
  if (mt === 'lunch') return {
    headerBg: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 60%, #bae6fd 100%)',
    accentColor: '#0c4a6e', badgeBg: '#e0f2fe', badgeText: '#0c4a6e',
    badgeBorder: '#7dd3fc', tableThead: '#e0f2fe', theadText: '#0c4a6e',
    tableRow1: '#f0f9ff', tableRow2: '#e0f2fe', tableAccent: '#0284c7',
    footerBg: '#e0f2fe', footerBorder: '#7dd3fc', footerText: '#0c4a6e',
    emoji: '☀️', label: 'LUNCH ORDER',
  }
  return {
    headerBg: 'linear-gradient(135deg, #991b1b 0%, #dc2626 60%, #ef4444 100%)',
    accentColor: '#7f1d1d', badgeBg: '#fee2e2', badgeText: '#7f1d1d',
    badgeBorder: '#fca5a5', tableThead: '#fee2e2', theadText: '#7f1d1d',
    tableRow1: '#fff5f5', tableRow2: '#fef2f2', tableAccent: '#dc2626',
    footerBg: '#fee2e2', footerBorder: '#fca5a5', footerText: '#7f1d1d',
    emoji: '🌙', label: 'DINNER ORDER',
  }
}

// ─── Email wrapper ────────────────────────────────────────────────────────────
const emailWrapper = (content: string, mealType?: string) => {
  const c = getMealColors(mealType)
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Yellow Roast Co.</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
  <tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:620px;">
    <tr><td style="background:${c.headerBg};padding:36px 40px;text-align:center;">
      <img src="cid:yrclogo@yellow" alt="YRC" width="72" height="72"
           style="border-radius:12px;border:3px solid rgba(255,255,255,0.35);margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;">Yellow Roast Co.</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.88);font-size:13px;letter-spacing:1.2px;font-weight:500;">
        ${c.label} &nbsp;·&nbsp; ${c.emoji} &nbsp;KITCHEN NOTIFICATION
      </p>
    </td></tr>
    <tr><td style="background:${c.badgeBg};padding:10px 40px;border-bottom:1px solid ${c.badgeBorder};">
      <p style="margin:0;color:${c.badgeText};font-size:12px;font-weight:600;">
        📅 ${todayPHLabel()} &nbsp;&nbsp;🕐 ${nowPHLabel()} (Asia/Manila)
      </p>
    </td></tr>
    <tr><td style="padding:36px 40px;">${content}</td></tr>
    <tr><td style="background:${c.footerBg};padding:20px 40px;text-align:center;border-top:2px solid ${c.footerBorder};">
      <p style="margin:0 0 4px;color:${c.footerText};font-size:12px;font-weight:700;">🐔 YELLOW ROAST CO. — INVENTORY SYSTEM</p>
      <p style="margin:0;color:${c.footerText};font-size:11px;opacity:0.75;">This is an automated notification. Do not reply.</p>
    </td></tr>
  </table></td></tr>
</table></body></html>`
}

// ─── Build order table HTML ───────────────────────────────────────────────────
const buildOrderTable = (orders: any[], colors: ReturnType<typeof getMealColors>) => {
  if (!orders.length) return ''
  const rows = orders.map((o, i) => {
    const items = (o.orderedItems || o.items || [])
      .map((it: any) => `<strong>${it.quantity}×</strong> ${it.name}`).join(', ')
    const time = o.cookTime ? formatTime12h(o.cookTime) : '—'
    const pay = o.paymentStatus === 'paid'
      ? `<span style="color:#16a34a;font-weight:600;">✓ Paid</span>`
      : `<span style="color:#dc2626;font-weight:600;">Unpaid</span>`
    const bg = i % 2 === 0 ? colors.tableRow1 : colors.tableRow2
    return `<tr style="background:${bg};">
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-weight:600;">${o.customerName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-size:13px;">${items}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};color:${colors.tableAccent};font-weight:700;">${time}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-size:13px;">${pay}</td>
    </tr>`
  }).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid ${colors.badgeBorder};margin-top:8px;">
    <thead><tr style="background:${colors.tableThead};">
      <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Customer</th>
      <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Items</th>
      <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Delivery Time</th>
      <th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Payment</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

// ─── Send one email via nodemailer ────────────────────────────────────────────
const sendEmail = async (to: string, subject: string, html: string, text: string) => {
  const mailer = getTransporter()
  if (!mailer) {
    console.log(`[send-reminders] (simulated) To: ${to} | Subject: ${subject}`)
    return true
  }
  try {
    const fs = require('fs')
    const path = require('path')
    const logoPath = path.join(process.cwd(), 'public', 'yrclogo.jpg')
    const hasLogo = fs.existsSync(logoPath)

    const mailOptions: any = {
      from: `"Yellow Roast Co." <${SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    }
    if (hasLogo) {
      mailOptions.attachments = [{ filename: 'yrclogo.jpg', path: logoPath, cid: 'yrclogo@yellow' }]
    }

    await mailer.sendMail(mailOptions)
    console.log(`[send-reminders] ✅ Sent "${subject}" → ${to}`)
    return true
  } catch (err) {
    console.error(`[send-reminders] ❌ Failed to send to ${to}:`, err)
    return false
  }
}

// ─── Fetch all registered user emails from Firebase RTDB ─────────────────────
const fetchAllUserEmails = async (): Promise<string[]> => {
  try {
    const url = `${FIREBASE_DB_URL}/users.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Firebase returned ${res.status}`)
    const users = await res.json()
    if (!users) return []

    const emails: string[] = []
    Object.values(users).forEach((u: any) => {
      if (u && typeof u.email === 'string' && u.email.trim()) {
        emails.push(u.email.trim())
      }
    })
    // Deduplicate and add env fallback
    if (SMTP_USER) emails.push(SMTP_USER)
    const unique = Array.from(new Set(emails))
    console.log(`[send-reminders] Found ${unique.length} registered email(s):`, unique)
    return unique
  } catch (err) {
    console.error('[send-reminders] Could not fetch user emails from Firebase:', err)
    return SMTP_USER ? [SMTP_USER] : []
  }
}

// ─── Fetch pending orders from Firebase RTDB ─────────────────────────────────
const fetchPendingOrders = async (): Promise<any[]> => {
  try {
    const url = `${FIREBASE_DB_URL}/customerOrders.json`
    const res = await fetch(url)
    if (!res.ok) {
      // Try alternate key
      const url2 = `${FIREBASE_DB_URL}/orders.json`
      const res2 = await fetch(url2)
      if (!res2.ok) return []
      const data2 = await res2.json()
      return data2 ? Object.values(data2) : []
    }
    const data = await res.json()
    return data ? Object.values(data) : []
  } catch (err) {
    console.error('[send-reminders] Could not fetch orders from Firebase:', err)
    return []
  }
}

// ─── Parse local date string (YYYY-MM-DD or ISO) ─────────────────────────────
const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date()
  if (dateStr.includes('T')) return new Date(dateStr)
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ─── Determine dominant meal type for a list of orders ───────────────────────
const dominantMealType = (orders: any[]): string => {
  const counts: Record<string, number> = {}
  orders.forEach(o => {
    const mt = (o.mealType || o.originalMealType || 'dinner').toLowerCase()
    counts[mt] = (counts[mt] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'dinner'
}

// ─── In-memory sent-reminder tracking (resets on server restart/redeploy) ─────
// Key format: `${type}:${orderId}` — prevents double-sending in the same server process
const sentReminders = new Set<string>()

// ─── Main reminder logic ──────────────────────────────────────────────────────
const processReminders = async (orders: any[], emails: string[]) => {
  const now = getPHTime()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const pending = orders.filter(o => {
    const s = (o.status || '').toLowerCase()
    return s !== 'delivered' && s !== 'served' && s !== 'cancelled' && s !== 'canceled' && s !== 'complete'
  })

  // Bucket orders: same-day 1hr, same-day 2hr (tomorrow bucket), etc.
  const oneHourBucket: any[] = []
  const twoHourBucket: any[] = []

  pending.forEach(order => {
    if (!order.cookTime) return
    const orderDate = parseLocalDate(order.createdAt || order.date || '')
    const [h, m] = order.cookTime.split(':').map(Number)
    const deliveryDT = new Date(orderDate)
    deliveryDT.setHours(h, m, 0, 0)

    const msUntil = deliveryDT.getTime() - now.getTime()
    const hoursUntil = msUntil / (1000 * 60 * 60)

    // 1-hour before reminder: window 0–60 minutes
    if (hoursUntil > 0 && hoursUntil <= 1) {
      oneHourBucket.push(order)
    }
    // 2-hour before reminder: window 60–120 minutes (for next-day orders placed in advance)
    else if (hoursUntil > 1 && hoursUntil <= 2) {
      twoHourBucket.push(order)
    }
  })

  const results: string[] = []

  // ── 1-HOUR REMINDER ────────────────────────────────────────────────────────
  if (oneHourBucket.length > 0) {
    // Use order IDs as dedup key so we only send once per order
    const newOrders = oneHourBucket.filter(o => !sentReminders.has(`1hr:${o.id}`))
    if (newOrders.length > 0) {
      const mt = dominantMealType(newOrders)
      const colors = getMealColors(mt)
      const table = buildOrderTable(newOrders, colors)
      const delivTime = formatTime12h(newOrders[0].cookTime)

      const content = `
        <div style="margin-bottom:24px;">
          <div style="display:inline-block;background:#fee2e2;border:2px solid #dc2626;border-radius:20px;padding:6px 16px;margin-bottom:16px;">
            <span style="color:#991b1b;font-weight:800;font-size:12px;letter-spacing:0.5px;">🚨 1-HOUR URGENT REMINDER</span>
          </div>
          <h2 style="margin:0 0 8px;color:#991b1b;font-size:26px;font-weight:900;text-transform:uppercase;">
            ${newOrders.length} Order${newOrders.length > 1 ? 's' : ''} in 1 Hour!
          </h2>
          <p style="margin:0;color:#6b7280;font-size:14px;">
            Delivery at <strong style="color:#dc2626;font-size:18px;">${delivTime}</strong> — final preparation required NOW
          </p>
        </div>
        ${table}
        <div style="margin-top:20px;padding:18px;background:#fee2e2;border:3px solid #dc2626;border-radius:8px;text-align:center;">
          <p style="color:#7f1d1d;margin:0;font-size:16px;font-weight:800;">⚡ PACK ALL ORDERS NOW — DELIVERY IN 1 HOUR!</p>
        </div>`

      const html = emailWrapper(content, mt)
      const text = `URGENT: ${newOrders.length} order(s) due in 1 hour at ${delivTime}\n\n${newOrders.map(o => `${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any) => `${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
      const subject = `🚨 URGENT: ${newOrders.length} Order${newOrders.length > 1 ? 's' : ''} Due in 1 Hour — ${delivTime}`

      for (const email of emails) {
        await sendEmail(email, subject, html, text)
      }
      newOrders.forEach(o => sentReminders.add(`1hr:${o.id}`))
      results.push(`1hr-reminder: ${newOrders.length} orders → ${emails.length} recipients`)
    }
  }

  // ── 2-HOUR REMINDER (for advance/tomorrow orders) ──────────────────────────
  if (twoHourBucket.length > 0) {
    const newOrders = twoHourBucket.filter(o => !sentReminders.has(`2hr:${o.id}`))
    if (newOrders.length > 0) {
      const mt = dominantMealType(newOrders)
      const colors = getMealColors(mt)
      const table = buildOrderTable(newOrders, colors)
      const delivTime = formatTime12h(newOrders[0].cookTime)

      const content = `
        <div style="margin-bottom:24px;">
          <div style="display:inline-block;background:${colors.badgeBg};border:1px solid ${colors.badgeBorder};border-radius:20px;padding:6px 16px;margin-bottom:16px;">
            <span style="color:${colors.badgeText};font-weight:700;font-size:12px;letter-spacing:0.5px;">📅 2-HOUR ADVANCE REMINDER</span>
          </div>
          <h2 style="margin:0 0 8px;color:#111827;font-size:24px;font-weight:800;">
            ${newOrders.length} Order${newOrders.length > 1 ? 's' : ''} — Delivery in ~2 Hours
          </h2>
          <p style="margin:0;color:#6b7280;font-size:14px;">
            Delivery at <strong style="color:${colors.tableAccent};font-size:18px;">${delivTime}</strong> — begin preparation soon
          </p>
        </div>
        ${table}
        <div style="margin-top:20px;padding:14px 18px;background:${colors.badgeBg};border-left:4px solid ${colors.tableAccent};border-radius:0 8px 8px 0;">
          <p style="margin:0;color:${colors.badgeText};font-size:13px;font-weight:600;">
            ✅ ACTION: Delivery is in ~2 hours at ${delivTime} — begin final preparation NOW!
          </p>
        </div>`

      const html = emailWrapper(content, mt)
      const text = `REMINDER: ${newOrders.length} order(s) due in ~2 hours at ${delivTime}\n\n${newOrders.map(o => `${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any) => `${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
      const subject = `📅 2-Hr Alert: ${newOrders.length} Order${newOrders.length > 1 ? 's' : ''} Delivery in ~2 Hours — ${delivTime}`

      for (const email of emails) {
        await sendEmail(email, subject, html, text)
      }
      newOrders.forEach(o => sentReminders.add(`2hr:${o.id}`))
      results.push(`2hr-reminder: ${newOrders.length} orders → ${emails.length} recipients`)
    }
  }

  if (results.length === 0) results.push('no reminders needed at this time')
  return results
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Accept optional override emails from the request body (for testing)
    let overrideEmails: string[] | null = null
    try {
      const body = await request.json()
      if (Array.isArray(body?.emails)) overrideEmails = body.emails
    } catch { /* no body is fine */ }

    const [emails, orders] = await Promise.all([
      overrideEmails ? Promise.resolve(overrideEmails) : fetchAllUserEmails(),
      fetchPendingOrders(),
    ])

    if (emails.length === 0) {
      return NextResponse.json({ success: false, message: 'No recipient emails found' }, { headers: corsHeaders })
    }

    console.log(`[send-reminders] Processing ${orders.length} orders for ${emails.length} recipient(s)`)
    const results = await processReminders(orders, emails)

    return NextResponse.json({
      success: true,
      timestamp: nowPHLabel(),
      recipients: emails.length,
      ordersChecked: orders.length,
      actions: results,
    }, { headers: corsHeaders })

  } catch (err) {
    console.error('[send-reminders] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function GET() {
  const emails = await fetchAllUserEmails()
  const orders = await fetchPendingOrders()
  return NextResponse.json({
    status: 'ok',
    smtpConfigured: !!(SMTP_USER && SMTP_PASSWORD),
    registeredEmails: emails.length,
    pendingOrders: orders.length,
    timestamp: nowPHLabel(),
  }, { headers: corsHeaders })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}
