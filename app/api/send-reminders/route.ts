import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

/**
 * POST /api/send-reminders
 *
 * KEY CHANGE: Orders are now sent from the frontend via POST body (from localStorage).
 * This completely bypasses the Firebase 401 issue — the server never needs to read Firebase.
 * The ReminderPoller passes current orders directly in the request body.
 *
 * For emails: tries Firebase RTDB with optional FIREBASE_DB_SECRET, falls back to SMTP_USER.
 *
 * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 * Optional: FIREBASE_DB_SECRET (legacy Firebase secret for server-side reads)
 */

const SMTP_HOST     = process.env.SMTP_HOST     || 'smtp.gmail.com'
const SMTP_PORT     = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER     = process.env.SMTP_USER     || ''
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || ''
const FIREBASE_DB_SECRET = process.env.FIREBASE_DB_SECRET || ''
const FIREBASE_DB_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  'https://inventory-system-cc7dc-default-rtdb.firebaseio.com'
// Comma-separated fallback list e.g. "admin1@gmail.com,admin2@gmail.com"
// Used when Firebase /users node is empty and SMTP_USER is not set.
const ADMIN_EMAILS_FALLBACK = (process.env.ADMIN_EMAILS || '')
  .split(',').map(e => e.trim()).filter(Boolean)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

let transporter: nodemailer.Transporter | null = null
const getTransporter = () => {
  if (transporter) return transporter
  if (!SMTP_USER || !SMTP_PASSWORD) return null
  transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 10000, socketTimeout: 10000,
  })
  return transporter
}

const getPHTime = () => {
  // Returns current time as a Date object adjusted to PHT (UTC+8) for DISPLAY only.
  // Do NOT use this for time arithmetic — use Date.now() / new Date() directly.
  const now = new Date()
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000)
}

// Returns current UTC timestamp in milliseconds — use this for all time math.
const nowUTC = () => Date.now()
const formatTime12h = (t: string) => {
  try {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
  } catch { return t }
}
// Use new Date() directly — the timeZone option handles the PHT conversion.
// Do NOT use getPHTime() here: it already shifts +8hrs, then timeZone shifts again = double offset.
const todayPHLabel = () => new Date().toLocaleDateString('en-PH', {
  weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Manila'
})
const nowPHLabel = () => new Date().toLocaleTimeString('en-PH', {
  hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZone:'Asia/Manila'
})

const getMealColors = (mealType?: string) => {
  const mt = (mealType || '').toLowerCase()
  if (mt === 'breakfast') return {
    headerBg:'linear-gradient(135deg,#f59e0b 0%,#fbbf24 60%,#fde68a 100%)',
    accentColor:'#92400e',badgeBg:'#fef3c7',badgeText:'#92400e',badgeBorder:'#fcd34d',
    tableThead:'#fef3c7',theadText:'#78350f',tableRow1:'#fffbeb',tableRow2:'#fef9f0',
    tableAccent:'#f59e0b',footerBg:'#fef3c7',footerBorder:'#fcd34d',footerText:'#92400e',
    emoji:'🌅',label:'BREAKFAST ORDER',
  }
  if (mt === 'lunch') return {
    headerBg:'linear-gradient(135deg,#0284c7 0%,#38bdf8 60%,#bae6fd 100%)',
    accentColor:'#0c4a6e',badgeBg:'#e0f2fe',badgeText:'#0c4a6e',badgeBorder:'#7dd3fc',
    tableThead:'#e0f2fe',theadText:'#0c4a6e',tableRow1:'#f0f9ff',tableRow2:'#e0f2fe',
    tableAccent:'#0284c7',footerBg:'#e0f2fe',footerBorder:'#7dd3fc',footerText:'#0c4a6e',
    emoji:'☀️',label:'LUNCH ORDER',
  }
  return {
    headerBg:'linear-gradient(135deg,#991b1b 0%,#dc2626 60%,#ef4444 100%)',
    accentColor:'#7f1d1d',badgeBg:'#fee2e2',badgeText:'#7f1d1d',badgeBorder:'#fca5a5',
    tableThead:'#fee2e2',theadText:'#7f1d1d',tableRow1:'#fff5f5',tableRow2:'#fef2f2',
    tableAccent:'#dc2626',footerBg:'#fee2e2',footerBorder:'#fca5a5',footerText:'#7f1d1d',
    emoji:'🌙',label:'DINNER ORDER',
  }
}

