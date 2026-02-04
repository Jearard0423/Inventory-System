# Inventory System - Issues Analysis

## Overview
After analyzing the codebase, I've identified 5 major issues that need to be addressed. Below is a detailed breakdown of each issue with current implementation details and required fixes.

---

## Issue 1: Missing Delivery Status Indicator on Orders Dashboard

### Current Behavior
- The Orders dashboard ([app/orders/page.tsx](app/orders/page.tsx)) displays orders but **lacks a visual indicator** (checkmark/label) showing if food has been delivered or handed in
- Only payment status is displayed, not delivery status
- Customers' delivery completion status is not visible at a glance

### Root Cause
- Orders display focuses only on payment status
- No badge/label component is used to show delivery/hand-in status
- The `status` field exists in `CustomerOrder` type but isn't displayed in the Orders dashboard

### Current Implementation
- `CustomerOrder` type has a `status` field: `"incomplete" | "complete" | "delivered" | "cooking" | "ready" | "served"`
- Delivery status is tracked in [lib/inventory-store.ts](lib/inventory-store.ts)
- But Orders page only shows payment info, not delivery status

### Required Fix
1. Add a status badge/indicator showing delivery status in orders list
2. Display one of: "Pending", "Cooked", "Delivered", "Handed In"
3. Use different colors for different statuses (e.g., green for delivered)
4. Show this on the "Orders Today" dashboard

---

## Issue 2: New Order and Advance Order Missing Order Information Form

### Current Behavior
- New Order page ([app/new-order/page.tsx](app/new-order/page.tsx)) is cluttered and missing structured order information form like in the attached image
- The form lacks:
  - Delivery options (Hand in / Lalamove) as buttons
  - Cooking date picker
  - Meal type selector
  - Cook time
  - Customer name field structure
  - Phone number field
  - Delivery address field

### Current Implementation
- Has `deliveryType` state but no UI for it
- Customer info is scattered throughout the page
- No cohesive "Order Information" section at the top

### Required Fix
1. Create an "Order Information" section like in the attached image with:
   - Customer Name input
   - Cooking Date picker
   - Meal Type selector (Breakfast, Lunch, Dinner, Other)
   - Cook Time selector
   - Delivery method buttons (Hand in / Lalamove) - radio style
   - Phone Number field (for delivery)
   - Delivery Address field (for delivery)
   - Special requests/remarks textarea

---

## Issue 3: Delivery Page Lacks "Mark as Delivered" or "Handed In" Options

### Current Behavior
- Delivery page ([app/delivery/page.tsx](app/delivery/page.tsx)) has `markOrderAsDelivered()` function
- But lacks option to distinguish between "Delivered" (Lalamove) vs "Handed In" (customer pickup)
- Currently treats all completions the same way

### Current Implementation
```typescript
// In inventory-store.ts
export const markOrderAsDelivered = (orderId: string): boolean => {
  const orderIndex = customerOrders.findIndex(order => order.id === orderId);
  if (orderIndex === -1) return false;
  customerOrders[orderIndex].status = 'delivered';
  // ... rest of code
};
```
- No distinction between delivery types

### Required Fix
1. Add buttons/options to mark order as:
   - "Mark as Handed In" (for Hand in orders)
   - "Mark as Delivered" (for Lalamove orders)
2. Display different labels based on `deliveryMethod` field
3. Update the status appropriately

---

## Issue 4: Inventory Stocks Are Not Accurate in New Order and Advance Order

### Current Behavior
- The inventory levels shown in New Order page don't match actual stock
- When ordering items, the stock doesn't accurately reflect what's available
- The issue stems from:
  1. Stock reduction happening in one place but not persisted correctly
  2. Stock validation is not blocking out-of-stock items
  3. Real-time updates of stock levels aren't reflected in the cart

