# Yellow Roast Co. - Smart Notification System (3 Scenarios)

## Overview
The system now sends intelligent email notifications based on when you place an order and whether you set a delivery time. All times are in **Philippines timezone (UTC+8)**.

---

## 📍 SCENARIO 1: No Time Set → IMMEDIATE Notification

### When does it trigger?
When you place an order **WITHOUT setting a delivery time**.

### What happens?
- ✅ Notification is sent **IMMEDIATELY** (right away)
- 🎯 Subject: `🆕 New Order Received - Immediate Preparation Required`
- 📌 Email indicates: **⚠️ NO TIME SET - IMMEDIATE PREPARATION**
- Color scheme: Yellow & Red (urgent alert)

### Flow:
```
Order Placed (No Time) 
    ↓
Email sent INSTANTLY
    ↓
Start preparing immediately
```

### Email Format:
- **Logo**: Yellow Roast Co. branding at top
- **Status**: "NO TIME SET - IMMEDIATE PREPARATION" in red
- **Customer Name**: Highlighted in yellow box
- **Order Items**: Listed with quantities
- **Action**: "⚡ START PREPARATION NOW"

---

## ⏰ SCENARIO 2: Order Today with Delivery Time Within 2 Hours

### When does it trigger?
When you place an order **FOR TODAY** with a **time that's within the next 2 hours**.

### What happens?
- ✅ Notification is sent **IMMEDIATELY** (right away)
- 🎯 Subject: `🆕 New Order - Delivery in [X] Minutes`
- Shows exact time remaining and delivery time
- Color scheme: Yellow & Red (urgent quick prep)

### Flow:
```
Order Placed Today (within 2 hours) 
    ↓
Email sent INSTANTLY with delivery time
    ↓
Quick prep notification
    ↓
Start preparing immediately
```

### Email Format:
- **Time Remaining**: Calculated and shown in minutes
- **Delivery Time**: Exact scheduled time (e.g., "2:30 PM")
- **Urgency**: "START PREPARATION NOW"
- Color: Yellow gradient background

---

## 📅 SCENARIO 3: Future Orders (2+ Days Away with Set Time)

### When does it trigger?
When you place an order for **2 or more days in the future** with a **specific delivery time**.

### What Happens?

#### **3A - One Day Before (24 hours prior):**
- ✅ Email sent **1 day before delivery date**
- 🎯 Subject: `📅 Order Reminder: [Customer]'s Delivery Tomorrow at [Time]`
- Color: Yellow gradient (advance planning)
- Action: "Review ingredients and confirm all items can be prepared"

#### **3B - One Hour Before (on delivery day):**
- ✅ Email sent **1 hour before delivery**
- 🎯 Subject: `⚡ URGENT: [Customer]'s Order - Delivery in 1 Hour`
- Color: Red/Pink (urgent final prep)
- Action: "FINAL PREPARATION: Pack order NOW for immediate delivery!"

### Flow:
```
Order Placed (2+ days future)
    ↓
1 Day Before → Email: "Prepare tomorrow"
    ↓
On Delivery Day, 1 Hour Before → Email: "URGENT - Pack now!"
    ↓
Ready for delivery/pickup
```

### Email Format:
- **1-Day Email**: Blue info box, professional tone
- **1-Hour Email**: Red urgent box, bold warnings
- Both show customer name, delivery date/time, and complete item list

---

## 📊 Quick Reference Table

| **Scenario** | **Trigger** | **Email Sent** | **Icon** | **Urgency** |
|---|---|---|---|---|
| **#1** | No time set | IMMEDIATE | 🆕 | URGENT |
| **#2** | Today, <2 hours away | IMMEDIATE | 🆕 | URGENT |
| **#3A** | 2+ days away | 1 day before | 📅 | Planning |
| **#3B** | Delivery day | 1 hour before | ⚡ | URGENT |

---

## 🎨 Email Design Features

### All Emails Include:
✅ Yellow Roast Co. **logo** at top  
✅ **Branded colors**: Red (#dc2626), Yellow (#fcd34d), matching dashboard  
✅ **Clear hierarchy**: Bold customer names, prominent times  
✅ **Item quantities**: Easy-to-read format with ✕ symbol  
✅ **Action buttons**: Clear "START" or "PACK NOW" instructions  
✅ **Footer**: Timestamps in Philippines timezone + business info  

### Timezone Info:
- All times shown as **Asia/Manila (UTC+8)**
- Dates formatted: "Wednesday, February 26, 2025"
- Time format: "2:30 PM" (12-hour with AM/PM)

---

## 🔧 How to Set Delivery Times

### In the Dashboard:
1. When creating an order, look for **"Delivery Time"** field
2. Enter time in **HH:MM format** (24-hour, e.g., 14:30 for 2:30 PM)
3. Leave **blank** for immediate preparation

### Examples:
- `09:00` = 9:00 AM
- `14:30` = 2:30 PM  
- `18:00` = 6:00 PM
- _(blank)_ = No time set (immediate)

---

## 📋 Testing the Notifications

### Test Scenario 1: Immediate
1. Create order with **NO time** set
2. Should receive email instantly ✉️

### Test Scenario 2: Quick Prep
1. Create order for **today** with time in next 1-2 hours
2. Should receive email instantly showing time remaining

### Test Scenario 3: Advanced
1. Create order for **3 days from now** with time set
2. Wait 1 day → Check email for "Tomorrow" reminder
3. On delivery day, wait 1 hour before time → Check for urgent reminder

---

## 📧 Email Troubleshooting

| Issue | Solution |
|---|---|
| No email received | Check SMTP credentials in `.env.local` |
| Email is late | Network retries happen automatically (up to 3 times) |
| Wrong timezone | System uses Philippines (UTC+8) automatically |
| Email looks plain | HTML emails — check email client supports HTML |
| Duplicate emails | Each scenario sends only once per order |

---

## 🔄 Automatic System Behavior

- **Reminders reset daily** at midnight Philippines time
- **Network failures retry** with exponential backoff (1s, 2s, 4s delays)
- **Each order tracked** to avoid duplicate notifications
- **Deleted orders** don't send reminders
- **Completed orders** don't receive further notifications

---

## 📞 Quick Questions?

- **"I don't see an email"** → Check spam folder first
- **"Wrong time showing?"** → System uses Asia/Manila timezone
- **"When should I get the 1-hour email?"** → 60 minutes before your delivery time
- **"Can I test it?"** → Yes! Create a test order and watch for the email

**All emails are branded with Yellow Roast Co. colors and logos matching your dashboard design.** 🎨