const emailWrapper = (content: string, mealType?: string) => {
  const c = getMealColors(mealType)
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Yellow Roast Co.</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
  <tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12);max-width:620px;">
    <tr><td style="background:${c.headerBg};padding:36px 40px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;">Yellow Roast Co.</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.88);font-size:13px;letter-spacing:1.2px;font-weight:500;">${c.label} &nbsp;·&nbsp; ${c.emoji} &nbsp;KITCHEN NOTIFICATION</p>
    </td></tr>
    <tr><td style="background:${c.badgeBg};padding:10px 40px;border-bottom:1px solid ${c.badgeBorder};">
      <p style="margin:0;color:${c.badgeText};font-size:12px;font-weight:600;">📅 ${todayPHLabel()} &nbsp;&nbsp;🕐 ${nowPHLabel()} (Asia/Manila)</p>
    </td></tr>
    <tr><td style="padding:36px 40px;">${content}</td></tr>
    <tr><td style="background:${c.footerBg};padding:20px 40px;text-align:center;border-top:2px solid ${c.footerBorder};">
      <p style="margin:0 0 4px;color:${c.footerText};font-size:12px;font-weight:700;">🐔 YELLOW ROAST CO. — INVENTORY SYSTEM</p>
      <p style="margin:0;color:${c.footerText};font-size:11px;opacity:0.75;">This is an automated notification. Do not reply.</p>
    </td></tr>
  </table></td></tr>
</table></body></html>`
}

const buildOrderTable = (orders: any[], colors: ReturnType<typeof getMealColors>) => {
  if (!orders.length) return ''
  const rows = orders.map((o, i) => {
    const items = (o.orderedItems || o.items || []).map((it: any) => `<strong>${it.quantity}×</strong> ${it.name}`).join(', ')
    const time = o.cookTime ? formatTime12h(o.cookTime) : '—'
    const pay = o.paymentStatus === 'paid'
      ? `<span style="color:#16a34a;font-weight:600;">✓ Paid</span>`
      : `<span style="color:#dc2626;font-weight:600;">Unpaid</span>`
    const bg = i % 2 === 0 ? colors.tableRow1 : colors.tableRow2
    return `<tr style="background:${bg};"><td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-weight:600;">${o.customerName}</td><td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-size:13px;">${items}</td><td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};color:${colors.tableAccent};font-weight:700;">${time}</td><td style="padding:10px 12px;border-bottom:1px solid ${colors.badgeBorder};font-size:13px;">${pay}</td></tr>`
  }).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid ${colors.badgeBorder};margin-top:8px;"><thead><tr style="background:${colors.tableThead};"><th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Customer</th><th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Items</th><th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Delivery Time</th><th style="padding:10px 12px;text-align:left;color:${colors.theadText};font-size:12px;font-weight:700;text-transform:uppercase;">Payment</th></tr></thead><tbody>${rows}</tbody></table>`
}

const sendEmail = async (to: string, subject: string, html: string, text: string) => {
  const mailer = getTransporter()
  if (!mailer) { console.log(`[send-reminders] (no SMTP) simulated → ${to}`); return true }
  try {
    const mailOptions: any = { from: `"Yellow Roast Co." <${SMTP_USER}>`, to, subject, text, html }
    await mailer.sendMail(mailOptions)
    console.log(`[send-reminders] ✅ Sent "${subject}" → ${to}`)
    return true
  } catch (err) {
    console.error(`[send-reminders] ❌ Failed → ${to}:`, err)
    return false
  }
}

// Fetch ALL admin emails.
// Source 1: RTDB /users node — populated by AuthProvider every time an admin logs in.
// Source 2: ADMIN_EMAILS env var — hardcoded fallback set in Vercel dashboard.
// Source 3: SMTP_USER env var — last resort single-email fallback.
// All three are merged and deduplicated so every admin always gets reminded.
const fetchAllUserEmails = async (): Promise<string[]> => {
  // Attempt 1: RTDB /users node (populated by AuthProvider on login)
  try {
    const authParam = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''
    const res = await fetch(`${FIREBASE_DB_URL}/users.json${authParam}`)
    if (res.ok) {
      const users = await res.json()
      if (users && typeof users === 'object') {
        const emails: string[] = []
        Object.values(users).forEach((u: any) => { if (u?.email?.trim()) emails.push(u.email.trim()) })
        // Always merge in env var emails so nobody is missed
        if (SMTP_USER && !emails.includes(SMTP_USER)) emails.push(SMTP_USER)
        ADMIN_EMAILS_FALLBACK.forEach(e => { if (!emails.includes(e)) emails.push(e) })
        const unique = Array.from(new Set(emails))
        if (unique.length > 0) {
          console.log(`[send-reminders] ${unique.length} admin email(s) from RTDB /users:`, unique)
          return unique
        }
      }
    }
    console.warn(`[send-reminders] RTDB /users returned no emails, using env fallback`)
  } catch (err) {
    console.warn('[send-reminders] RTDB /users read failed:', err)
  }

  // Attempt 2: env var fallbacks only
  return buildFallbackEmails()
}

