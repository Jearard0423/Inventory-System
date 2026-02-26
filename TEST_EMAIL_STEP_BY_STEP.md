# ✅ Testing Email Notifications - Step by Step

Your SMTP is working! ✓ (Test email was successfully sent)

Now let's test the **actual order notification** to see why it's not being triggered.

## 🧪 Test Scenario - FOLLOW EXACTLY

### Step 1: Open DevTools
1. Open your app in browser: http://localhost:3000
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Keep it open while testing

### Step 2: Login (CRITICAL!)
1. Login as admin 
2. You should see your email in the **top-right corner**
3. **If not logged in, email will NOT be sent**

### Step 3: Place Order for TODAY (CRITICAL!)
1. Navigate to **New Order** page
2. Fill in order details
3. **IMPORTANT**: Set "Cooking Date" = **TODAY's date** (not future)
4. Click "Place Order"

### Step 4: Check Console Logs
With DevTools Console open, you should see messages like:

```
[kitchen-page] 🔄 Notification check: X orders, recipient: ✓
[email-notifications] sendOrderPlacedNotification called: {…}
[email-notifications] Checking order date: {…}
✅ [email-notifications] Sent: 🆕 New Order Received for Today
📨 [email-notifications] Sending email: {…}
✅ [email-notifications] Sent: 🆕 New Order Received for Today
```

### Step 5: Check Terminal Logs
In the terminal running `npm run dev`, look for:

```
[email-api] Email sent to yellowroastco2024@gmail.com – messageId: ...
```

### Step 6: Check Email Inbox
- Check **yellowroastco2024@gmail.com** inbox
- Also check **Spam** folder
- Look for email with subject: "**🆕 New Order Received for Today**"

---

## 🔍 Debugging - What Could Be Wrong?

### ❌ Console shows: "No recipient email provided"
**Problem**: You're not logged in
**Fix**: Login before placing order

### ❌ Console shows: "Order is not for today"
**Problem**: You set cooking date to future date
**Fix**: Set cooking date to TODAY

### ❌ Console shows nothing with [email-notifications]
**Problem**: Orders are being filtered out somewhere
**Fix**: Check if order is being saved at all
- Check Local Storage (DevTools → Application → localStorage)
- Look for "yellowbell_customer_orders"

### ❌ Terminal shows no [email-api] messages
**Problem**: Email function never called the API
**Fix**: Check the error logs - look for ❌ messages in console

### ✅ Sent but email not in inbox?
**Problem**: Email filtered to spam or wrong inbox
**Fix**: 
1. Check spam/promotions folder
2. Add sender to contacts
3. Try again

---

## 📋 Order Placement Checklist

Before placing order, verify:
- [ ] Logged in (email visible in top-right)
- [ ] Customer Name filled in
- [ ] At least one item added
- [ ] Cooking Date = TODAY (not tomorrow)
- [ ] Cook Time filled in (HH:MM format)
- [ ] Amount Given field visible
- [ ] DevTools Console open to watch logs

---

## 🚀 What Should Happen (Timeline)

1. **IMMEDIATELY**: Browser console should show `sendOrderPlacedNotification called`
2. **Within 1 second**: Should show `📨 Sending email`
3. **Within 5 seconds**: Should show `✅ Sent` message
4. **In terminal**: Should see `[email-api] Email sent`
5. **In email inbox**: Should receive email within 30 seconds

---

## 💡 Advanced Testing

### Manual API Test (Advanced)
If the order notification doesn't trigger, test the API directly:

```bash
# Replace YOUR_EMAIL with your actual email
curl -X POST http://localhost:3000/api/send-notification-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test Order Email",
    "htmlBody": "<p>This is a test order notification</p>",
    "plainTextBody": "This is a test order notification",
    "recipientEmail": "yellowroastco2024@gmail.com"
  }'
```

Should return:
```json
{"success": true, "message": "Email sent successfully via SMTP"}
```

---

## 📞 Getting Help

If it still doesn't work, share:
1. **Are you logged in?** (Y/N)
2. **What date did you set for cooking date?** (today/tomorrow/other)
3. **Console logs** - Copy the [email-notifications] messages
4. **Terminal logs** - Copy any [email-api] messages
5. **Did you place order for TODAY specifically?** (Y/N)

---

## ⚠️ Common Mistakes

| Mistake | Impact | Fix |
|---------|---------|------|
| Not logged in | No recipient email → no email sent | Login first |
| Order for tomorrow | Skipped (not today) → no email sent | Use today's date |
| Empty fields | Order validation fails | Fill all required fields |
| Spam folder | Looks like no email sent | Check spam folder |
| Not restarted server | Old env variables → SMTP fails | Restart npm run dev |
