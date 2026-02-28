import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

/**
 * POST /api/send-notification-email
 *
 * Sends email notifications for Yellow Roast Co. using SMTP.
 * The recipient is ALWAYS the currently signed-in admin's email —
 * passed dynamically from the frontend via `recipientEmail` in the body.
 *
 * Required env vars:
 *   SMTP_HOST      – e.g. smtp.gmail.com
 *   SMTP_PORT      – e.g. 587
 *   SMTP_USER      – your Gmail address
 *   SMTP_PASSWORD  – your Gmail App Password (16 characters)
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || ''

// Debug: Log environment variables on startup
console.log('[email-api] Environment check:')
console.log('- SMTP_HOST:', SMTP_HOST)
console.log('- SMTP_PORT:', SMTP_PORT)
console.log('- SMTP_USER:', SMTP_USER ? 'set' : 'not set')
console.log('- SMTP_PASSWORD:', SMTP_PASSWORD ? 'set' : 'not set')

let transporter: nodemailer.Transporter | null = null

const initializeTransporter = async () => {
  if (transporter) return transporter

  try {
    console.log('[email-api] SMTP_USER:', SMTP_USER ? 'set' : 'not set')
    console.log('[email-api] SMTP_PASSWORD:', SMTP_PASSWORD ? 'set' : 'not set')

    if (!SMTP_USER || !SMTP_PASSWORD) {
      console.warn('[email-api] SMTP credentials not set in .env.local – emails will be logged only')
      return null
    }

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    })

    console.log('[email-api] SMTP transporter created successfully')
    return transporter
  } catch (error) {
    console.error('[email-api] Failed to init transporter:', error)
    return null
  }
}

// Add CORS headers to all responses
const addCorsHeaders = (response: NextResponse) => {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, htmlBody, plainTextBody, recipientEmail, timestamp, clientTimezone } = body

    console.log('[email-api] Received request:', {
      timestamp,
      clientTimezone,
      recipientEmail: recipientEmail?.slice(0, 5) + '****'
    })

    if (!subject || !htmlBody || !plainTextBody) {
      console.error('[email-api] Missing required fields')
      const response = NextResponse.json(
        { error: 'Missing required fields: subject, htmlBody, plainTextBody' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    // recipientEmail is the signed-in admin's email from Firebase Auth
    if (!recipientEmail) {
      console.error('[email-api] Missing recipient email')
      const response = NextResponse.json(
        { error: 'recipientEmail is required – must be the signed-in admin email' },
        { status: 400 }
      )
      return addCorsHeaders(response)
    }

    const mailer = await initializeTransporter()

    if (!mailer) {
      // SMTP not configured – log and pretend success so app keeps working
      console.log('[email-api] (simulated) To:', recipientEmail)
      console.log('[email-api] (simulated) Subject:', subject)
      console.log('[email-api] (simulated) Sent at:', timestamp || new Date().toISOString())
      const response = NextResponse.json({
        success: true,
        simulated: true,
        message: 'SMTP credentials not configured – email was logged to console instead',
        recipient: recipientEmail,
      })
      return addCorsHeaders(response)
    }

    try {
      // Attach logo as inline CID if available and rewrite HTML to reference cid
      const fs = require('fs')
      const path = require('path')
      let htmlToSend = String(htmlBody)
      const logoPublicPath = path.join(process.cwd(), 'public', 'yrclogo.jpg')
      const shouldAttachLogo = fs.existsSync(logoPublicPath)

      if (shouldAttachLogo) {
        // replace occurrences like src="/yrclogo.jpg" or src='/yrclogo.jpg'
        htmlToSend = htmlToSend.replace(/src=["']\/yrclogo\.jpg["']/g, 'src="cid:yrclogo@yellow"')
      }

      const mailOptions: any = {
        from: `"Yellow Roast Co." <${SMTP_USER}>`,
        to: recipientEmail,
        subject,
        text: plainTextBody,
        html: htmlToSend,
      }

      if (shouldAttachLogo) {
        mailOptions.attachments = [
          {
            filename: 'yrclogo.jpg',
            path: logoPublicPath,
            cid: 'yrclogo@yellow'
          }
        ]
      }

      const info = await mailer.sendMail(mailOptions)

      console.log(`[email-api] ✅ Email sent to ${recipientEmail} – messageId: ${info.messageId}`)

      const response = NextResponse.json({
        success: true,
        message: 'Email sent successfully via SMTP',
        recipient: recipientEmail,
        messageId: info.messageId,
        sentAt: new Date().toISOString()
      })
      return addCorsHeaders(response)
    } catch (error) {
      // Log the error but don't fail the HTTP request so callers won't see a network error
      console.error('[email-api] ❌ Error sending email:', error instanceof Error ? error.message : error)
      const response = NextResponse.json({
        success: false,
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
        recipient: recipientEmail,
      }, { status: 500 })
      return addCorsHeaders(response)
    }

  } catch (error) {
    console.error('[email-api] ❌ Error parsing request:', error)
    // this outer catch is unlikely to be hit but we mirror the same structure
    const response = NextResponse.json({
      success: false,
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
    return addCorsHeaders(response)
  }
}

/** GET /api/send-notification-email – health check */
export async function GET() {
  const response = NextResponse.json({
    status: 'ok',
    message: 'Email endpoint ready – recipient is dynamic (signed-in admin email)',
    smtpConfigured: !!(SMTP_USER && SMTP_PASSWORD),
    smtpUser: SMTP_USER ? SMTP_USER.slice(0, 3) + '****' + SMTP_USER.slice(-10) : 'not set',
    timestamp: new Date().toISOString(),
    timezone: 'UTC'
  })
  return addCorsHeaders(response)
}

/** OPTIONS /api/send-notification-email – CORS preflight */
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response)
}