// Build fallback email list from env vars when all Firebase reads fail
const buildFallbackEmails = (): string[] => {
  const emails = new Set<string>()
  if (SMTP_USER) emails.add(SMTP_USER)
  ADMIN_EMAILS_FALLBACK.forEach(e => emails.add(e))
  const result = Array.from(emails)
  console.log(`[send-reminders] Using fallback emails:`, result)
  return result
}

const parseLocalDate = (s: string): Date => {
  if (!s) return new Date()
  if (s.includes('T')) return new Date(s)
  const [y,m,d] = s.split('-').map(Number)
  return new Date(y, m-1, d)
}

const dominantMealType = (orders: any[]) => {
  const counts: Record<string,number> = {}
  orders.forEach(o => { const mt=(o.mealType||o.originalMealType||'dinner').toLowerCase(); counts[mt]=(counts[mt]||0)+1 })
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'dinner'
}

// sentReminders is NOT used for dedup anymore — client sends sentKeys from localStorage.
// This server-side set is only a per-request safety guard against double-sending
// within the same serverless invocation.
const _requestSentGuard = new Set<string>()

// ─── Firebase-backed sent-key store for cron dedup ────────────────────────────
// When the cron calls GET, it reads previously-sent keys from Firebase RTDB
// so a server restart / redeploy doesn't cause duplicate emails.
// Keys auto-expire after 48 hours to prevent unbounded growth.

