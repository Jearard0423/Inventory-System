# 🚨 Email Not Receiving? Quick Fix Guide

## The Most Likely Issues (99% of cases)

### ⚠️ Issue #1: SMTP Not Configured (Most Common)
**Problem**: You don't have a `.env.local` file with email credentials

**How to Fix**:
```bash
# 1. Create .env.local in project root
cat > /workspaces/Inventory-System/.env.local << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
EOF

# 2. Restart dev server
# In your terminal: Ctrl+C, then: npm run dev
```

**How to Get Gmail App Password** (Required for Gmail):
1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification" if not already done
3. Go to https://myaccount.google.com/apppasswords
4. Select "Mail" and "Windows Computer"
5. Google gives you a 16-character password
6. Copy that into `.env.local` as `SMTP_PASSWORD`

---

### ⚠️ Issue #2: Placing Orders for Wrong Date
**Problem**: You're creating orders for FUTURE dates, but system only emails for TODAY's orders

**The Rule**: 
- ✅ Order placed for TODAY → Email sent immediately
- ❌ Order placed for tomorrow/next week → No email (by design)
- ❌ Order placed for past date → No email

**How to Fix**:
When placing an order, set **Cooking Date** = Today's date to get an email

---

### ⚠️ Issue #3: Not Logged In
**Problem**: System needs to know who to send email to (the logged-in admin)

**How to Check**:
1. Look at top-right corner of app
2. Do you see your email address?
3. If not, click "Login" and log in first

**How to Fix**:
1. Login as admin FIRST
2. Then go to "New Order" page
3. Then place order
4. Email should be sent to your admin email

---

## What Emails SHOULD You Be Getting?

| When | Email | Recipient |
|---|---|---|
| **Order placed TODAY** | "New Order Received" | Admin logged in |
| **Every 5 min** | "Kitchen Reminder" | Admin logged in |
| **24h before delivery** | "Order will be ready..." | Admin logged in |
| **1h before delivery** | "Order ready soon..." | Admin logged in |
| **30 min before** | "Order ready in 30 min" | Admin logged in |
| **Order cancelled** | "Order cancelled" | Admin logged in |

---

## How to Test It Worked

### Step 1: Check Terminal Logs
Look at your terminal running `npm run dev`. You should see:
```
[email-api] Email sent to your-email@gmail.com – messageId: ...
```

### Step 2: Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for messages like:
```
[email-notifications] sendOrderPlacedNotification called: ...
[email-notifications] Checking order date: ...
✅ [email-notifications] Sent: 🆕 New Order Received for Today
```

### Step 3: Check Your Email
- ✅ Check Inbox
- ⚠️ Check Spam/Promotions folder (emails might be filtered)
- 📧 From address should be your SMTP_USER email

---

## Advanced Debugging

### Test API Directly
```bash
curl -X POST http://localhost:3000/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Email",
    "htmlBody": "<p>Test email from Yellowbell</p>",
    "plainTextBody": "Test email",
    "recipientEmail": "your-email@gmail.com"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Email sent successfully via SMTP",
  "messageId": "..."
}
```

### Check if SMTP is Actually Configured
```bash
curl http://localhost:3000/api/send-notification-email | grep smtpConfigured
```

Should show: `"smtpConfigured":true`

If it shows `false`, your .env.local is not set up correctly.

---

## Restart Instructions

After creating/modifying `.env.local`:

1. **In your terminal** (where `npm run dev` is running):
   - Press `Ctrl+C` to stop
   
2. **Restart the server**:
   ```bash
   npm run dev
   ```

3. **Wait for "ready in..." message**

4. **Test again**

---

## Still Not Working?

Share these when asking for help:

1. **Terminal output** when placing order (look for `[email-api]` messages)
2. **Browser console output** (F12 → Console, look for `[email-notifications]` messages)
3. **Confirmation**:
   - [ ] .env.local exists with SMTP_USER and SMTP_PASSWORD
   - [ ] Dev server restarted after creating .env.local
   - [ ] Logged in as admin
   - [ ] Placing order for TODAY's date
   - [ ] Check spam folder for emails

---

**Need Help?** Check `/workspaces/Inventory-System/DEBUG_EMAIL_ISSUES.md` for more detailed troubleshooting.
