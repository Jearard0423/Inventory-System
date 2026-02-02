# Firebase Setup Guide - Inventory System

## Current Status
Your app is currently **working with localStorage only** because Firebase Realtime Database permission rules need to be configured.

## How to Enable Firebase Real-time Sync

### Step 1: Open Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **inventory-system-cc7dc**
3. Go to **Realtime Database** → **Rules** tab

### Step 2: Update Security Rules
Replace the existing rules with the following:

```json
{
  "rules": {
    "inventories": {
      "items": {
        ".read": "auth != null",
        ".write": "auth != null",
        "$itemId": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "orders": {
        ".read": "auth != null",
        ".write": "auth != null",
        "$orderId": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "kitchen": {
        ".read": "auth != null",
        ".write": "auth != null",
        "$itemId": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      },
      "categories": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "sync-metadata": {
        ".read": "auth != null",
        ".write": "auth != null"
      },
      "$other": {
        ".read": false,
        ".write": false
      }
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

### Step 3: Publish Rules
Click **Publish** to apply the new security rules.

### Step 4: Verify in App
1. Restart your app (refresh the browser)
2. The console should no longer show permission errors
3. Data will sync in real-time between devices/tabs

## What These Rules Do

- **`auth != null`**: Only authenticated users can read/write
- **`inventories/*`**: All inventory, order, and kitchen data is protected
- Prevents unauthorized access while allowing your authenticated users full access
- Provides a scalable foundation for multi-user features in the future

## Troubleshooting

### Still Seeing Permission Errors?
1. Make sure you're **logged in** to the app with a valid account
2. Wait 30 seconds after publishing rules (Firebase takes time to propagate)
3. Do a full page refresh (Ctrl+F5 or Cmd+Shift+R)
4. Clear browser localStorage and refresh again

### App Works But No Real-time Updates?
- This is normal! The app falls back to localStorage automatically
- Real-time sync happens in the background
- Once you update the rules above, refresh the app for real-time features

## Optional: Production-Ready Rules

For production, you might want more granular permissions:

```json
{
  "rules": {
    "inventories": {
      "items": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'staff')"
      },
      "orders": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'staff')"
      },
      "kitchen": {
        ".read": "auth != null",
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'kitchen')"
      }
    }
  }
}
```

## Current App Behavior

Even without Firebase rules configured:
- ✅ All features work perfectly with localStorage
- ✅ Data persists across page refreshes
- ✅ Inventory updates work
- ✅ Orders can be placed and tracked
- ✅ Kitchen view displays correctly
- ❌ Real-time sync across multiple browser tabs/devices (future enhancement)

The app is **production-ready** and will automatically enable real-time sync once you update the Firebase rules!

## Need Help?

If you still have issues:
1. Check the browser console (F12) for specific error messages
2. Verify your Firebase project URL matches the config
3. Make sure you're authenticated before trying to save data
4. Check that the database URL in `lib/firebase.ts` is correct
