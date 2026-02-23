import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/send-notification-email
 *
 * Sends email notifications for Yellow Roast Co.
 * The recipient is ALWAYS the currently signed-in admin's email —
 * passed dynamically from the frontend via `recipientEmail` in the body.
 * No hardcoded ADMIN_EMAIL needed.
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

// OAuth2 credentials (optional) for Gmail OAuth SMTP
const SMTP_OAUTH_CLIENT_ID = process.env.SMTP_OAUTH_CLIENT_ID || ''
const SMTP_OAUTH_CLIENT_SECRET = process.env.SMTP_OAUTH_CLIENT_SECRET || ''
const SMTP_OAUTH_REFRESH_TOKEN = process.env.SMTP_OAUTH_REFRESH_TOKEN || ''

let transporter: any = null

const initializeTransporter = async () => {
  if (transporter) return transporter

  try {
    const nodemailer = require('nodemailer')

    // Prefer plain SMTP auth if provided (SMTP_USER + SMTP_PASSWORD)
    if (SMTP_USER && SMTP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASSWORD,
        },
      })
      console.log('[email-api] Transporter ready (password auth)')
      return transporter
    }

    // Fallback to OAuth2 if OAuth credentials are available
    if (SMTP_USER && SMTP_OAUTH_CLIENT_ID && SMTP_OAUTH_CLIENT_SECRET && SMTP_OAUTH_REFRESH_TOKEN) {
      // Use google-auth-library to exchange refresh token for access token
      const { OAuth2Client } = require('google-auth-library')
      const oauth2Client = new OAuth2Client(SMTP_OAUTH_CLIENT_ID, SMTP_OAUTH_CLIENT_SECRET)
      oauth2Client.setCredentials({ refresh_token: SMTP_OAUTH_REFRESH_TOKEN })

      const accessTokenObj = await oauth2Client.getAccessToken()
      const accessToken = accessTokenObj ? (accessTokenObj.token || accessTokenObj) : null

      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: SMTP_USER,
          clientId: SMTP_OAUTH_CLIENT_ID,
          clientSecret: SMTP_OAUTH_CLIENT_SECRET,
          refreshToken: SMTP_OAUTH_REFRESH_TOKEN,
          accessToken,
        },
      })
      console.log('[email-api] Transporter ready (OAuth2)')
      return transporter
    }

    console.warn('[email-api] SMTP credentials not set in .env.local – emails will be logged only')
    return null
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
        message: 'SMTP not configured – email was logged to console instead',
        recipient: recipientEmail,
      })
    }

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
      message: 'Email sent successfully',
      recipient: recipientEmail,
      messageId: info.messageId,
    })

  } catch (error) {
    console.error('[email-api] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send email',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/** GET /api/send-notification-email – health check */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Email endpoint ready – recipient is dynamic (signed-in admin email)',
    smtpConfigured: !!(
      (SMTP_USER && SMTP_PASSWORD) ||
      (SMTP_USER && SMTP_OAUTH_CLIENT_ID && SMTP_OAUTH_CLIENT_SECRET && SMTP_OAUTH_REFRESH_TOKEN)
    ),
    smtpUser: SMTP_USER ? SMTP_USER.slice(0, 3) + '****' + SMTP_USER.slice(-10) : 'not set',
  })
}
