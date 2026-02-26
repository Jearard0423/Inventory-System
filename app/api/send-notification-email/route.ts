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
    })

    console.log('[email-api] SMTP transporter created successfully')
    return transporter
  } catch (error) {
    console.error('[email-api] Failed to init transporter:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subject, htmlBody, plainTextBody, recipientEmail } = body

    if (!subject || !htmlBody || !plainTextBody) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, htmlBody, plainTextBody' },
        { status: 400 }
      )
    }

    // recipientEmail is the signed-in admin's email from Firebase Auth
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'recipientEmail is required – must be the signed-in admin email' },
        { status: 400 }
      )
    }

    const mailer = await initializeTransporter()

    if (!mailer) {
      // SMTP not configured – log and pretend success so app keeps working
      console.log('[email-api] (simulated) To:', recipientEmail)
      console.log('[email-api] (simulated) Subject:', subject)
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'SMTP credentials not configured – email was logged to console instead',
        recipient: recipientEmail,
      })
    }

    try {
      const info = await mailer.sendMail({
        from: `"Yellow Roast Co." <${SMTP_USER}>`,
        to: recipientEmail,
        subject,
        text: plainTextBody,
        html: htmlBody,
      })

      console.log(`[email-api] Email sent to ${recipientEmail} – messageId: ${info.messageId}`)

      return NextResponse.json({
        success: true,
        message: 'Email sent successfully via SMTP',
        recipient: recipientEmail,
        messageId: info.messageId,
      })
    } catch (error) {
      // Log the error but don't fail the HTTP request so callers won't see a network error
      console.error('[email-api] Error sending email:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
        recipient: recipientEmail,
      })
    }

  } catch (error) {
    console.error('[email-api] Error:', error)
    // this outer catch is unlikely to be hit but we mirror the same structure
    return NextResponse.json({
      success: false,
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/** GET /api/send-notification-email – health check */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Email endpoint ready – recipient is dynamic (signed-in admin email)',
    smtpConfigured: !!(SMTP_USER && SMTP_PASSWORD),
    smtpUser: SMTP_USER ? SMTP_USER.slice(0, 3) + '****' + SMTP_USER.slice(-10) : 'not set',
  })
}
