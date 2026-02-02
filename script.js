// POS System Core JavaScript

// State Management
const state = {
  currentPage: "dashboard",
  sidebarCollapsed: false,
  orders: [],
  menuItems: [
    { id: 1, name: "Chicken Roast", price: 150, category: "Chicken Roast" },
    { id: 2, name: "Liempo", price: 120, category: "Liempo" },
    { id: 3, name: "Sisig", price: 130, category: "Sisig" },
    { id: 4, name: "Yangchow Chicken Meal", price: 180, category: "Meals" },
    { id: 5, name: "Liempo Meal", price: 160, category: "Meals" },
    { id: 6, name: "Yangchow", price: 140, category: "Rice" },
  ],
  currentOrder: {
    items: [],
    customerName: "",
    mealType: "lunch",
    cookingDate: new Date().toISOString().split("T")[0],
    specialRequests: "",
    remarks: "",
    paymentStatus: "not-paid",
    paymentMethod: "cash",
  },
}

// DOM Elements
const sidebar = document.getElementById("sidebar")
const sidebarToggle = document.getElementById("sidebarToggle")
const mainContent = document.getElementById("mainContent")
const pageContent = document.getElementById("pageContent")
const pageTitle = document.getElementById("pageTitle")
const navItems = document.querySelectorAll(".nav-item")

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  loadPage("dashboard")
  setupEventListeners()
})

