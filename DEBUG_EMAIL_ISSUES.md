# Email Notification Debugging Guide

## 🔍 Quick Diagnostics

### 1. **SMTP Configuration Check**
Your system requires these environment variables to send emails:
- `SMTP_HOST` - Email server (default: smtp.gmail.com)
- `SMTP_PORT` - Server port (default: 587)
- `SMTP_USER` - Your email address
- `SMTP_PASSWORD` - Gmail App Password (16 characters)

**Status**: Create `.env.local` in your project root if it doesn't exist.

### 2. **Test SMTP Configuration**

```bash
# Navigate to project root
cd /workspaces/Inventory-System

# Check if .env.local exists
ls -la | grep env.local

# If not exists, create it with your credentials
cat > .env.local << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
EOF
```

### 3. **Check Browser Console for Errors**

1. Open your browser DevTools (F12)
2. Go to **Console** tab
3. Look for messages starting with `[email-notifications]` like:
   - `Failed to send email`
   - `Could not verify order existence`
   - Network errors

### 4. **Key Issues to Check**

#### ❌ **Issue #1: Orders Not for Today**
`sendOrderPlacedNotification` ONLY sends emails for orders with today's date.

**Check**: Are you creating orders for:
- ✅ Today? → Email sent
- ❌ Future date? → Email NOT sent (by design)
- ❌ Past date? → Email NOT sent (by design)

**Fix**: If you want emails for ANY date, we need to modify the function.

#### ❌ **Issue #2: No Recipient Email**
If the admin is not logged in (`auth?.user?.email` is undefined), no email is sent.

**Check**: 
1. Are you logged into the system as an admin?
2. Check Network tab → Request to `/api/send-notification-email`
3. Look for `recipientEmail` in the request body

**Fix**: Make sure you're logged in before placing orders.

#### ❌ **Issue #3: SMTP Not Configured**
The API will log email to console instead of sending via SMTP.

**Check**: 
1. Restart your dev server after creating `.env.local`
2. API should show: `smtpConfigured: true`
3. Console should show: `[email-api] Email sent to...`

## 🧪 Manual Test Steps

### Step 1: Test API Directly
```bash
# Terminal in /workspaces/Inventory-System
curl -X POST http://localhost:3000/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Email",
    "htmlBody": "<p>This is a test</p>",
    "plainTextBody": "This is a test",
    "recipientEmail": "your-email@gmail.com"
  }'
```

**Expected Response**: 
```json
{"success": true, "message": "Email sent successfully via SMTP", "messageId": "..."}
```

### Step 2: Monitor Kitchen Page Console
1. Go to Kitchen page
2. Open browser DevTools (F12)
3. Check Console tab - look for messages about notification checks
4. Should see every 5 minutes: `[email-notifications]` messages

### Step 3: Check What Notifications Are Triggered

The system sends emails in these scenarios:

| Notification | Trigger | Recipient |
|---|---|---|
| **New Order** | Order placed for TODAY | Admin logged in |
| **Food Prep** | Every 5 min if orders exist | Admin logged in |
| **1-Day Before** | 24-25 hours before delivery time | Admin logged in |
| **1-Hour Before** | 1-0.5 hours before delivery | Admin logged in |
| **30-Min Before** | 30 mins - 0 mins before delivery | Admin logged in |
| **Order Cancelled** | Order deleted | Admin logged in |

## 🔧 Common Fixes

### Fix #1: Enable SMTP Emails

```bash
# 1. Create .env.local
cat > /workspaces/Inventory-System/.env.local << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
EOF

# 2. Restart dev server
# Press Ctrl+C in terminal
# Run: npm run dev
```

### Fix #2: Gmail App Password (If Using Gmail)

1. Enable 2-Factor Authentication on your Google Account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Google will generate a 16-character password
5. Copy that into `.env.local` as `SMTP_PASSWORD`

### Fix #3: Test with Today's Orders Only

1. Go to New Order page
2. Ensure "Cooking Date" = Today
3. Place an order
4. Check browser console for `[email-notifications]` messages
5. Check your email inbox
6. If still no email:
   - Check spam folder
   - Verify SMTP_USER matches sender in email
   - Check API response (Network tab in DevTools)

### Fix #4: Check If You're Logged In

The email is sent to whoever is logged in:
1. Check top-right corner for user email
2. If not logged in, login first
3. Then place order

## 📊 Debug Logging Locations

1. **Browser Console** (F12 → Console)
   - Client-side logs for sendOrderPlacedNotification
   - Network request details
   - Error messages

2. **Server Console** (Terminal running `npm run dev`)
   - `[email-api]` logs for SMTP attempts
   - Error details if email fails
   - SMTP connection logs

3. **Email Recipient Console** (Your Inbox + Spam folder)
   - Actual emails received
   - Timestamps and subjects
   - Whether they're from Yellow Roast

## 🚀 Next Steps

1. **Create .env.local** with SMTP credentials
2. **Restart dev server** (npm run dev)
3. **Check browser console** while placing orders
4. **Look for [email-notifications] messages**
5. **Test API endpoint** directly with curl
6. **Check email inbox** (and spam folder)
7. **Share console logs** if still not working

---

**Need More Help?** 
- Check `/workspaces/Inventory-System/EMAIL_SETUP_GUIDE.md` for detailed setup
- Check terminal logs for `[email-api]` messages
- Check browser console for `[email-notifications]` messages