const fetchCronSentKeys = async (): Promise<string[]> => {
  if (!FIREBASE_DB_SECRET) return []
  try {
    const url = `${FIREBASE_DB_URL}/reminderSentKeys.json?auth=${FIREBASE_DB_SECRET}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    if (!data) return []
    const now = Date.now()
    // Filter out keys older than 48 hours
    return Object.entries(data)
      .filter(([, v]: any) => now - (v?.ts || 0) < 48 * 3600000)
      .map(([k]) => k)
  } catch { return [] }
}

const saveCronSentKeys = async (keys: string[]): Promise<void> => {
  if (!FIREBASE_DB_SECRET || keys.length === 0) return
  try {
    const now = Date.now()
    const payload: Record<string, any> = {}
    // Firebase key can't contain . / [ ] # $  — replace with _
    keys.forEach(k => { payload[k.replace(/[./#[\]$]/g, '_')] = { ts: now, key: k } })
    const url = `${FIREBASE_DB_URL}/reminderSentKeys.json?auth=${FIREBASE_DB_SECRET}`
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { /* non-critical */ }
}

// Orders in these statuses are EXCLUDED from reminder emails
const FINAL_STATUSES = new Set(['delivered','served','cancelled','canceled','complete','ready'])

/**
 * Build the delivery datetime for an order.
 * `order.date` is the DELIVERY DATE (e.g. "2026-03-12", set by cookingDate in new-order).
 * `order.cookTime` is the delivery time string (e.g. "08:00").
 * We combine them to get the exact delivery moment.
 */
const getDeliveryDT = (order: any): Date | null => {
  // Orders with no cookTime set are skipped — reminders only fire once a time is set
  if (!order.cookTime) return null
  const [h, m] = order.cookTime.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null

  // Prefer order.date (the cooking/delivery date) over createdAt
  const dateStr = order.date || order.createdAt || ''
  if (!dateStr) return null

  // cookTime is entered by admins in Philippine time (UTC+8).
  // We must convert to UTC so time math works correctly on the server (which runs in UTC).
  // e.g. 23:00 PHT = 15:00 UTC
  const base = parseLocalDate(dateStr)
  const dt = new Date(base)
  dt.setHours(h - 8, m, 0, 0)  // convert PHT → UTC
  return dt
}

const processReminders = async (orders: any[], emails: string[], clientSentKeys: string[]) => {
  const now = new Date()  // UTC — consistent with getDeliveryDT which also returns UTC
  const sentKeys = new Set(clientSentKeys)

  const pending = orders.filter(o => !FINAL_STATUSES.has((o.status||'').toLowerCase()))
  console.log(`[send-reminders] ${orders.length} total, ${pending.length} active, ${sentKeys.size} already-sent keys`)

  // Buckets keyed by reminder type
  const dayBeforeBucket: any[] = []  // 18–30 hrs before delivery
  const oneHourBucket:   any[] = []  // 0–1.1 hr before delivery (slight buffer for poll timing)
  const twoHourBucket:   any[] = []  // 1.1–2.1 hrs before delivery (slight buffer for poll timing)

  pending.forEach(order => {
    const deliveryDT = getDeliveryDT(order)
    if (!deliveryDT) return
    const hoursUntil = (deliveryDT.getTime() - now.getTime()) / 3600000

    if (hoursUntil > 0  && hoursUntil <= 1.1)  oneHourBucket.push({ order, deliveryDT, hoursUntil })
    else if (hoursUntil > 1.1 && hoursUntil <= 2.1) twoHourBucket.push({ order, deliveryDT, hoursUntil })
    else if (hoursUntil > 18 && hoursUntil <= 30) dayBeforeBucket.push({ order, deliveryDT, hoursUntil })
  })

  const results: string[] = []
  const newSentKeys: string[] = []

  // ── 1-DAY-BEFORE reminder ──────────────────────────────────────────────────
  const dayBeforeOrders = dayBeforeBucket
    .filter(({ order }) => !sentKeys.has(`dayBefore:${order.id}`))
    .map(e => e.order)

  if (dayBeforeOrders.length > 0) {
    const mt = dominantMealType(dayBeforeOrders)
    const colors = getMealColors(mt)
    // Group by delivery date for the subject line
    const firstDT = getDeliveryDT(dayBeforeOrders[0])!
    const delivDateLabel = firstDT.toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric', timeZone:'Asia/Manila' })
    const delivTime = formatTime12h(dayBeforeOrders[0].cookTime)
    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:${colors.badgeBg};border:2px solid ${colors.badgeBorder};border-radius:20px;padding:6px 16px;margin-bottom:16px;">
          <span style="color:${colors.badgeText};font-weight:800;font-size:12px;">📆 1-DAY ADVANCE REMINDER</span>
        </div>
        <h2 style="margin:0 0 8px;color:#111827;font-size:26px;font-weight:900;">
          ${dayBeforeOrders.length} Order${dayBeforeOrders.length>1?'s':''} Tomorrow!
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Delivery on <strong style="color:${colors.tableAccent};font-size:16px;">${delivDateLabel}</strong>
          at <strong style="color:${colors.tableAccent};font-size:18px;">${delivTime}</strong>
          — prepare ingredients in advance
        </p>
      </div>
      ${buildOrderTable(dayBeforeOrders, colors)}
      <div style="margin-top:20px;padding:14px 18px;background:${colors.badgeBg};border-left:4px solid ${colors.tableAccent};border-radius:0 8px 8px 0;">
        <p style="margin:0;color:${colors.badgeText};font-size:13px;font-weight:600;">
          📋 You will receive another reminder 1–2 hours before delivery time.
        </p>
      </div>`
    const html = emailWrapper(content, mt)
    const text = `TOMORROW: ${dayBeforeOrders.length} order(s) on ${delivDateLabel} at ${delivTime}\n\n${dayBeforeOrders.map(o=>`${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any)=>`${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
    const subject = `📆 Tomorrow: ${dayBeforeOrders.length} Order${dayBeforeOrders.length>1?'s':''} on ${delivDateLabel} at ${delivTime}`
    for (const email of emails) await sendEmail(email, subject, html, text)
    dayBeforeOrders.forEach(o => { newSentKeys.push(`dayBefore:${o.id}`) })
    results.push(`dayBefore-reminder: ${dayBeforeOrders.length} order(s) → ${emails.length} recipient(s)`)
  }

  // ── 1-HOUR-URGENT reminder ─────────────────────────────────────────────────
  const oneHourOrders = oneHourBucket
    .filter(({ order }) => !sentKeys.has(`1hr:${order.id}`))
    .map(e => e.order)

  if (oneHourOrders.length > 0) {
    const mt = dominantMealType(oneHourOrders)
    const colors = getMealColors(mt)
    const delivTime = formatTime12h(oneHourOrders[0].cookTime)
    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:#fee2e2;border:2px solid #dc2626;border-radius:20px;padding:6px 16px;margin-bottom:16px;">
          <span style="color:#991b1b;font-weight:800;font-size:12px;">🚨 1-HOUR URGENT REMINDER</span>
        </div>
        <h2 style="margin:0 0 8px;color:#991b1b;font-size:26px;font-weight:900;">
          ${oneHourOrders.length} Order${oneHourOrders.length>1?'s':''} Due in 1 Hour!
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Delivery at <strong style="color:#dc2626;font-size:18px;">${delivTime}</strong> — final preparation required NOW
        </p>
      </div>
      ${buildOrderTable(oneHourOrders, colors)}
      <div style="margin-top:20px;padding:18px;background:#fee2e2;border:3px solid #dc2626;border-radius:8px;text-align:center;">
        <p style="color:#7f1d1d;margin:0;font-size:16px;font-weight:800;">⚡ PACK ALL ORDERS NOW — DELIVERY IN 1 HOUR!</p>
      </div>`
    const html = emailWrapper(content, mt)
    const text = `URGENT: ${oneHourOrders.length} order(s) due in 1 hour at ${delivTime}\n\n${oneHourOrders.map(o=>`${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any)=>`${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
    const subject = `🚨 URGENT: ${oneHourOrders.length} Order${oneHourOrders.length>1?'s':''} Due in 1 Hour — ${delivTime}`
    for (const email of emails) await sendEmail(email, subject, html, text)
    oneHourOrders.forEach(o => { newSentKeys.push(`1hr:${o.id}`) })
    results.push(`1hr-reminder: ${oneHourOrders.length} order(s) → ${emails.length} recipient(s)`)
  }

  // ── 2-HOUR reminder ────────────────────────────────────────────────────────
  const twoHourOrders = twoHourBucket
    .filter(({ order }) => !sentKeys.has(`2hr:${order.id}`))
    .map(e => e.order)

  if (twoHourOrders.length > 0) {
    const mt = dominantMealType(twoHourOrders)
    const colors = getMealColors(mt)
    const delivTime = formatTime12h(twoHourOrders[0].cookTime)
    const content = `
      <div style="margin-bottom:24px;">
        <div style="display:inline-block;background:${colors.badgeBg};border:1px solid ${colors.badgeBorder};border-radius:20px;padding:6px 16px;margin-bottom:16px;">
          <span style="color:${colors.badgeText};font-weight:700;font-size:12px;">📅 2-HOUR ADVANCE REMINDER</span>
        </div>
        <h2 style="margin:0 0 8px;color:#111827;font-size:24px;font-weight:800;">
          ${twoHourOrders.length} Order${twoHourOrders.length>1?'s':''} — Delivery in ~2 Hours
        </h2>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Delivery at <strong style="color:${colors.tableAccent};font-size:18px;">${delivTime}</strong> — begin preparation soon
        </p>
      </div>
      ${buildOrderTable(twoHourOrders, colors)}
      <div style="margin-top:20px;padding:14px 18px;background:${colors.badgeBg};border-left:4px solid ${colors.tableAccent};border-radius:0 8px 8px 0;">
        <p style="margin:0;color:${colors.badgeText};font-size:13px;font-weight:600;">
          ✅ Delivery in ~2 hours at ${delivTime} — begin final preparation!
        </p>
      </div>`
    const html = emailWrapper(content, mt)
    const text = `REMINDER: ${twoHourOrders.length} order(s) due in ~2 hours at ${delivTime}\n\n${twoHourOrders.map(o=>`${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any)=>`${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
    const subject = `📅 2-Hr Alert: ${twoHourOrders.length} Order${twoHourOrders.length>1?'s':''} Due in ~2 Hours — ${delivTime}`
    for (const email of emails) await sendEmail(email, subject, html, text)
    twoHourOrders.forEach(o => { newSentKeys.push(`2hr:${o.id}`) })
    results.push(`2hr-reminder: ${twoHourOrders.length} order(s) → ${emails.length} recipient(s)`)
  }

  if (results.length === 0) results.push('no reminders needed at this time')
  return { results, newSentKeys }
}

// ─── Fetch orders from Firebase RTDB (server-side, no browser needed) ─────────
// Used by the Vercel cron job GET handler so reminders fire even when logged out.
const fetchOrdersFromFirebase = async (): Promise<any[]> => {
  if (!FIREBASE_DB_SECRET) {
    console.warn('[send-reminders] No FIREBASE_DB_SECRET — cannot fetch orders server-side')
    return []
  }
  try {
    const url = `${FIREBASE_DB_URL}/inventories/orders.json?auth=${FIREBASE_DB_SECRET}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[send-reminders] Firebase orders fetch returned ${res.status}`)
      return []
    }
    const data = await res.json()
    if (!data) return []
    return Object.values(data)
  } catch (err) {
    console.warn('[send-reminders] fetchOrdersFromFirebase failed:', err)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    let overrideEmails: string[] | null = null
    let clientOrders: any[] | null = null
    let clientSentKeys: string[] = []
    try {
      const body = await request.json()
      if (Array.isArray(body?.emails)) overrideEmails = body.emails
      if (Array.isArray(body?.orders)) clientOrders = body.orders
      if (Array.isArray(body?.sentKeys)) clientSentKeys = body.sentKeys
    } catch { /* no body */ }

    const emails = overrideEmails || await fetchAllUserEmails()
    if (emails.length === 0) {
      return NextResponse.json({ success:false, message:'No recipient emails found' }, { headers:corsHeaders })
    }

    // Merge client sentKeys with Firebase-persisted sentKeys so dedup is shared across ALL browsers.
    // Without this, admin A's browser marks a key sent, but admin B's browser never sees it —
    // causing admin B to get a duplicate email, OR admin A's key prevents admin B from getting ANY email.
    // With Firebase dedup: one browser sending = all browsers know it was sent.
    const firebaseSentKeys = await fetchCronSentKeys()
    const mergedSentKeys = Array.from(new Set([...clientSentKeys, ...firebaseSentKeys]))

    // Use orders from client (browser) if provided, otherwise fetch from Firebase
    const orders = clientOrders ?? await fetchOrdersFromFirebase()
    console.log(`[send-reminders] Processing ${orders.length} orders, ${mergedSentKeys.length} dedup keys (${clientSentKeys.length} client + ${firebaseSentKeys.length} firebase), ${emails.length} recipient(s)`)
    const { results, newSentKeys } = await processReminders(orders, emails, mergedSentKeys)

    // Persist newly-sent keys to Firebase so ALL admin browsers share the dedup state
    if (newSentKeys.length > 0) await saveCronSentKeys(newSentKeys)

    return NextResponse.json({
      success:true, timestamp:nowPHLabel(),
      recipients:emails.length, ordersChecked:orders.length, actions:results,
      newSentKeys,
    }, { headers:corsHeaders })
  } catch (err) {
    console.error('[send-reminders] Unexpected error:', err)
    return NextResponse.json({ success:false, error:err instanceof Error?err.message:'Unknown error' }, { status:500, headers:corsHeaders })
  }
}

// GET is called by the Vercel cron job every 5 minutes — no browser needed.
// It fetches orders directly from Firebase RTDB and sends reminder emails server-side.
// This means emails fire even when no one is logged in or has the app open.
export async function GET(request: NextRequest) {
  // Verify cron secret if set (protects the endpoint from random GET requests)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }
  }

  const [emails, orders] = await Promise.all([
    fetchAllUserEmails(),
    fetchOrdersFromFirebase(),
  ])

  if (emails.length === 0) {
    return NextResponse.json({
      success: false, message: 'No recipient emails configured',
      smtpConfigured: !!(SMTP_USER && SMTP_PASSWORD),
      firebaseSecretConfigured: !!FIREBASE_DB_SECRET,
      timestamp: nowPHLabel(),
    }, { headers: corsHeaders })
  }

  console.log(`[send-reminders/cron] ${orders.length} orders, ${emails.length} recipient(s)`)
  // Load persisted sent keys from Firebase so we don't re-send after server restart
  const persistedSentKeys = await fetchCronSentKeys()
  const { results, newSentKeys } = await processReminders(orders, emails, persistedSentKeys)
  // Save any newly sent keys back to Firebase for future cron runs
  if (newSentKeys.length > 0) await saveCronSentKeys(newSentKeys)

  return NextResponse.json({
    success: true, source: 'cron',
    timestamp: nowPHLabel(),
    recipients: emails.length,
    ordersChecked: orders.length,
    actions: results,
    newSentKeys,
  }, { headers: corsHeaders })
}

export async function OPTIONS() {
  return new NextResponse(null, { status:200, headers:corsHeaders })
}