// Setup Event Listeners
function setupEventListeners() {
  // Sidebar Toggle
  sidebarToggle.addEventListener("click", toggleSidebar)

  // Navigation
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault()
      const page = item.getAttribute("data-page")
      loadPage(page)

      // Update active state
      navItems.forEach((nav) => nav.classList.remove("active"))
      item.classList.add("active")

      // Close sidebar on mobile
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active")
      }
    })
  })

  // Mobile Menu Toggle
  if (window.innerWidth <= 768) {
    const menuToggle = document.createElement("button")
    menuToggle.className = "mobile-menu-toggle"
    menuToggle.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
        `
    document.querySelector(".top-bar").prepend(menuToggle)

    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  }
}

// Toggle Sidebar
function toggleSidebar() {
  sidebar.classList.toggle("collapsed")
  state.sidebarCollapsed = !state.sidebarCollapsed
}

// Load Page Content
function loadPage(page) {
  state.currentPage = page
  pageContent.classList.add("fade-in")

  // Update page title
  const titles = {
    dashboard: "Dashboard",
    orders: "Orders",
    "new-order": "New Order",
    kitchen: "Kitchen View",
    delivery: "Delivery Process",
    inventory: "Inventory",
    notifications: "Notifications",
    sales: "Sales Summary",
  }
  pageTitle.textContent = titles[page] || "Dashboard"

  // Load page content
  switch (page) {
    case "dashboard":
      loadDashboard()
      break
    case "orders":
      loadOrders()
      break
    case "new-order":
      loadNewOrder()
      break
    case "kitchen":
      loadKitchen()
      break
    case "delivery":
      loadDelivery()
      break
    case "inventory":
      loadInventory()
      break
    case "notifications":
      loadNotifications()
      break
    case "sales":
      loadSales()
      break
    default:
      loadDashboard()
  }

  // Remove animation class after animation completes
  setTimeout(() => {
    pageContent.classList.remove("fade-in")
  }, 200)
}

// Page Loading Functions (Placeholders - will be implemented in next steps)
function loadDashboard() {
  pageContent.innerHTML = `
        <div class="grid grid-4">
            <!-- Taking Orders Container -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Taking Orders</h3>
                </div>
                <div class="flex" style="flex-direction: column; gap: var(--spacing-md);">
                    <button class="btn btn-primary btn-lg" onclick="loadPage('new-order')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        New Order
                    </button>
                    <button class="btn btn-secondary btn-lg" onclick="loadPage('orders')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        Advanced Orders
                    </button>
                </div>
                <div style="margin-top: var(--spacing-lg); padding-top: var(--spacing-lg); border-top: 1px solid var(--color-border);">
                    <div class="flex justify-between mb-sm">
                        <span class="text-sm text-secondary">Orders Today</span>
                        <span class="text-sm font-semibold">${state.orders.filter((o) => isToday(o.date)).length}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-sm text-secondary">Advanced Orders</span>
                        <span class="text-sm font-semibold">${state.orders.filter((o) => !isToday(o.date)).length}</span>
                    </div>
                </div>
            </div>

            <!-- Loyal Customers Container -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Loyal Customers</h3>
                    <p class="card-description">Top customers this month</p>
                </div>
                <div class="customer-list">
                    <div class="customer-item">
                        <div class="customer-avatar">JD</div>
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Juan Dela Cruz</div>
                            <div class="text-sm text-secondary">24 orders</div>
                        </div>
                    </div>
                    <div class="customer-item">
                        <div class="customer-avatar">MS</div>
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Maria Santos</div>
                            <div class="text-sm text-secondary">18 orders</div>
                        </div>
                    </div>
                    <div class="customer-item">
                        <div class="customer-avatar">PR</div>
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Pedro Reyes</div>
                            <div class="text-sm text-secondary">15 orders</div>
                        </div>
                    </div>
                </div>
                <button class="btn btn-secondary" style="width: 100%; margin-top: var(--spacing-md);">View All Customers</button>
            </div>

            <!-- Calendar Orders Summary -->
            <div class="card" style="grid-column: span 2;">
                <div class="card-header">
                    <h3 class="card-title">Orders Calendar Summary</h3>
                    <p class="card-description">Upcoming orders overview</p>
                </div>
                <div class="grid grid-4">
                    <div class="summary-card">
                        <div class="summary-label">Today's Orders</div>
                        <div class="summary-value">0</div>
                        <div class="summary-description">Orders placed today</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Tomorrow</div>
                        <div class="summary-value">0</div>
                        <div class="summary-description">Expected orders</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Next Date</div>
                        <div class="summary-value">0</div>
                        <div class="summary-description">No upcoming orders</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Following Date</div>
                        <div class="summary-value">0</div>
                        <div class="summary-description">No further orders</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sales Per Day Section -->
        <div class="grid grid-2" style="margin-top: var(--spacing-xl);">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Sales Per Day</h3>
                    <p class="card-description">Weekly performance</p>
                </div>
                <div class="sales-chart">
                    <div class="chart-bars">
                        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                          .map(
                            (day) => `
                            <div class="chart-bar-container">
                                <div class="chart-bar" style="height: ${Math.random() * 80 + 20}%"></div>
                                <div class="chart-label">${day}</div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
                <div class="sales-summary-grid">
                    <div class="sales-summary-item">
                        <div class="text-sm text-secondary">Today</div>
                        <div class="font-semibold">₱0</div>
                    </div>
                    <div class="sales-summary-item">
                        <div class="text-sm text-secondary">Yesterday</div>
                        <div class="font-semibold">₱0</div>
                    </div>
                    <div class="sales-summary-item">
                        <div class="text-sm text-secondary">This Week</div>
                        <div class="font-semibold">₱0</div>
                    </div>
                    <div class="sales-summary-item">
                        <div class="text-sm text-secondary">This Month</div>
                        <div class="font-semibold">₱0</div>
                    </div>
                </div>
            </div>

            <!-- Inventory Overview -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Inventory / Stocks Overview</h3>
                    <p class="card-description">Current stock levels</p>
                </div>
                <div class="inventory-list">
                    <div class="inventory-item">
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Chicken</div>
                            <div class="text-sm text-secondary">Available</div>
                        </div>
                        <div class="stock-badge stock-good">In Stock</div>
                    </div>
                    <div class="inventory-item">
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Liempo</div>
                            <div class="text-sm text-secondary">Available</div>
                        </div>
                        <div class="stock-badge stock-good">In Stock</div>
                    </div>
                    <div class="inventory-item">
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Rice</div>
                            <div class="text-sm text-secondary">Running Low</div>
                        </div>
                        <div class="stock-badge stock-warning">Low Stock</div>
                    </div>
                    <div class="inventory-item">
                        <div style="flex: 1;">
                            <div class="font-medium text-sm">Vegetables</div>
                            <div class="text-sm text-secondary">Available</div>
                        </div>
                        <div class="stock-badge stock-good">In Stock</div>
                    </div>
                </div>
                <button class="btn btn-secondary" style="width: 100%; margin-top: var(--spacing-md);" onclick="loadPage('inventory')">View Full Inventory</button>
            </div>
        </div>
    `
}

function loadOrders() {
  const selectedDate = new Date()
  const dateString = selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })

  pageContent.innerHTML = `
        <div class="orders-layout">
            <!-- Left Section: Calendar and Payment Summary -->
            <div class="orders-left">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Select Date</h3>
                    </div>
                    <div class="calendar-display">
                        <div class="calendar-date">${dateString}</div>
                        <input type="date" id="orderDatePicker" class="input" value="${selectedDate.toISOString().split("T")[0]}" onchange="updateOrderDate(this.value)">
                    </div>
                </div>

                <div class="card" style="margin-top: var(--spacing-lg);">
                    <div class="card-header">
                        <h3 class="card-title">Payment Summary</h3>
                        <p class="card-description">Orders for selected date</p>
                    </div>
                    <div class="payment-summary">
                        <div class="payment-item">
                            <div class="payment-label">
                                <div class="payment-dot" style="background-color: var(--color-success);"></div>
                                <span>Paid (Cash)</span>
                            </div>
                            <div class="payment-value">₱0</div>
                        </div>
                        <div class="payment-item">
                            <div class="payment-label">
                                <div class="payment-dot" style="background-color: var(--color-info);"></div>
                                <span>Paid (GCash)</span>
                            </div>
                            <div class="payment-value">₱0</div>
                        </div>
                        <div class="payment-item">
                            <div class="payment-label">
                                <div class="payment-dot" style="background-color: var(--color-accent);"></div>
                                <span>Unpaid</span>
                            </div>
                            <div class="payment-value">₱0</div>
                        </div>
                        <div class="payment-item payment-total">
                            <div class="payment-label">
                                <span class="font-semibold">Total</span>
                            </div>
                            <div class="payment-value font-bold">₱0</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Section: Orders List -->
            <div class="orders-right">
                <div class="card">
                    <div class="card-header">
                        <div class="flex justify-between items-center">
                            <div>
                                <h3 class="card-title">Orders</h3>
                                <p class="card-description">0 orders found</p>
                            </div>
                            <button class="btn btn-primary" onclick="loadPage('new-order')">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                                New Order
                            </button>
                        </div>
                    </div>

                    <div class="toggle-switch-container">
                        <div class="toggle-switch">
                            <button class="toggle-btn active" onclick="filterOrders('today')">Orders Today</button>
                            <button class="toggle-btn" onclick="filterOrders('advanced')">Advanced Orders</button>
                        </div>
                    </div>

                    <div class="orders-list" id="ordersList">
                        <div class="empty-state">
                            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            <p>No orders found for this date</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}

function loadNewOrder() {
  const categories = ["All", "Chicken Roast", "Liempo", "Sisig", "Rice", "Meals", "Others"]

  pageContent.innerHTML = `
        <div class="new-order-layout">
            <!-- Left Section: Menu Selection -->
            <div class="new-order-left">
                <div class="card">
                    <div class="card-header">
                        <div class="flex justify-between items-center">
                            <h3 class="card-title">Menu Selection</h3>
                            <div class="flex gap-sm">
                                <button class="btn btn-secondary btn-sm" onclick="addMenu()">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    Add Menu
                                </button>
                                <button class="btn btn-secondary btn-sm" onclick="deleteMenu()">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mb-lg">
                        <input type="text" class="input" placeholder="Search items..." id="menuSearch" onkeyup="filterMenu()">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Customer Name</label>
                        <input type="text" class="input" placeholder="Enter customer name" id="customerName">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Meal Type</label>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="mealType" value="lunch" checked>
                                <span>Lunch</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="mealType" value="dinner">
                                <span>Dinner</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="mealType" value="other">
                                <span>Other</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group" id="cookTimeGroup" style="display: none;">
                        <label class="form-label">Cook Time</label>
                        <select class="input">
                            <option>Select cooking time</option>
                            <option>30 minutes</option>
                            <option>1 hour</option>
                            <option>2 hours</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Cooking Date</label>
                        <input type="date" class="input" value="${new Date().toISOString().split("T")[0]}" id="cookingDate">
                    </div>
                </div>

                <!-- Menu Items -->
                <div class="card" style="margin-top: var(--spacing-lg);">
                    <div class="category-filters">
                        ${categories.map((cat) => `<button class="category-btn ${cat === "All" ? "active" : ""}" onclick="filterCategory('${cat}')">${cat}</button>`).join("")}
                    </div>

                    <div class="menu-grid" id="menuGrid">
                        ${state.menuItems
                          .map(
                            (item) => `
                            <div class="menu-item" onclick="addItemToOrder(${item.id})">
                                <div class="menu-item-name">${item.name}</div>
                                <div class="menu-item-price">${formatCurrency(item.price)}</div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>

                <!-- Additional Fields -->
                <div class="card" style="margin-top: var(--spacing-lg);">
                    <div class="form-group">
                        <label class="form-label">Special Requests</label>
                        <textarea class="input textarea" placeholder="Enter special requests..." id="specialRequests"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Remarks</label>
                        <textarea class="input textarea" placeholder="Enter remarks..." id="remarks"></textarea>
                    </div>
                </div>
            </div>

            <!-- Right Section: Order Summary -->
            <div class="new-order-right">
                <div class="card order-summary-card">
                    <div class="card-header">
                        <div class="flex justify-between items-center">
                            <h3 class="card-title">Order Summary</h3>
                            <button class="btn btn-secondary btn-sm" onclick="clearOrder()">Clear</button>
                        </div>
                    </div>

                    <div class="order-items" id="orderItems">
                        <div class="empty-state" style="padding: var(--spacing-xl);">
                            <p>No items added yet</p>
                        </div>
                    </div>

                    <div class="order-total">
                        <div class="flex justify-between">
                            <span class="font-semibold">Total Amount:</span>
                            <span class="font-bold text-xl" style="color: var(--color-primary);" id="totalAmount">₱0.00</span>
                        </div>
                    </div>

                    <!-- Payment Section -->
                    <div class="payment-section">
                        <h4 class="font-semibold mb-md">Payment Status</h4>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="paymentStatus" value="not-paid" checked onchange="togglePaymentMethod()">
                                <span>Not Paid</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="paymentStatus" value="paid" onchange="togglePaymentMethod()">
                                <span>Paid</span>
                            </label>
                        </div>

                        <div id="paymentMethodSection" style="display: none; margin-top: var(--spacing-md);">
                            <label class="form-label">Payment Method</label>
                            <div class="radio-group">
                                <label class="radio-label">
                                    <input type="radio" name="paymentMethod" value="cash" checked onchange="togglePaymentDetails()">
                                    <span>Cash</span>
                                </label>
                                <label class="radio-label">
                                    <input type="radio" name="paymentMethod" value=" GCash" onchange="togglePaymentDetails()">
                                    <span>GCash</span>
                                </label>
                            </div>

                            <!-- Cash Payment -->
                            <div id="cashPayment" style="margin-top: var(--spacing-md);">
                                <div class="form-group">
                                    <label class="form-label">Amount Given</label>
                                    <input type="number" class="input" placeholder="0.00" id="amountGiven" oninput="calculateChange()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Change</label>
                                    <input type="text" class="input" id="changeAmount" readonly>
                                </div>
                            </div>

                            <!-- GCash Payment -->
                            <div id=" GCashPayment" style="display: none; margin-top: var(--spacing-md);">
                                <div class="form-group">
                                    <label class="form-label">Phone Number</label>
                                    <input type="tel" class="input" placeholder="09XX-XXX-XXXX" id=" GCashPhone">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Reference Number</label>
                                    <input type="text" class="input" placeholder="Enter reference number" id=" GCashRef">
                                </div>
                            </div>
                        </div>
                    </div>

                    <button class="btn btn-accent btn-lg" style="width: 100%;" onclick="placeOrder()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Place Order
                    </button>
                </div>
            </div>
        </div>
    `

  // Setup meal type listener
  document.querySelectorAll('input[name="mealType"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      document.getElementById("cookTimeGroup").style.display = e.target.value === "other" ? "block" : "none"
    })
  })
}

