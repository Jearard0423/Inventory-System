# Menu-Inventory RTDB Sync Implementation

## Overview
Connected the inventory and menu on Firebase Realtime Database (RTDB) with proper synchronization. Menu items are now automatically synced to a dedicated `/menu/` branch whenever inventory changes.

## RTDB Structure
```
/inventories/
  /items/          - All inventory items (food, containers, utensils)
  /categories/     - Category definitions
  /orders/         - Customer orders
  /kitchen/        - Kitchen items and status
  
/menu/             - Menu items only (food items, no containers/utensils/raw-stock)
  /{itemId}        - Individual menu item with:
    - id, name, category, stock, price, status
    - linkedItems[] - Items required for this menu item with ratios
    - lastUpdated
```

## New Functions Added

### In `lib/firebase-inventory-sync.ts`

1. **saveMenuItemToFirebase(itemId, item)**
   - Saves a single menu item to Firebase RTDB at `/menu/{itemId}`
   - Called when individual menu items are updated

2. **saveMenuToFirebase(menuItems)**
   - Saves all menu items (filtered from inventory) to Firebase
   - Automatically filters out containers, utensils, and raw stock
   - Called during bulk inventory operations

3. **updateMenuStockInFirebase(itemId, newStock, status)**
   - Updates menu item stock and status in Firebase
   - Called whenever inventory stock changes
   - Keeps menu synchronized with inventory in real-time

4. **getMenuFromFirebase()**
   - Fetches all menu items from Firebase RTDB
   - Implementation hook for future menu retrieval needs

5. **Menu Listener in initializeFirebaseSync()**
   - Added real-time listener for `/menu/` branch
   - Dispatches `firebase-menu-updated` event when changes occur
   - Syncs menu data to localStorage for offline access

## Synchronization Flow

### When inventory is updated:
```
inventoryItem.stock += change
    ↓
updateInventoryItem() / updateInventory()
    ↓
saveToLocalStorage()
    ↓
saveInventoryToFirebase() + saveMenuToFirebase()
    ↓
Firebase RTDB (/inventories/items + /menu) updated
    ↓
Real-time listeners trigger UI updates
```

### For individual item stock updates:
```
updateInventoryItem(itemId, newStock)
    ↓
  [If it's a menu item (not container/utensil/raw-stock)]
    ↓
updateMenuStockInFirebase(itemId, newStock, status)
    ↓
Firebase /menu/{itemId} updated instantly
```

## Key Features

✅ **Inventory & Menu Linked** - Menu items automatically reflect inventory stock
✅ **Real-time Sync** - Menu updates pushed to Firebase when inventory changes
✅ **Smart Filtering** - Menu only contains food items (no containers/utensils/raw-stock)
✅ **Linked Items Support** - Menu items can have linkedItems with ratios for ingredient tracking
✅ **Offline Fallback** - Uses localStorage when Firebase permissions denied
✅ **Error Resilience** - Sync failures don't break the app (non-blocking)

## Testing

To verify the menu-inventory sync is working:

1. Add/update an inventory item in the app
2. Check Firebase RTDB console:
   - Should appear in `/inventories/items/{id}` (if inventory)
   - Should appear in `/menu/{id}` (if it's a food item)
3. Check that stock and linked items are properly synced
4. Monitor browser console for sync logs

## Event Hooks

New custom events dispatched:
- `firebase-menu-updated` - Fired when menu data changes in Firebase
- `inventory-updated` - Still fires (already existed, now triggers menu sync)

## Backwards Compatibility

✅ All existing functionality preserved
✅ No breaking changes to API
✅ Graceful degradation if Firebase unavailable
✅ Works with existing Firestore sync alongside RTDB