### Current Implementation
In [lib/inventory-store.ts](lib/inventory-store.ts):
```typescript
export const reduceStock = (itemId: string, quantity: number): boolean => {
  const item = inventoryItems.find(item => item.id === itemId);
  if (!item || item.stock < quantity) return false;
  item.stock -= quantity;
  // ... status update
};
```

### Problems
1. Stock is reduced when order is saved, but no **real-time validation** in cart
2. Multiple items may reduce stock independently but not check total requirements
3. No **out-of-stock detection** to prevent ordering unavailable items
4. Kitchen items are created but don't link back to inventory tracking

### Required Fix
1. Add stock availability check before adding items to cart
2. Display current stock levels for each menu item
3. Disable items that are out of stock
4. Show warning if trying to order more than available
5. Ensure stock persists correctly when order is submitted

---

## Issue 5: Kitchen View Doesn't Show Foods Added and Numbers Are Inaccurate

### Current Behavior
- Kitchen page ([app/kitchen/page.tsx](app/kitchen/page.tsx)) doesn't show items that were just added to an order
- Numbers don't match what customers ordered
- Kitchen staff can't see all items that need to be cooked

### Root Cause
1. Kitchen items are created from orders but the linking isn't clean
2. The `KitchenItem` interface has fields like:
   ```typescript
   interface KitchenItem {
     totalOrdered: number;
     totalCooked: number;
     pending: number;
   }
   ```
   But these aren't updated correctly when items are added

3. Kitchen view filters today's orders but items may not be showing because:
   - Items are per-item-per-order, not aggregated by item name
   - Status updates aren't properly synced
   - Real-time updates aren't triggered

### Current Implementation Issues
In [app/kitchen/page.tsx](app/kitchen/page.tsx):
- Loads from `getKitchenItems()` and `getCustomerOrders()`
- But item quantities don't aggregate properly
- Items aren't showing when first added

### Required Fix
1. Ensure kitchen items are properly created when orders are added
2. Aggregate quantities for same item across multiple orders
3. Show total ordered vs total cooked count accurately
4. Trigger real-time updates when new orders arrive
5. Display all items with correct quantities immediately after order creation

---

## Data Flow Issues

### Current Flow
```
New Order Created → addCustomerOrder() 
  → Creates KitchenItems 
  → Reduces Stock 
  → Saves to localStorage
```

### Problems
1. **No validation** - stock isn't checked before order is created
2. **No real-time sync** - updates don't broadcast properly
3. **No aggregation** - kitchen items duplicate instead of summing quantities
4. **No persistence** - stock reductions may not persist across page refreshes

### Solution Required
1. Add event dispatching for real-time updates
2. Implement proper validation checks
3. Aggregate kitchen items by name
4. Ensure localStorage is properly used

---

## Code Files That Need Modification

1. **[app/orders/page.tsx](app/orders/page.tsx)** - Add delivery status badges
2. **[app/new-order/page.tsx](app/new-order/page.tsx)** - Add Order Information form
3. **[app/delivery/page.tsx](app/delivery/page.tsx)** - Add delivery method distinction
4. **[lib/inventory-store.ts](lib/inventory-store.ts)** - Fix stock management and validation
5. **[app/kitchen/page.tsx](app/kitchen/page.tsx)** - Fix kitchen items display and accuracy

---

## Priority Ranking

1. **HIGH** - Fix inventory accuracy (Issue 4) - This blocks proper ordering
2. **HIGH** - Fix kitchen view items (Issue 5) - Staff can't see what to cook
3. **MEDIUM** - Add Order Information form (Issue 2) - Improves UX
4. **MEDIUM** - Add delivery status indicator (Issue 1) - Visibility improvement
5. **LOW** - Add delivery method distinction (Issue 3) - Nice-to-have feature

---

## Next Steps

Once you review this analysis, I'll proceed with fixing these issues in the following order:
1. Fix inventory and kitchen items (core functionality)
2. Add Order Information form structure
3. Add delivery status indicators
4. Improve delivery method distinction
