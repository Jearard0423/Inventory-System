# Email Debugging Checklist - See Where It's Failing

If you're not receiving emails, follow this step-by-step checklist to identify the exact problem.

---

## 🔍 Step 1: Check Browser Console (F12 → Console Tab)

### What to look for:

**✅ If you see this - the notification function was TRIGGERED:**
```
[email-notifications] sendOrderPlacedNotification called: { 
  recipientEmail: "your@email.com", 
  orderId: "12345", 
  orderDate: "2025-02-26", 
  cookTime: "14:30" 
}
```

- **With cookTime:** Order placed with a specific time
- **No cookTime field:** Order placed WITHOUT a time

**❌ If you DON'T see this:**
- Order creation failed
- Email notification code didn't run
- User might not be logged in

---

## 🔍 Step 2: Check If You're Logged In

In the browser console, run:
```javascript
console.log(auth?.user?.email)
```

**❌ If you see `undefined`:** You are NOT logged in properly
- Log out and log back in
- Clear browser cache
- Try a different email account

**✅ If you see your email (e.g., "admin@example.com"):** Login is fine

---

## 🔍 Step 3: Check Network Tab (F12 → Network Tab)

1. Open Developer Tools (F12)
2. Click **Network** tab
3. Filter by: **`send-notification-email`**
4. Place a new order
5. Look for the request

### What you should see:

**Request to:** `/api/send-notification-email`  
**Method:** `POST`  
**Status:** Should be `200` (if success) or `500` (if error)

**Response body example:**
```json
{
  "success": true,
  "message": "Email sent successfully via SMTP",
  "recipient": "your@email.com",
  "messageId": "abc123@smtp.gmail.com"
}
```

### Problems you might see:

| Status | Meaning | Solution |
|--------|---------|----------|
| **No request appears** | Email code didn't run | Check console - user not logged in? |
| **400** | Missing email field | Bug in order creation |
| **500 + "SMTP not configured"** | SMTP credentials missing | Set `.env.local` variables |
| **500 + "Failed to send"** | SMTP credentials wrong | Check Gmail app password |
| **Timeout** | Network issue | Check internet, SMTP host |

---

## 🔍 Step 4: Check Console for SMTP Configuration

Look for these messages in the console:

### ✅ GOOD Messages:
```
[email-api] SMTP transporter created successfully
[email-api] ✅ Email sent to your@email.com – messageId: ...
✅ [email-notifications] Sent: 🆕 New Order Received...
```

### ❌ BAD Messages:
```
SMTP credentials not set in .env.local – emails will be logged only
[email-api] ❌ Error sending email: Invalid login
[email-api] ❌ Error sending email: Connection timeout
```

---

## 🔧 Step 5: SMTP Configuration Check

### If you see "SMTP credentials not configured":

1. **Check if `.env.local` exists** in the root:
   ```bash
   ls -la .env.local
   ```

2. **It should contain:**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-char-app-password
   ```

3. **Generate Gmail App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Choose "Mail" and "Windows Computer"
   - Copy the 16-character password
   - Paste into `.env.local`

4. **After updating `.env.local`:**
   - Restart the dev server: `npm run dev`
   - Refresh the browser
   - Try placing an order again

---

## 🔍 Step 6: Test Email Endpoint Directly

In the browser console, run:
```javascript
fetch('/api/send-notification-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subject: 'Test Email',
    htmlBody: '<h1>Test</h1>',
    plainTextBody: 'Test',
    recipientEmail: 'your@email.com'
  })
})
.then(r => r.json())
.then(d => console.log('Response:', d))
```

### Expected responses:

**✅ Success:**
```json
{ "success": true, "message": "Email sent successfully via SMTP" }
```

**✅ Simulated (no SMTP):**
```json
{ "success": true, "simulated": true, "message": "SMTP credentials not configured..." }
```

**❌ Error:**
```json
{ "success": false, "error": "Failed to send email", "message": "..." }
```

---

## 📊 Troubleshooting Table

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| No email, NO console logs | Not logged in | Login in dashboard |
| No email, console shows "sendOrderPlacedNotification called" | SMTP not configured | Add `.env.local` |
| Email received LATE (after 5-10s) | Network retrying | Normal, retries 3x |
| Email never received, network shows 500 | SMTP password wrong | Check app password |
| Email received but looks plain | HTML rendering issue | Check client email app |
| Same email received repeatedly | Duplicate request | Check if order was created multiple times |

---

## 🧪 Quick Test Scenarios

### Scenario 1: Immediate Notification (No Time Set)
1. Logged in? ✓  SMTP set? ✓
2. Create order **WITHOUT** setting delivery time
3. Look for console: "IMMEDIATE PREPARATION REQUIRED"
4. Email should arrive within 2 seconds

### Scenario 2: Quick Prep (Today, <2 hrs)
1. Current time: 2:00 PM
2. Create order for TODAY with delivery time 2:45 PM (45 min away)
3. Look for console: "Delivery in ~45 minutes"
4. Email should arrive within 2 seconds

### Scenario 3: Advanced (Future Order)
1. Create order for 3 days from now at 3:00 PM
2. NO email should come immediately ✓ (correct behavior)
3. Wait 1 day...
4. Then 1 day before delivery: CHECK EMAIL
5. On delivery day, 1 hour before: CHECK EMAIL

---

## 🚀 Final Checklist Before Asking for Help

- [ ] Logged in with valid Gmail account
- [ ] `.env.local` has all 4 SMTP variables
- [ ] Dev server restarted after editing `.env.local`
- [ ] Browser console shows `sendOrderPlacedNotification called`
- [ ] Network tab shows `/api/send-notification-email` request
- [ ] Response shows `"success": true` (or `"simulated": true`)
- [ ] Gmail account has 2FA enabled
- [ ] App password is 16 characters
- [ ] Email received within 10 seconds (with retries)

---

## 📞 If Still Not Working

Share these from browser console:
1. Output of running `auth?.user?.email`
2. First 3 lines of console output when placing order
3. Network response from `/api/send-notification-email`
4. Whether `.env.local` exists and has values

This will help diagnose the exact problem! 🔧
