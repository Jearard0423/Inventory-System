# Issue Fixes and Email Notification Setup

This document outlines all the issues that were identified and fixed, along with setup instructions for the new email notification feature.

## ✅ Issues Fixed

### 1. Firebase RTDB Inventory Sync Issue
**Problem**: Inventory changes were not being synchronized to Firebase Realtime Database in real-time. Stock changes would revert to default values instead of persisting with the live changes.

**Root Cause**: 
- The `reduceStock()` function only saved to localStorage but didn't sync to Firebase RTDB
- The `updateInventory()` function was trying to use Firestore instead of Firebase RTDB
- No Firebase RTDB sync was happening when orders were placed and inventory was reduced

**Solution Applied**:
1. Updated `reduceStock()` in `/lib/inventory-store.ts` to call `updateMenuStockInFirebase()` for real-time sync
2. Updated `updateInventory()` to use Firebase RTDB `updateMenuStockInFirebase()` instead of Firestore
3. These functions now sync menu items (food items) to Firebase RTDB while maintaining localStorage as fallback

**Files Modified**:
- `/lib/inventory-store.ts` - Added Firebase RTDB sync to `reduceStock()` and `updateInventory()`

### 2. Kitchen View Undo Affecting Delivered Orders
**Problem**: When marking a food as done and then undoing it, previously delivered customers' orders would still show in the customer order details. Users had to mark as delivered again to clear them.

**Root Cause**: 
- The `handleUndoCooked()` function had a fallback mechanism that would undo items from ANY completed order if no incomplete orders had the item
- This fallback included delivered orders, causing kitchen items from delivered customers to be undone

**Solution Applied**:
1. Updated `handleUndoCooked()` in `/app/kitchen/page.tsx` to NEVER fall back when no incomplete orders have the item
2. Added explicit check: `order.status !== 'complete' && order.status !== 'delivered'`
3. Prevents any modifications to items from already delivered orders

**Files Modified**:
- `/app/kitchen/page.tsx` - Fixed the undo logic to exclude delivered orders completely

### 3. Delivery Process Buttons
**Status**: ✅ Already Correct
- Your delivery page already only shows two options:
  1. **Mark as Delivered** - For hand-in/pickup orders
  2. **Mark as Delivered (Lalamove)** - For Lalamove delivery orders
- No changes needed - the UI already matches your requirement

---

## 🆕 Email Notification Feature

### Overview
A new automated email notification system has been implemented that sends reminders every 30 minutes (configurable to 1 hour) when there are orders to be prepared today.

### Features
- **Smart Scheduling**: Only sends reminders when orders exist for the day
- **Interval-Based**: Sends a reminder every 30 minutes (default) or 1 hour (can be configured)
- **Rich HTML Emails**: Formatted emails with order details for easy reading
- **Silent Failure**: If email service fails, the app continues to work normally
- **Daily Reset**: Reminder counter resets at midnight automatically

### Setup Instructions

#### Step 1: Install Nodemailer
```bash
npm install nodemailer
npm install --save-dev @types/nodemailer
```

#### Step 2: Configure Email Service
You need to set up SMTP credentials. The system supports any SMTP service (Gmail, SendGrid, AWS SES, etc.).

**For Gmail:**
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Set these environment variables:

```env
# .env.local or your hosting provider's environment variables
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yellowbell.com
```

