# Environment Variables Setup Guide

This guide explains how to set up the required environment variables for the Yellowbell Inventory System, particularly for the new email notification feature.

## Email Notification Environment Variables

The following environment variables are needed for email notifications to work:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yellowbell.com
```

## Setup by Hosting Platform

### ✅ Vercel (Recommended)

1. Go to your project dashboard: https://vercel.com/dashboard
2. Select your project → Settings → Environment Variables
3. Add each variable:
   - Name: `SMTP_HOST`, Value: `smtp.gmail.com`
   - Name: `SMTP_PORT`, Value: `587`
   - Name: `SMTP_USER`, Value: `your-email@gmail.com`
   - Name: `SMTP_PASSWORD`, Value: `your-app-password`
   - Name: `ADMIN_EMAIL`, Value: `admin@yellowbell.com`

4. Select "Production" and "Preview" environments
5. Click "Save"
6. Redeploy your project

### ✅ Local Development (.env.local)

1. Create a file `.env.local` in the project root (same level as package.json):

```bash
# .env.local
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yellowbell.com
```

2. Make sure `.env.local` is in `.gitignore` (it should already be there):

```bash
# .gitignore
.env.local
```

3. Restart your development server:

```bash
npm run dev
```

### ✅ Firebase Hosting with Cloud Functions

If you're using Firebase:

1. Set environment variables in your Cloud Function:

```bash
firebase functions:config:set mail.host="smtp.gmail.com" mail.port="587" mail.user="your-email@gmail.com" mail.password="your-app-password" mail.admin="admin@yellowbell.com"
```

2. Deploy:

```bash
firebase deploy
```

### ✅ Docker/Self-Hosted

Create an `.env` file in your project root:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yellowbell.com
```

Or pass as environment variables when running:

```bash
docker run \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=your-email@gmail.com \
  -e SMTP_PASSWORD=your-app-password \
  -e ADMIN_EMAIL=admin@yellowbell.com \
  your-image-name
```

## Email Service Configuration

Choose one of the options below based on your email provider:

### Option 1: Gmail (Recommended for Testing)

**Setup Steps:**

1. Go to https://myaccount.google.com/
2. Click "Security" in the left menu
3. Enable "2-Step Verification" (if not already enabled)
4. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password
5. Copy the app password and use it in your environment variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # The 16-character password from step 4
ADMIN_EMAIL=your-email@gmail.com
```

### Option 2: SendGrid (Best for Production)

**Setup Steps:**

1. Sign up at https://sendgrid.com/
2. Create an API key:
   - Go to Settings → API Keys
   - Create a new "Full Access" API key
   - Copy the key (you'll only see it once)
3. Use these environment variables:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-very-long-api-key-here
ADMIN_EMAIL=admin@yellowbell.com
```

### Option 3: AWS SES (for AWS Users)

**Setup Steps:**

1. Go to AWS Console → SES (Simple Email Service)
2. Verify your email address or domain
3. Create SMTP credentials:
   - Go to Account Dashboard
   - Click "Create My SMTP Credentials"
   - Download the credentials file
4. Use these environment variables:

```env
SMTP_HOST=email-smtp.region.amazonaws.com  # e.g., email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-username-from-credentials-file
SMTP_PASSWORD=your-password-from-credentials-file
ADMIN_EMAIL=verified-sender-email@yourcompany.com
```

### Option 4: Outlook/Microsoft 365

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
ADMIN_EMAIL=your-email@outlook.com
```

## Testing Your Configuration

### Test 1: Check Environment Variables Are Set

```bash
# In your terminal
echo $SMTP_HOST
echo $SMTP_USER
```

You should see the values you set. If they're empty, the environment isn't loaded.

### Test 2: Test the Email API Endpoint

After starting your development server:

```bash
curl -X POST http://localhost:3000/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Email from Yellowbell",
    "htmlBody": "<h1>Hello!</h1><p>This is a test email.</p>",
    "plainTextBody": "Hello! This is a test email.",
    "recipientEmail": "your-email@example.com"
  }'
```

Expected responses:

**Success (200)**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "messageId": "some-id@sendgrid.net"
}
```

**Configuration error (503)**:
```json
{
  "error": "Email service not configured",
  "message": "Please set SMTP credentials in environment variables."
}
```

### Test 3: Monitor Browser Console

1. Open Kitchen page
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Wait for "firebase-inventory-updated" or create an order
5. Look for messages like:
   ```
   [email-notifications] ... 
   ```

### Test 4: Monitor Server Logs

When running locally:
```bash
npm run dev

# You'll see logs like:
# [email-api] Email sent successfully to admin@yellowbell.com
# [email-notifications] Food preparation reminder #1 sent
```

## Troubleshooting

### Problem: "Email service not configured"

**Solution**: Check that environment variables are set:
```bash
# Vercel: Check Project Settings → Environment Variables
# Local: Check .env.local file exists and has the values
# Docker: Check docker run -e flags
```

### Problem: "ECONNREFUSED" or "ETIMEDOUT"

**Solution**: Check SMTP_HOST and SMTP_PORT:
- Gmail: `smtp.gmail.com` and `587`
- SendGrid: `smtp.sendgrid.net` and `587`
- AWS SES: `email-smtp.region.amazonaws.com` and `587`

### Problem: "Authentication failed"

**Solution**: Check SMTP_USER and SMTP_PASSWORD:
- Gmail: Must use app password, not your regular password
- SendGrid: Username must be exactly `apikey`
- AWS SES: Use the correct credentials file values

### Problem: "Invalid email address"

**Solution**: Check ADMIN_EMAIL is a valid email address:
```env
ADMIN_EMAIL=admin@yellowbell.com  # ✅ Correct
ADMIN_EMAIL=admin  # ❌ Missing domain
ADMIN_EMAIL=admin@yellowbell  # ❌ Missing TLD
```

### Problem: Emails not arriving

**Solution**: Check spam folder first, then:
1. Verify sender email is authorized (especially for Gmail)
2. Check email provider's rate limits
3. Look for bounces in email provider's dashboard
4. Consider whitelisting the sender address

## Security Best Practices

1. **Never commit .env file**:
```bash
# Good - in .gitignore
.env.local
.env.production.local
```

2. **Use app passwords instead of account password**:
   - Gmail: Use app password (16 characters)
   - Microsoft: Use app password
   - Never share actual account passwords

3. **Limit API key permissions**:
   - SendGrid: Create separate API keys for different services
   - AWS SES: Use IAM roles with least privilege

4. **Rotate credentials regularly**:
   - Update passwords every 3-6 months
   - Revoke old API keys
   - Update in all environments

5. **Monitor email sending**:
   - Check logs regularly
   - Set up alerts for failed sends
   - Monitor bounce rates

## Additional Notes

- Email notifications check every 5 minutes for orders
- Reminders only send every 30 minutes (configurable)
- Reminder counter resets daily at midnight

> ⚠️ **Offline notifications**
> The in-browser reminders (`checkAndSendFoodPreparationReminder`, `checkAndSendAdvancedOrderNotifications`, `checkAndFireOrderReminders`) run only while a dashboard client is open. To ensure email alerts continue even when no one is logged in or the dashboard is closed, deploy the Cloud Function defined in `functions/index.js`. It reads orders from the Realtime Database (`inventories/orders`) and sends 1‑hour/30‑minute reminders to all admin/staff emails automatically every minute. See the functions folder for setup instructions.
- If email fails, the app continues to work normally
- Failed sends are logged but don't affect the app

---

For more information, see [ISSUES_FIXES_SUMMARY.md](./ISSUES_FIXES_SUMMARY.md)
