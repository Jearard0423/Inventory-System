# Firestore Setup - Connect Inventory Products

## What's New
The system is now fully connected to Firestore for inventory management. Products you add will automatically sync to Firebase.

## Setup Steps

### 1. **Check Your Firestore Security Rules**
Go to Firebase Console → Firestore Database → Rules

Your rules should allow reads and writes:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /inventory/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 2. **Add Initial Products (One-Time)**
If you haven't already added products to Firestore:
- Go to Firestore Console → Collection → `inventory`
- Add documents using the JSON format from the inventory guide
- Each document ID should match the product ID (1, 2, 3, etc.)
- Use these fields:
  - `id` (string)
  - `name` (string)
  - `category` (string: chicken, liempo, sisig, meals, rice, container, utensil)
  - `stock` (number)
  - `price` (number)
  - `status` (string: in-stock, low-stock, out-of-stock)
  - `isContainer` (boolean, optional)
  - `isUtensil` (boolean, optional)

### 3. **How It Works Now**
- **App Startup**: Loads all products from Firestore automatically
- **Add Product**: New products are saved to **both** Firestore and localStorage
- **Real-time Sync**: Any changes in Firestore are reflected in your app
- **Offline Mode**: If Firebase is down, app uses localStorage

### 4. **Add Products in Your App**
1. Go to Inventory page
2. Click "+ Add Product"
3. Fill in name, category, stock, and price
4. Click Save → **Automatically saved to Firestore** ✓

### 5. **Troubleshooting**

**Products not showing?**
```
Check browser console (F12):
- Look for logs like "Loaded X items from Firestore"
- Check for permission errors
```

**Products not saving to Firestore?**
```
- Verify Firestore rules (step 1)
- Check if user is authenticated
- Look for error messages in console
```

**Still using localStorage products?**
```
- Clear localStorage: Open DevTools → Application → Local Storage → Clear All
- Refresh page
- Products should load from Firestore now
```

## File Changes Made
- **Created**: `lib/firestore-sync.ts` - Firestore sync functions
- **Updated**: `components/firebase-sync-initializer.tsx` - Loads from Firestore on app start
- **Updated**: `lib/firebase.ts` - Added Firestore initialization
- **Updated**: `lib/inventory-store.ts` - Uses Firestore save for new products

## Testing
1. Open DevTools → Console
2. You should see: `"Loaded X items from Firestore"`
3. Add a new product
4. Check Firestore Console → `inventory` collection → New document appears ✓

All set! Your products are now saved and synced with Firestore. 🚀
