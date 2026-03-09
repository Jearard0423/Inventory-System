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
  const now = new Date()
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000)
}
const formatTime12h = (t: string) => {
  try {
    const [h, m] = t.split(':').map(Number)
    return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
  } catch { return t }
}
const todayPHLabel = () => getPHTime().toLocaleDateString('en-PH', {
  weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Manila'
})
const nowPHLabel = () => getPHTime().toLocaleTimeString('en-PH', {
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
      <img src="cid:yrclogo@yellow" alt="YRC" width="72" height="72" style="border-radius:12px;border:3px solid rgba(255,255,255,0.35);margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;"/>
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
    const fs = require('fs'), path = require('path')
    const logoPath = path.join(process.cwd(), 'public', 'yrclogo.jpg')
    const mailOptions: any = { from: `"Yellow Roast Co." <${SMTP_USER}>`, to, subject, text, html }
    if (fs.existsSync(logoPath)) mailOptions.attachments = [{ filename:'yrclogo.jpg', path:logoPath, cid:'yrclogo@yellow' }]
    await mailer.sendMail(mailOptions)
    console.log(`[send-reminders] ✅ Sent "${subject}" → ${to}`)
    return true
  } catch (err) {
    console.error(`[send-reminders] ❌ Failed → ${to}:`, err)
    return false
  }
}

