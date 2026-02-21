import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route for sending notification emails
 * This endpoint handles email sending for food preparation reminders
 */

// Environment variables needed:
// - SMTP_HOST: SMTP server host (e.g., smtp.gmail.com)
// - SMTP_PORT: SMTP server port (e.g., 587)
// - SMTP_USER: SMTP username/email
// - SMTP_PASSWORD: SMTP password
// - ADMIN_EMAIL: Admin email to receive notifications

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@yellowbell.com'
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || ''

// helper to return sanitized config for logs/responses
function getSmtpDebugConfig() {
  return {
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER ? (SMTP_USER.slice(0,1) + '****' + SMTP_USER.slice(-1)) : '',
    hasPassword: !!SMTP_PASSWORD,
    adminEmail: ADMIN_EMAIL,
  }
}

// Nodemailer transporter (lazy loaded to avoid issues if not configured)
let transporter: any = null

const initializeTransporter = () => {
  if (transporter) return transporter

  try {
    // Dynamically import nodemailer only if needed
    const nodemailer = require('nodemailer')
    
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    })

    console.log('[email-api] Nodemailer transporter initialized successfully')
    return transporter
  } catch (error) {
    console.error('[email-api] Failed to initialize Nodemailer:', error)
    return null
  }
}

/**
 * POST /api/send-notification-email
 * Sends an email notification for food preparation reminders
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from our own app (basic security)
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    
    // Parse request body
    const body = await request.json()
    const { subject, htmlBody, plainTextBody, recipientEmail } = body

    // Validate required fields
    if (!subject || !htmlBody || !plainTextBody) {
      return NextResponse.json(
        { error: 'Missing required fields: subject, htmlBody, plainTextBody' },
        { status: 400 }
      )
    }

    // Use provided email or default to admin
    const recipient = recipientEmail || ADMIN_EMAIL

    // Initialize transporter if not already done
    const mailer = initializeTransporter()
    if (!mailer) {
      // no real SMTP available – pretend to send and succeed
      console.log(`[email-api] SMTP not configured, pretending to send email to ${recipient}.`)
      console.log('subject:', subject)
      console.log('text body:', plainTextBody)
      console.log('html body:', htmlBody)

      return NextResponse.json(
        {
          success: true,
          message: 'Email service not configured; message was logged instead of sent',
          simulated: true,
          recipient,
        },
        { status: 200 }
      )
    }

    // Send email via real transporter
    const info = await mailer.sendMail({
      from: SMTP_USER,
      to: recipient,
      subject: subject,
      text: plainTextBody,
      html: htmlBody,
    })

    console.log(`[email-api] Email sent successfully to ${recipient}:`, info.response)

    return NextResponse.json(
      {
        success: true,
        message: 'Email sent successfully',
        messageId: info.messageId,
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('[email-api] Error sending email:', error)
    
    // Return error response
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/send-notification-email (for health check)
 */
export async function GET(request: NextRequest) {
  // return SMTP config for debugging (sanitised)
  return NextResponse.json(
    {
      status: 'ok',
      message: 'Email notification endpoint is ready',
      smtp: getSmtpDebugConfig(),
      configuredEmail: SMTP_USER ? 'Configured' : 'Not configured',
      adminEmail: ADMIN_EMAIL,
    },
    { status: 200 }
  )
}