function loadKitchen() {
  pageContent.innerHTML = `
        <div class="kitchen-layout">
            <!-- Items to Cook Section -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Items to Cook Today</h3>
                    <p class="card-description">Cooking workload by meal type</p>
                </div>

                <div class="cooking-groups">
                    <!-- Lunch Items -->
                    <div class="cooking-group">
                        <div class="cooking-group-header">
                            <h4 class="cooking-group-title">Lunch</h4>
                            <span class="cooking-group-count">5 items</span>
                        </div>
                        <div class="cooking-items">
                            <div class="cooking-item">
                                <div class="cooking-item-info">
                                    <div class="cooking-item-name">Chicken Roast</div>
                                    <div class="cooking-item-qty">x3</div>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="markAsDone(this)">Mark as Done</button>
                            </div>
                            <div class="cooking-item">
                                <div class="cooking-item-info">
                                    <div class="cooking-item-name">Liempo</div>
                                    <div class="cooking-item-qty">x2</div>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="markAsDone(this)">Mark as Done</button>
                            </div>
                        </div>
                    </div>

                    <!-- Dinner Items -->
                    <div class="cooking-group">
                        <div class="cooking-group-header">
                            <h4 class="cooking-group-title">Dinner</h4>
                            <span class="cooking-group-count">3 items</span>
                        </div>
                        <div class="cooking-items">
                            <div class="cooking-item">
                                <div class="cooking-item-info">
                                    <div class="cooking-item-name">Sisig</div>
                                    <div class="cooking-item-qty">x1</div>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="markAsDone(this)">Mark as Done</button>
                            </div>
                            <div class="cooking-item">
                                <div class="cooking-item-info">
                                    <div class="cooking-item-name">Yangchow Chicken Meal</div>
                                    <div class="cooking-item-qty">x2</div>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="markAsDone(this)">Mark as Done</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Cooked Items Section -->
            <div class="card" style="margin-top: var(--spacing-xl);">
                <div class="card-header">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="card-title">Cooked Items</h3>
                            <p class="card-description">Items ready for delivery</p>
                        </div>
                        <div class="cooked-count">
                            <span class="text-success font-bold text-lg">0</span>
                            <span class="text-sm text-secondary">items cooked</span>
                        </div>
                    </div>
                </div>
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path>
                        <path d="M7 2v20"></path>
                        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"></path>
                    </svg>
                    <p>No items have been marked as done yet</p>
                </div>
            </div>

            <!-- Customer Orders Summary -->
            <div class="card" style="margin-top: var(--spacing-xl);">
                <div class="card-header">
                    <h3 class="card-title">Customer Orders Summary</h3>
                    <p class="card-description">Order completion status</p>
                </div>

                <div class="grid grid-2">
                    <div class="summary-card">
                        <div class="summary-label">Complete Orders</div>
                        <div class="summary-value text-success">0</div>
                        <div class="summary-description">All items ready</div>
                    </div>
                    <div class="summary-card">
                        <div class="summary-label">Incomplete Orders</div>
                        <div class="summary-value text-warning">0</div>
                        <div class="summary-description">Missing items</div>
                    </div>
                </div>

                <div style="margin-top: var(--spacing-lg);">
                    <div class="order-status-item">
                        <div class="order-status-header">
                            <span class="font-semibold">Walk-in Customer</span>
                            <span class="status-badge status-complete">Complete</span>
                        </div>
                        <div class="order-status-items">
                            <div class="status-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Chicken Roast x2
                            </div>
                            <div class="status-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Yangchow x1
                            </div>
                        </div>
                    </div>

                    <div class="order-status-item">
                        <div class="order-status-header">
                            <span class="font-semibold">Walk-in Customer</span>
                            <span class="status-badge status-incomplete">Incomplete</span>
                        </div>
                        <div class="order-status-items">
                            <div class="status-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Liempo x1
                            </div>
                            <div class="status-item status-missing">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                                Sisig x2 (Missing)
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}

function loadDelivery() {
  pageContent.innerHTML = `
        <div class="delivery-layout">
            <!-- Delivery Summary Cards -->
            <div class="grid grid-3 mb-lg">
                <div class="card">
                    <div class="delivery-stat">
                        <div class="delivery-stat-icon" style="background-color: rgba(16, 185, 129, 0.1);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-success);">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div>
                            <div class="delivery-stat-value text-success">0</div>
                            <div class="delivery-stat-label">Complete Orders</div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="delivery-stat">
                        <div class="delivery-stat-icon" style="background-color: rgba(234, 179, 8, 0.1);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-warning);">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div>
                            <div class="delivery-stat-value text-warning">0</div>
                            <div class="delivery-stat-label">In Progress</div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="delivery-stat">
                        <div class="delivery-stat-icon" style="background-color: rgba(220, 38, 38, 0.1);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--color-accent);">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <div>
                            <div class="delivery-stat-value text-error">0</div>
                            <div class="delivery-stat-label">Incomplete Orders</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ready for Delivery -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Ready for Delivery</h3>
                    <p class="card-description">Orders marked as cooked from Kitchen View</p>
                </div>

                <div class="delivery-list">
                    <div class="delivery-item">
                        <div class="delivery-item-header">
                            <div>
                                <div class="delivery-item-customer">Juan Dela Cruz</div>
                                <div class="delivery-item-date">January 13, 2026 - Lunch</div>
                            </div>
                            <div class="delivery-status-badge status-ready">Ready</div>
                        </div>
                        <div class="delivery-item-content">
                            <div class="delivery-items-list">
                                <div class="delivery-list-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Chicken Roast x2
                                </div>
                                <div class="delivery-list-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Yangchow x1
                                </div>
                            </div>
                            <div class="delivery-item-actions">
                                <button class="btn btn-accent" onclick="markAsDelivered(this)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="1" y="3" width="15" height="13"></rect>
                                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                        <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                        <circle cx="18.5" cy="18.5" r="2.5"></circle>
                                    </svg>
                                    Mark as Delivered
                                </button>
                                <button class="btn btn-secondary">View Details</button>
                            </div>
                        </div>
                    </div>

                    <div class="delivery-item">
                        <div class="delivery-item-header">
                            <div>
                                <div class="delivery-item-customer">Maria Santos</div>
                                <div class="delivery-item-date">January 13, 2026 - Dinner</div>
                            </div>
                            <div class="delivery-status-badge status-incomplete">Incomplete</div>
                        </div>
                        <div class="delivery-item-content">
                            <div class="delivery-items-list">
                                <div class="delivery-list-item">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Liempo x1
                                </div>
                                <div class="delivery-list-item delivery-list-item-missing">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                    Sisig x2 (Not Ready)
                                </div>
                            </div>
                            <div class="delivery-item-actions">
                                <button class="btn btn-secondary" disabled>Waiting for Kitchen</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Delivered Orders -->
            <div class="card" style="margin-top: var(--spacing-xl);">
                <div class="card-header">
                    <h3 class="card-title">Delivered Today</h3>
                    <p class="card-description">0 orders delivered</p>
                </div>
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="1" y="3" width="15" height="13"></rect>
                        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                        <circle cx="5.5" cy="18.5" r="2.5"></circle>
                        <circle cx="18.5" cy="18.5" r="2.5"></circle>
                    </svg>
                    <p>No orders have been delivered yet today</p>
                </div>
            </div>
        </div>
    `
}

function loadInventory() {
  pageContent.innerHTML = '<div class="empty-state"><p>Inventory content loading...</p></div>'
}

function loadNotifications() {
  pageContent.innerHTML = '<div class="empty-state"><p>Notifications content loading...</p></div>'
}

function loadSales() {
  pageContent.innerHTML = '<div class="empty-state"><p>Sales Summary content loading...</p></div>'
}

// Helper Functions for New Order Page
function filterCategory(category) {
  document.querySelectorAll(".category-btn").forEach((btn) => {
    btn.classList.remove("active")
  })
  event.target.classList.add("active")

  const menuGrid = document.getElementById("menuGrid")
  const filteredItems =
    category === "All" ? state.menuItems : state.menuItems.filter((item) => item.category === category)

  menuGrid.innerHTML = filteredItems
    .map(
      (item) => `
        <div class="menu-item" onclick="addItemToOrder(${item.id})">
            <div class="menu-item-name">${item.name}</div>
            <div class="menu-item-price">${formatCurrency(item.price)}</div>
        </div>
    `,
    )
    .join("")
}

function addItemToOrder(itemId) {
  const item = state.menuItems.find((i) => i.id === itemId)
  if (!item) return

  const existingItem = state.currentOrder.items.find((i) => i.id === itemId)
  if (existingItem) {
    existingItem.quantity += 1
  } else {
    state.currentOrder.items.push({ ...item, quantity: 1 })
  }

  updateOrderSummary()
}

function removeItemFromOrder(itemId) {
  state.currentOrder.items = state.currentOrder.items.filter((item) => item.id !== itemId)
  updateOrderSummary()
}

function updateItemQuantity(itemId, change) {
  const item = state.currentOrder.items.find((i) => i.id === itemId)
  if (!item) return

  item.quantity += change
  if (item.quantity <= 0) {
    removeItemFromOrder(itemId)
  } else {
    updateOrderSummary()
  }
}

function updateOrderSummary() {
  const orderItems = document.getElementById("orderItems")
  const totalAmount = document.getElementById("totalAmount")

  if (state.currentOrder.items.length === 0) {
    orderItems.innerHTML = `
            <div class="empty-state" style="padding: var(--spacing-xl);">
                <p>No items added yet</p>
            </div>
        `
    totalAmount.textContent = "₱0.00"
    return
  }

  const total = state.currentOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  orderItems.innerHTML = state.currentOrder.items
    .map(
      (item) => `
        <div class="order-item">
            <div class="order-item-details">
                <div class="order-item-name">${item.name}</div>
                <div class="order-item-price">${formatCurrency(item.price)}</div>
            </div>
            <div class="order-item-controls">
                <button class="qty-btn" onclick="updateItemQuantity(${item.id}, -1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" onclick="updateItemQuantity(${item.id}, 1)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <button class="remove-btn" onclick="removeItemFromOrder(${item.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    `,
    )
    .join("")

  totalAmount.textContent = formatCurrency(total)
}

function clearOrder() {
  state.currentOrder.items = []
  updateOrderSummary()
}

function togglePaymentMethod() {
  const paymentStatus = document.querySelector('input[name="paymentStatus"]:checked').value
  document.getElementById("paymentMethodSection").style.display = paymentStatus === "paid" ? "block" : "none"
}

function togglePaymentDetails() {
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value
  document.getElementById("cashPayment").style.display = paymentMethod === "cash" ? "block" : "none"
  document.getElementById(" GCashPayment").style.display = paymentMethod === " GCash" ? "block" : "none"
}

function calculateChange() {
  const totalAmount = state.currentOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const amountGiven = Number.parseFloat(document.getElementById("amountGiven").value) || 0
  const change = amountGiven - totalAmount
  document.getElementById("changeAmount").value = change >= 0 ? formatCurrency(change) : "₱0.00"
}

function placeOrder() {
  if (state.currentOrder.items.length === 0) {
    alert("Please add items to the order")
    return
  }

  const customerName = document.getElementById("customerName").value
  if (!customerName) {
    alert("Please enter customer name")
    return
  }

  // Create order object
  const order = {
    id: Date.now(),
    customerName,
    items: [...state.currentOrder.items],
    mealType: document.querySelector('input[name="mealType"]:checked').value,
    cookingDate: document.getElementById("cookingDate").value,
    specialRequests: document.getElementById("specialRequests").value,
    remarks: document.getElementById("remarks").value,
    paymentStatus: document.querySelector('input[name="paymentStatus"]:checked').value,
    paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || "cash",
    total: state.currentOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    date: new Date().toISOString(),
  }

  state.orders.push(order)
  alert("Order placed successfully!")

  // Reset order
  state.currentOrder.items = []
  loadPage("orders")
}

function filterOrders(type) {
  document.querySelectorAll(".toggle-btn").forEach((btn) => btn.classList.remove("active"))
  event.target.classList.add("active")
  // Filter logic would go here
}

function addMenu() {
  alert("Add Menu functionality - would open a modal to add new menu items")
}

function deleteMenu() {
  alert("Delete Menu functionality - would open a modal to delete menu items")
}

function filterMenu() {
  const searchTerm = document.getElementById("menuSearch").value.toLowerCase()
  const filteredItems = state.menuItems.filter((item) => item.name.toLowerCase().includes(searchTerm))

  document.getElementById("menuGrid").innerHTML = filteredItems
    .map(
      (item) => `
        <div class="menu-item" onclick="addItemToOrder(${item.id})">
            <div class="menu-item-name">${item.name}</div>
            <div class="menu-item-price">${formatCurrency(item.price)}</div>
        </div>
    `,
    )
    .join("")
}

function updateOrderDate(date) {
  // Update orders display based on selected date
  console.log("Update orders for date:", date)
}

function markAsDone(button) {
  const item = button.closest(".cooking-item")
  item.style.opacity = "0.5"
  button.textContent = "Done!"
  button.disabled = true
  button.classList.remove("btn-primary")
  button.classList.add("btn-secondary")

  setTimeout(() => {
    alert("Item marked as done and moved to delivery queue")
    loadPage("kitchen")
  }, 1000)
}

function markAsDelivered(button) {
  const item = button.closest(".delivery-item")
  item.style.opacity = "0.5"

  setTimeout(() => {
    alert("Order marked as delivered!")
    loadPage("delivery")
  }, 500)
}

// Utility Functions
function formatCurrency(amount) {
  return "₱" + amount.toFixed(2)
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function isToday(date) {
  const today = new Date()
  const checkDate = new Date(date)
  return (
    today.getFullYear() === checkDate.getFullYear() &&
    today.getMonth() === checkDate.getMonth() &&
    today.getDate() === checkDate.getDate()
  )
}