// Fetch emails — uses FIREBASE_DB_SECRET if available, graceful fallback to SMTP_USER
const fetchAllUserEmails = async (): Promise<string[]> => {
  try {
    const authParam = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''
    const res = await fetch(`${FIREBASE_DB_URL}/users.json${authParam}`)
    if (!res.ok) {
      console.warn(`[send-reminders] Firebase /users.json → ${res.status}, using SMTP_USER fallback`)
      return SMTP_USER ? [SMTP_USER] : []
    }
    const users = await res.json()
    if (!users) return SMTP_USER ? [SMTP_USER] : []
    const emails: string[] = []
    Object.values(users).forEach((u: any) => { if (u?.email?.trim()) emails.push(u.email.trim()) })
    if (SMTP_USER) emails.push(SMTP_USER)
    const unique = Array.from(new Set(emails))
    console.log(`[send-reminders] ${unique.length} email(s):`, unique)
    return unique
  } catch (err) {
    console.warn('[send-reminders] Firebase unreachable, fallback to SMTP_USER:', err)
    return SMTP_USER ? [SMTP_USER] : []
  }
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

const sentReminders = new Set<string>()

// Orders in these statuses are EXCLUDED from reminder emails
const FINAL_STATUSES = new Set(['delivered','served','cancelled','canceled','complete','ready'])

const processReminders = async (orders: any[], emails: string[]) => {
  const now = getPHTime()

  const pending = orders.filter(o => !FINAL_STATUSES.has((o.status||'').toLowerCase()))
  console.log(`[send-reminders] ${orders.length} total, ${pending.length} pending (non-final)`)

  const oneHourBucket: any[] = []
  const twoHourBucket: any[] = []

  pending.forEach(order => {
    if (!order.cookTime) return
    const orderDate = parseLocalDate(order.createdAt || order.date || '')
    const [h, m] = order.cookTime.split(':').map(Number)
    const deliveryDT = new Date(orderDate)
    deliveryDT.setHours(h, m, 0, 0)
    // Handle next-day orders (e.g. placed at night, delivery at 8am)
    if (deliveryDT < now) deliveryDT.setDate(deliveryDT.getDate() + 1)
    const hoursUntil = (deliveryDT.getTime() - now.getTime()) / 3600000
    if (hoursUntil > 0 && hoursUntil <= 1) oneHourBucket.push(order)
    else if (hoursUntil > 1 && hoursUntil <= 2) twoHourBucket.push(order)
  })

  const results: string[] = []

  if (oneHourBucket.length > 0) {
    const newOrders = oneHourBucket.filter(o => !sentReminders.has(`1hr:${o.id}`))
    if (newOrders.length > 0) {
      const mt = dominantMealType(newOrders)
      const colors = getMealColors(mt)
      const delivTime = formatTime12h(newOrders[0].cookTime)
      const content = `<div style="margin-bottom:24px;"><div style="display:inline-block;background:#fee2e2;border:2px solid #dc2626;border-radius:20px;padding:6px 16px;margin-bottom:16px;"><span style="color:#991b1b;font-weight:800;font-size:12px;">🚨 1-HOUR URGENT REMINDER</span></div><h2 style="margin:0 0 8px;color:#991b1b;font-size:26px;font-weight:900;">${newOrders.length} Order${newOrders.length>1?'s':''} Due in 1 Hour!</h2><p style="margin:0;color:#6b7280;font-size:14px;">Delivery at <strong style="color:#dc2626;font-size:18px;">${delivTime}</strong> — final preparation required NOW</p></div>${buildOrderTable(newOrders,colors)}<div style="margin-top:20px;padding:18px;background:#fee2e2;border:3px solid #dc2626;border-radius:8px;text-align:center;"><p style="color:#7f1d1d;margin:0;font-size:16px;font-weight:800;">⚡ PACK ALL ORDERS NOW — DELIVERY IN 1 HOUR!</p></div>`
      const html = emailWrapper(content, mt)
      const text = `URGENT: ${newOrders.length} order(s) due in 1 hour at ${delivTime}\n\n${newOrders.map(o=>`${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any)=>`${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
      const subject = `🚨 URGENT: ${newOrders.length} Order${newOrders.length>1?'s':''} Due in 1 Hour — ${delivTime}`
      for (const email of emails) await sendEmail(email, subject, html, text)
      newOrders.forEach(o => sentReminders.add(`1hr:${o.id}`))
      results.push(`1hr-reminder: ${newOrders.length} order(s) → ${emails.length} recipient(s)`)
    }
  }

  if (twoHourBucket.length > 0) {
    const newOrders = twoHourBucket.filter(o => !sentReminders.has(`2hr:${o.id}`))
    if (newOrders.length > 0) {
      const mt = dominantMealType(newOrders)
      const colors = getMealColors(mt)
      const delivTime = formatTime12h(newOrders[0].cookTime)
      const content = `<div style="margin-bottom:24px;"><div style="display:inline-block;background:${colors.badgeBg};border:1px solid ${colors.badgeBorder};border-radius:20px;padding:6px 16px;margin-bottom:16px;"><span style="color:${colors.badgeText};font-weight:700;font-size:12px;">📅 2-HOUR ADVANCE REMINDER</span></div><h2 style="margin:0 0 8px;color:#111827;font-size:24px;font-weight:800;">${newOrders.length} Order${newOrders.length>1?'s':''} — Delivery in ~2 Hours</h2><p style="margin:0;color:#6b7280;font-size:14px;">Delivery at <strong style="color:${colors.tableAccent};font-size:18px;">${delivTime}</strong> — begin preparation soon</p></div>${buildOrderTable(newOrders,colors)}<div style="margin-top:20px;padding:14px 18px;background:${colors.badgeBg};border-left:4px solid ${colors.tableAccent};border-radius:0 8px 8px 0;"><p style="margin:0;color:${colors.badgeText};font-size:13px;font-weight:600;">✅ Delivery in ~2 hours at ${delivTime} — begin final preparation!</p></div>`
      const html = emailWrapper(content, mt)
      const text = `REMINDER: ${newOrders.length} order(s) due in ~2 hours at ${delivTime}\n\n${newOrders.map(o=>`${o.customerName}: ${(o.orderedItems||o.items||[]).map((i:any)=>`${i.quantity}x ${i.name}`).join(', ')}`).join('\n')}`
      const subject = `📅 2-Hr Alert: ${newOrders.length} Order${newOrders.length>1?'s':''} Due in ~2 Hours — ${delivTime}`
      for (const email of emails) await sendEmail(email, subject, html, text)
      newOrders.forEach(o => sentReminders.add(`2hr:${o.id}`))
      results.push(`2hr-reminder: ${newOrders.length} order(s) → ${emails.length} recipient(s)`)
    }
  }

  if (results.length === 0) results.push('no reminders needed at this time')
  return results
}

export async function POST(request: NextRequest) {
  try {
    let overrideEmails: string[] | null = null
    let clientOrders: any[] | null = null
    try {
      const body = await request.json()
      if (Array.isArray(body?.emails)) overrideEmails = body.emails
      if (Array.isArray(body?.orders)) clientOrders = body.orders
    } catch { /* no body */ }

    const emails = overrideEmails || await fetchAllUserEmails()
    if (emails.length === 0) {
      return NextResponse.json({ success:false, message:'No recipient emails found' }, { headers:corsHeaders })
    }

    const orders = clientOrders || []
    console.log(`[send-reminders] Processing ${orders.length} orders for ${emails.length} recipient(s)`)
    const results = await processReminders(orders, emails)

    return NextResponse.json({
      success:true, timestamp:nowPHLabel(),
      recipients:emails.length, ordersChecked:orders.length, actions:results,
    }, { headers:corsHeaders })
  } catch (err) {
    console.error('[send-reminders] Unexpected error:', err)
    return NextResponse.json({ success:false, error:err instanceof Error?err.message:'Unknown error' }, { status:500, headers:corsHeaders })
  }
}

export async function GET() {
  const emails = await fetchAllUserEmails()
  return NextResponse.json({
    status:'ok', smtpConfigured:!!(SMTP_USER&&SMTP_PASSWORD),
    firebaseSecretConfigured:!!FIREBASE_DB_SECRET,
    registeredEmails:emails.length, timestamp:nowPHLabel(),
    note:'Orders are sent from the frontend via POST body',
  }, { headers:corsHeaders })
}

export async function OPTIONS() {
  return new NextResponse(null, { status:200, headers:corsHeaders })
}