**For SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-sendgrid-api-key
ADMIN_EMAIL=admin@yellowbell.com
```

**For AWS SES:**
```env
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-username
SMTP_PASSWORD=your-ses-password
ADMIN_EMAIL=admin@yellowbell.com
```

#### Step 3: Deploy Configuration
Make sure to add the environment variables to your hosting platform:
- **Vercel**: Add in Project Settings → Environment Variables
- **Firebase Hosting + Cloud Functions**: Add in `.env` or Cloud Functions configuration
- **Docker/Self-hosted**: Add to `.env.local` file (add `.env.local` to `.gitignore`)

#### Step 4: Test the Email Service
1. The system will automatically start checking for orders every 5 minutes
2. When orders exist and 30 minutes have passed since the last reminder, an email will be sent
3. Check these files to verify setup:
   - `/lib/email-notifications.ts` - Core notification logic
   - `/app/api/send-notification-email/route.ts` - API endpoint
   - `/app/kitchen/page.tsx` - Integration point (imports email-notifications)

### How It Works

**Trigger**: Every 5 minutes, the kitchen page checks:
```
1. Are there orders for today?
2. Is the order status NOT 'complete' or 'delivered'?
3. Have 30+ minutes passed since the last reminder?
```

**When Conditions Met**:
- A formatted email is sent to the admin (`ADMIN_EMAIL`)
- Email includes:
  - List of incomplete orders with pending items
  - Count of pending items per customer
  - Reminder number (#1, #2, etc.)
  - Next reminder time
  - Current time

**Example Email Subject**:
```
🍖 Yellowbell Kitchen Reminder - Order Preparation (Reminder #1)
```

### Configuration Options

**Reminder Interval** (modify in `/lib/email-notifications.ts`):
```typescript
// Current: 30 minutes
const REMINDER_INTERVAL = 30 * 60 * 1000

// Change to 1 hour:
const REMINDER_INTERVAL = 60 * 60 * 1000
```

**Recipient Email** (modify in API route `/app/api/send-notification-email/route.ts`):
```typescript
// Default: Uses ADMIN_EMAIL from environment
const recipient = recipientEmail || ADMIN_EMAIL

// Or hardcode:
const recipient = recipientEmail || 'admin@yellowbell.com'
```

### Files Created/Modified

**New Files**:
- `/lib/email-notifications.ts` - Email notification logic and scheduler
- `/app/api/send-notification-email/route.ts` - API endpoint for sending emails

**Modified Files**:
- `/app/kitchen/page.tsx` - Added email notification integration

### Testing Without Email Setup

If you haven't configured SMTP yet, the system will:
1. Log messages to the browser console
2. Log to server console with `[email-notifications]` prefix
3. Not crash or interfere with the app's functionality

You can test the logic by:
1. Creating orders in your app for today
2. Opening the kitchen page
3. Waiting 5 minutes for the first check
4. Checking browser console (F12 → Console tab) for logs

### Troubleshooting

**Email not sending?**

1. **Check environment variables**:
   ```bash
   # These should be set in your environment
   echo $SMTP_HOST
   echo $SMTP_USER
   echo $ADMIN_EMAIL
   ```

2. **Check browser console** (F12):
   ```
   Look for messages like:
   [email-notifications] ... 
   [email-api] ...
   ```

3. **Check server logs**:
   - Vercel: Look in Function logs
   - Next.js local: Check terminal output

4. **Common Issues**:
   - Gmail: "Less secure apps" blocked → Use App Password instead
   - SendGrid/AWS: API key has restricted permissions → Check permissions
   - Firewall: Port 587 blocked → Check with hosting provider

5. **Test Email Endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/send-notification-email \
     -H "Content-Type: application/json" \
     -d '{
       "subject": "Test",
       "htmlBody": "<p>Test</p>",
       "plainTextBody": "Test",
       "recipientEmail": "your-email@example.com"
     }'
   ```

### Database Persistence

Email notification state (reminders sent, timing) is stored in browser memory and resets daily at midnight. No database entries are created.

---

## Summary of Changes

| Issue | Status | Solution |
|-------|--------|----------|
| Firebase RTDB sync | ✅ Fixed | Added Firebase sync to inventory updates |
| Kitchen undo affecting delivered | ✅ Fixed | Prevented fallback to delivered orders |
| Delivery buttons | ✅ OK | Already showing only 2 options |
| Email notifications | ✅ Implemented | New feature with 30-min reminder interval |

All fixes have been implemented and are production-ready. Make sure to configure the SMTP credentials for email notifications to work properly.
