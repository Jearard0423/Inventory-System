"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { TimePicker } from "@/components/ui/time-picker"
import { MobileTimePicker } from "@/components/ui/mobile-time-picker"
import { Plus, Search, Trash2, X, Package, Calendar, Clock, User, MapPin, CreditCard, ChevronDown, PlusCircle, Trash, Loader2, Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus as PlusIcon, AlertTriangle, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { getInventory, getMenuItems, reduceStock, reduceUtensilsForMeal, reduceContainerForItem, saveOrder, checkAndWarnStockForItem, checkTotalCartStockRequirements, type InventoryItem, addMenuItem, deleteMenuItem, canOrderItem, canOrderCart, getItemStock } from "@/lib/inventory-store"
import { getCustomerAnalytics, type CustomerData } from "@/lib/customers"
import { generateOrderNumber } from "@/lib/orders"
import { useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"

const categories = ["All", "Chicken", "Liempo", "Sisig", "Rice", "Meals"]
const mealTypes = ["Breakfast", "Lunch", "Dinner", "Other"]
const menuCategories = ["chicken", "liempo", "sisig", "rice", "meals"]

// Helper function to convert 24-hour time to 12-hour format
const formatTimeForDisplay = (time24: string): string => {
  if (!time24) return ""
  
  try {
    const [hour24, minute] = time24.split(":").map(Number)
    const period = hour24 >= 12 ? "PM" : "AM"
    const displayHour = hour24 % 12 || 12 // Convert 0 to 12, 13 to 1, etc.
    
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
  } catch (error) {
    return time24 // Fallback to original format if parsing fails
  }
}

// Helper function to get current meal type based on current time
const getCurrentMealType = (): string => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const totalMinutes = currentHour * 60 + currentMinute;
  
  if (totalMinutes >= 5 * 60 && totalMinutes < 11 * 60) {
    return "Breakfast";
  } else if (totalMinutes >= 11 * 60 && totalMinutes < 17 * 60) {
    return "Lunch";
  } else if (totalMinutes >= 17 * 60 || totalMinutes < 5 * 60) {
    return "Dinner";
  }
  
  return "Other";
};

// Helper function to get appropriate meal type for the selected date (will be defined inside component)
const getMealTypeForSelectedDate = (cookingDate: string): string => {
  // If no cooking date is selected, use current time
  if (!cookingDate) {
    return getCurrentMealType();
  }
  
  const selectedDate = new Date(cookingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);
  
  // If the selected date is in the future, default to Breakfast
  if (selectedDate > today) {
    return "Breakfast";
  }
  
  // If the selected date is today, use current meal type
  if (selectedDate.getTime() === today.getTime()) {
    return getCurrentMealType();
  }
  
  // For past dates, default to "Other"
  return "Other";
};

export default function NewOrderPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedMealType, setSelectedMealType] = useState<string>(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    
    if (totalMinutes >= 5 * 60 && totalMinutes < 11 * 60) {
      return "Breakfast";
    } else if (totalMinutes >= 11 * 60 && totalMinutes < 17 * 60) {
      return "Lunch";
    } else if (totalMinutes >= 17 * 60 || totalMinutes < 5 * 60) {
      return "Dinner";
    }
    
    return "Other";
  })
  const [orderItems, setOrderItems] = useState<Array<{ id: string; name: string; price: number; quantity: number }>>([])
  const [paymentStatus, setPaymentStatus] = useState<"not-paid" | "paid">("not-paid")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash")
  const [customerName, setCustomerName] = useState("")
  const [cookingDate, setCookingDate] = useState("")
  const [cookTime, setCookTime] = useState("")
  const [menuItems, setMenuItems] = useState<InventoryItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [amountGiven, setAmountGiven] = useState("")
  const [gcashPhone, setGcashPhone] = useState("")
  const [gcashReference, setGcashReference] = useState("")
  const [deliveryPhone, setDeliveryPhone] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [specialRequests, setSpecialRequests] = useState("")
  const [remarks, setRemarks] = useState("")
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [loyalCustomers, setLoyalCustomers] = useState<CustomerData[]>([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAddMenuModal, setShowAddMenuModal] = useState(false)
  const [showDeleteMenuModal, setShowDeleteMenuModal] = useState(false)
  const [showDeleteSelectionModal, setShowDeleteSelectionModal] = useState(false)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null)
  const [newCategory, setNewCategory] = useState("")
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [newMenuItem, setNewMenuItem] = useState({
    name: "",
    category: "chicken",
    stock: 10,
    price: 0
  })
  const [deliveryType, setDeliveryType] = useState<"Hand in" | "Lalamove">("Hand in")
  const [showGcashQrModal, setShowGcashQrModal] = useState(false)

  // Auto-set current date on component mount
  useEffect(() => {
    const today = new Date()
    const formattedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
    setCookingDate(formattedDate)
  }, [])

  // Update meal type when cooking date changes
  useEffect(() => {
    if (cookingDate) {
      const appropriateMealType = getMealTypeForSelectedDate(cookingDate);
      setSelectedMealType(appropriateMealType);
    }
  }, [cookingDate])

  useEffect(() => {
    const loadInventory = () => {
      const inventory = getMenuItems().filter((item) => item.category !== "others" && item.stock > 0)
      setMenuItems(inventory)
    }

    const loadCustomers = () => {
      setLoyalCustomers(getCustomerAnalytics())
    }

    loadInventory()
    loadCustomers()
    window.addEventListener("inventory-updated", loadInventory)
    window.addEventListener("orders-updated", loadCustomers)
    return () => {
      window.removeEventListener("inventory-updated", loadInventory)
      window.removeEventListener("orders-updated", loadCustomers)
    }
  }, [])

  const getCategoryKey = (displayCategory: string) => {
    const map: Record<string, string> = {
      Chicken: "chicken",
      Liempo: "liempo",
      Sisig: "sisig",
      Rice: "rice",
      Meals: "meals",
    }
    
    // Check if it's a default category
    if (map[displayCategory]) {
      return map[displayCategory]
    }
    
    // Check if it's a custom category (already in lowercase)
    if (customCategories.includes(displayCategory.toLowerCase())) {
      return displayCategory.toLowerCase()
    }
    
    // Return the category as-is for any other case
    return displayCategory.toLowerCase()
  }

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === getCategoryKey(selectedCategory)
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const addToOrder = (item: InventoryItem) => {
    // Check if item is out of stock
    if (item.stock <= 0) {
      setErrors(prev => ({ ...prev, orderItems: `${item.name} is out of stock!` }))
      return
    }

    const existing = orderItems.find((i) => i.id === item.id)
    const newQuantity = existing ? existing.quantity + 1 : 1
    
    // Validate against actual stock
    if (!canOrderItem(item.id, newQuantity)) {
      setErrors(prev => ({ ...prev, orderItems: `Only ${item.stock} units of ${item.name} available!` }))
      return
    }
    
    let updatedCart: Array<{ id: string; name: string; price: number; quantity: number }>;
    
    if (existing) {
      updatedCart = orderItems.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      updatedCart = [...orderItems, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
    }
    
    // Clear previous error for orderItems
    setErrors(prev => ({ ...prev, orderItems: "" }))
    
    // Update the cart
    setOrderItems(updatedCart);
    
    // Check total cart stock requirements
    checkTotalCartStockRequirements(updatedCart);
  }

  const removeFromOrder = (id: string) => {
    const updatedCart = orderItems.filter((i) => i.id !== id);
    setOrderItems(updatedCart);
    checkTotalCartStockRequirements(updatedCart);
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeFromOrder(id)
      return
    }
    
    const item = orderItems.find((i) => i.id === id)
    const inventoryItem = menuItems.find(inv => inv.id === id)
    
    if (item && inventoryItem) {
      // Use canOrderItem to check actual stock
      if (!canOrderItem(id, quantity)) {
        const currentStock = getItemStock(id)
        setErrors(prev => ({ ...prev, orderItems: `Only ${currentStock} units of ${inventoryItem.name} available!` }))
        return
      }
    }
    
    setErrors(prev => ({ ...prev, orderItems: "" }))
    const updatedCart = orderItems.map((i) => (i.id === id ? { ...i, quantity } : i))
    setOrderItems(updatedCart);
    checkTotalCartStockRequirements(updatedCart);
  }

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const amountGivenNum = Number.parseFloat(amountGiven) || 0
  const change = amountGivenNum - total

  // Filter customers based on input
  const filteredCustomers = loyalCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(customerName.toLowerCase())
  )

  // Show suggestions only when there's input and matches exist
  const showSuggestions = customerName.trim() !== "" && filteredCustomers.length > 0 && showCustomerSuggestions

  useEffect(() => {
    // Auto-fill amount given with total when payment status changes to paid
    if (paymentStatus === "paid" && paymentMethod === "cash") {
      setAmountGiven(total.toString())
    }
  }, [paymentStatus, paymentMethod, total])

  useEffect(() => {
    // Update amount given when total changes if payment is paid with cash
    if (paymentStatus === "paid" && paymentMethod === "cash" && amountGiven) {
      setAmountGiven(total.toString())
    }
  }, [total])

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay()
  }

  const handleDateSelect = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day)
    const formattedDate = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    setCookingDate(formattedDate)
    setShowDatePicker(false)
    setErrors((prev) => ({ ...prev, cookingDate: "" }))
  }

  // Auto-select today's date when opening date picker
  const handleDatePickerOpen = () => {
    const today = new Date()
    setSelectedMonth(today.getMonth())
    setSelectedYear(today.getFullYear())
    setShowDatePicker(true)
  }

  const validateOrder = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!customerName.trim()) {
      newErrors.customerName = "Customer name is required"
    }

    if (!cookingDate) {
      newErrors.cookingDate = "Cooking date is required"
    }

    if (selectedMealType === "Other" && !cookTime) {
      newErrors.cookTime = "Cook time is required for Other meal type"
    }

    if (orderItems.length === 0) {
      newErrors.orderItems = "Please add at least one item to the order"
    }

    if (deliveryPhone.trim()) {
      const phoneRegex = /^(09|\+639)\d{9}$/
      if (!phoneRegex.test(deliveryPhone.replace(/[-\s]/g, ""))) {
        newErrors.deliveryPhone = "Invalid phone number format (e.g., 09XX-XXX-XXXX)"
      }
    }

    if (paymentStatus === "paid") {
      if (paymentMethod === "cash") {
        if (!amountGiven || amountGivenNum <= 0) {
          newErrors.amountGiven = "Amount given is required"
        } else if (amountGivenNum < total) {
          newErrors.amountGiven = "Amount given must be greater than or equal to total"
        }
      } else if (paymentMethod === "gcash") {
        // Make phone number optional but validate format if provided
        if (gcashPhone.trim()) {
          const phoneRegex = /^(09|\+639)\d{9}$/
          if (!phoneRegex.test(gcashPhone.replace(/[-\s]/g, ""))) {
            newErrors.gcashPhone = "Invalid phone number format (e.g., 09XX-XXX-XXXX)"
          }
        }

        // Reference number is now optional
        if (gcashReference.trim() && gcashReference.length < 10) {
          newErrors.gcashReference = "Reference number must be at least 10 characters if provided"
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePlaceOrder = () => {
    if (!validateOrder()) {
      // Scroll to customer name field if it's missing
      if (!customerName.trim()) {
        const customerNameField = document.getElementById('customer-name')
        if (customerNameField) {
          customerNameField.scrollIntoView({ behavior: 'smooth', block: 'center' })
          customerNameField.focus()
        }
      }
      return
    }
    setShowConfirmation(true)
  }

  const handleGcashPhoneChange = (value: string) => {
    // Remove all non-digit characters
    let digitsOnly = value.replace(/\D/g, '')
    
    // Ensure it starts with 09 and limit to 11 digits
    if (digitsOnly.length > 0) {
      // If user starts with 9, prepend 0
      if (digitsOnly.startsWith('9') && digitsOnly.length <= 10) {
        digitsOnly = '0' + digitsOnly
      }
      // If user starts with 0, ensure next digit is 9
      else if (digitsOnly.startsWith('0')) {
        if (digitsOnly.length === 1) {
          digitsOnly = '09'
        } else if (!digitsOnly.startsWith('09')) {
          digitsOnly = '09' + digitsOnly.slice(1)
        }
      }
      // If user starts with other digits, replace with 09
      else if (!digitsOnly.startsWith('09')) {
        digitsOnly = '09'
      }
      
      // Limit to 11 digits
      digitsOnly = digitsOnly.slice(0, 11)
      
      // Format with dashes: 09XXX-XXX-XXX
      if (digitsOnly.length > 0) {
        let formatted = digitsOnly
        if (digitsOnly.length > 4) {
          formatted = digitsOnly.slice(0, 4) + '-' + digitsOnly.slice(4)
        }
        if (digitsOnly.length > 7) {
          formatted = formatted.slice(0, 8) + '-' + digitsOnly.slice(7)
        }
        setGcashPhone(formatted)
      } else {
        setGcashPhone('')
      }
    } else {
      setGcashPhone('')
    }
    
    setErrors((prev) => ({ ...prev, gcashPhone: "" }))
  }

  const handleGcashPhoneChangeInModal = (value: string) => {
    // Remove all non-digit characters
    let digitsOnly = value.replace(/\D/g, '')
    
    // Ensure it starts with 09 and limit to 11 digits
    if (digitsOnly.length > 0) {
      // If user starts with 9, prepend 0
      if (digitsOnly.startsWith('9') && digitsOnly.length <= 10) {
        digitsOnly = '0' + digitsOnly
      }
      // If user starts with 0, ensure next digit is 9
      else if (digitsOnly.startsWith('0')) {
        if (digitsOnly.length === 1) {
          digitsOnly = '09'
        } else if (!digitsOnly.startsWith('09')) {
          digitsOnly = '09' + digitsOnly.slice(1)
        }
      }
      // If user starts with other digits, replace with 09
      else if (!digitsOnly.startsWith('09')) {
        digitsOnly = '09'
      }
      
      // Limit to 11 digits
      digitsOnly = digitsOnly.slice(0, 11)
      
      // Format with dashes: 09XXX-XXX-XXX
      if (digitsOnly.length > 0) {
        let formatted = digitsOnly
        if (digitsOnly.length > 4) {
          formatted = digitsOnly.slice(0, 4) + '-' + digitsOnly.slice(4)
        }
        if (digitsOnly.length > 7) {
          formatted = formatted.slice(0, 8) + '-' + digitsOnly.slice(7)
        }
        setGcashPhone(formatted)
      } else {
        setGcashPhone('')
      }
    } else {
      setGcashPhone('')
    }
    
    setErrors((prev) => ({ ...prev, gcashPhone: "" }))
  }

  const handleAddMenuItem = () => {
    const menuErrors: Record<string, string> = {}
    
    if (!newMenuItem.name.trim()) {
      menuErrors.name = "Item name is required"
    }
    
    if (newMenuItem.stock <= 0) {
      menuErrors.stock = "Stock must be greater than 0"
    }
    
    if (newMenuItem.price <= 0) {
      menuErrors.price = "Price must be greater than 0"
    }
    
    if (Object.keys(menuErrors).length > 0) {
      setErrors(menuErrors)
      return
    }
    
    addMenuItem({
      name: newMenuItem.name.trim(),
      category: newMenuItem.category,
      stock: newMenuItem.stock,
      price: newMenuItem.price,
      status: "in-stock"
    })
    
    // Reset form
    setNewMenuItem({
      name: "",
      category: "chicken",
      stock: 10,
      price: 0
    })
    
    setErrors({})
    setShowAddMenuModal(false)
  }

  const openDeleteMenuModal = (item: InventoryItem) => {
    setItemToDelete(item)
    setShowDeleteMenuModal(true)
  }

  const openDeleteSelectionModal = () => {
    setShowDeleteSelectionModal(true)
  }

  const handleDeleteMenuItem = () => {
    if (itemToDelete) {
      console.log('Deleting item:', itemToDelete.id, itemToDelete.name)
      const success = deleteMenuItem(itemToDelete.id)
      console.log('Delete success:', success)
      
      setShowDeleteMenuModal(false)
      setItemToDelete(null)
      
      // Force inventory reload
      setTimeout(() => {
        const inventory = getMenuItems().filter((item) => item.category !== "others" && item.stock > 0)
        setMenuItems(inventory)
      }, 100)
    }
  }

  const handleAddCategory = () => {
    if (newCategory.trim() && !customCategories.includes(newCategory.trim().toLowerCase()) && !menuCategories.includes(newCategory.trim().toLowerCase())) {
      setCustomCategories(prev => [...prev, newCategory.trim().toLowerCase()])
      setNewCategory("")
      setShowAddCategoryModal(false)
    }
  }

  const handleGcashPaymentDone = () => {
    // Auto-fill customer name with "GCash Customer"
    setCustomerName("GCash Customer")
    setShowGcashQrModal(false)
  }

  const handleDeliveryPhoneChange = (value: string) => {
    // Remove all non-digit characters
    let digitsOnly = value.replace(/\D/g, '')
    
    // Ensure it starts with 09 and limit to 11 digits
    if (digitsOnly.length > 0) {
      // If user starts with 9, prepend 0
      if (digitsOnly.startsWith('9') && digitsOnly.length <= 10) {
        digitsOnly = '0' + digitsOnly
      }
      // If user starts with 0, ensure next digit is 9
      else if (digitsOnly.startsWith('0')) {
        if (digitsOnly.length === 1) {
          digitsOnly = '09'
        } else if (!digitsOnly.startsWith('09')) {
          digitsOnly = '09' + digitsOnly.slice(1)
        }
      }
      // If user starts with other digits, replace with 09
      else if (!digitsOnly.startsWith('09')) {
        digitsOnly = '09'
      }
      
      // Limit to 11 digits
      digitsOnly = digitsOnly.slice(0, 11)
      
      // Format with dashes: 09XXX-XXX-XXX
      if (digitsOnly.length > 0) {
        let formatted = digitsOnly
        if (digitsOnly.length > 4) {
          formatted = digitsOnly.slice(0, 4) + '-' + digitsOnly.slice(4)
        }
        if (digitsOnly.length > 7) {
          formatted = formatted.slice(0, 8) + '-' + digitsOnly.slice(7)
        }
        setDeliveryPhone(formatted)
      } else {
        setDeliveryPhone('')
      }
    } else {
      setDeliveryPhone('')
    }
    
    setErrors((prev) => ({ ...prev, deliveryPhone: "" }))
  }

  // Helper function to determine meal type based on time
  const getMealTypeFromTime = (time24: string): string => {
    if (!time24) return "Other";
    
    try {
      // Handle both 24-hour format (HH:MM) and 12-hour format with AM/PM
      let hours: number;
      let minutes: number;
      
      if (time24.includes('AM') || time24.includes('PM')) {
        // Handle 12-hour format with AM/PM
        const timeParts = time24.replace(/\s/g, '').split(':');
        if (timeParts.length !== 2) return "Other";
        
        const [hourMin, minuteSec] = timeParts;
        const period = minuteSec.slice(-2);
        minutes = parseInt(minuteSec.slice(0, -2));
        hours = parseInt(hourMin);
        
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
      } else {
        // Handle 24-hour format
        const timeParts = time24.split(':');
        if (timeParts.length !== 2) return "Other";
        
        hours = parseInt(timeParts[0]);
        minutes = parseInt(timeParts[1]);
      }
      
      // Validate parsed values
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return "Other";
      }
      
      const totalMinutes = hours * 60 + minutes;
      
      if (totalMinutes >= 5 * 60 && totalMinutes < 11 * 60) {
        return "Breakfast";
      } else if (totalMinutes >= 11 * 60 && totalMinutes < 17 * 60) {
        return "Lunch";
      } else if (totalMinutes >= 17 * 60 || totalMinutes < 5 * 60) {
        return "Dinner";
      }
    } catch (error) {
      console.error("Error parsing time:", error, "Input time:", time24);
    }
    
    return "Other";
  };

  
  // Helper function to check if a meal type is in the past
  const isMealTypeInPast = (mealType: string): boolean => {
    // If no cooking date is selected or it's a future date, don't restrict meal types
    if (!cookingDate) {
      return false;
    }
    
    const selectedDate = new Date(cookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    // If the selected date is in the future, allow all meal types
    if (selectedDate > today) {
      return false;
    }
    
    // If the selected date is today, apply time restrictions
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const totalMinutes = currentHour * 60 + currentMinute;
      
      switch (mealType) {
        case "Breakfast":
          return totalMinutes >= 11 * 60; // Past 11:00 AM
        case "Lunch":
          return totalMinutes >= 17 * 60; // Past 5:00 PM
        case "Dinner":
          return totalMinutes >= 24 * 60 || totalMinutes < 5 * 60; // Past midnight or before 5:00 AM
        default:
          return false;
      }
    }
    
    // For past dates, restrict all meal types except "Other"
    return mealType !== "Other";
  };

  
  
  const confirmPlaceOrder = () => {
    const now = new Date()
    
    // Generate the order number using the same function as saveOrder
    const { saveOrder } = require("@/lib/inventory-store");
    
    // Determine the final meal type based on selection and time
    const finalMealType = selectedMealType === "Other" && cookTime 
      ? getMealTypeFromTime(cookTime)
      : selectedMealType;

    // Create a timestamp for the order based on cooking date and time
    let orderTimestamp: string;
    if (cookingDate) {
      if (cookTime) {
        // Use the selected cooking date and time
        const [hours, minutes] = cookTime.split(':').map(Number);
        const orderDate = new Date(cookingDate);
        orderDate.setHours(hours, minutes, 0, 0);
        orderTimestamp = orderDate.toISOString();
      } else {
        // Use the selected date with current time
        const orderDate = new Date(cookingDate);
        const now = new Date();
        orderDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
        orderTimestamp = orderDate.toISOString();
      }
    } else {
      // Fallback to current time if no date is selected
      orderTimestamp = now.toISOString();
    }

    // Create the order first to get the actual order number
    const orderData = {
      id: Date.now().toString(),
      orderNumber: "TEMP", // Will be updated after saveOrder
      customerName,
      items: orderItems,
      total,
      date: cookingDate,
      createdAt: orderTimestamp,
      mealType: finalMealType,  // Use the determined meal type
      originalMealType: selectedMealType,  // Keep track of the original selection
      cookTime,
      paymentStatus,
      paymentMethod: paymentStatus === "paid" ? paymentMethod : null,
      amountGiven: paymentStatus === "paid" && paymentMethod === "cash" ? amountGivenNum : null,
      change: paymentStatus === "paid" && paymentMethod === "cash" ? change : null,
      gcashPhone: paymentStatus === "paid" && paymentMethod === "gcash" ? gcashPhone : null,
      gcashReference: paymentStatus === "paid" && paymentMethod === "gcash" ? gcashReference : null,
      deliveryPhone: deliveryPhone.trim() || null,
      deliveryAddress: deliveryAddress.trim() || null,
      specialRequests: specialRequests.trim() || null,
      remarks: remarks.trim() || null,
    }

    // Save the order and get the actual order number
    const savedOrder = saveOrder({
      customerName,
      items: orderItems,
      total,
      date: cookingDate,
      createdAt: orderTimestamp,
      status: "pending",
      paymentStatus,
      paymentMethod: paymentStatus === "paid" ? paymentMethod : undefined,
      gcashPhone: paymentStatus === "paid" && paymentMethod === "gcash" ? gcashPhone : undefined,
      gcashReference: paymentStatus === "paid" && paymentMethod === "gcash" ? gcashReference : undefined,
      deliveryPhone: deliveryPhone.trim() || undefined,
      deliveryAddress: deliveryAddress.trim() || undefined,
      specialRequests: specialRequests.trim() || undefined,
      remarks: remarks.trim() || undefined,
      mealType: finalMealType,
      originalMealType: selectedMealType,
      cookTime,
    })

    // Update orderData with the actual order number from savedOrder
    orderData.orderNumber = savedOrder.orderNumber;
    setReceiptData(orderData)
    setShowConfirmation(false)
    setShowReceipt(true)

    setOrderItems([])
    setCustomerName("")
    setCookingDate("")
    setCookTime("")
    setPaymentStatus("not-paid")
    setAmountGiven("")
    setGcashPhone("")
    setGcashReference("")
    setDeliveryPhone("")
    setDeliveryAddress("")
    setSpecialRequests("")
    setRemarks("")
    setErrors({})

    setTimeout(() => {
      router.push("/orders")
    }, 3000)
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  return (
    <POSLayout>
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Order</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">
                  {cookingDate ? new Date(cookingDate).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric", 
                    year: "numeric"
                  }) : ""}
                </span>
              </div>
              {cookTime && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time:</span>
                  <span className="font-medium">{formatTimeForDisplay(cookTime)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Meal Type:</span>
                <span className="font-medium">{selectedMealType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="font-medium">{orderItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-2">Order Items:</p>
                <div className="space-y-1">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <span>{item.quantity}x {item.name}</span>
                      <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(specialRequests || remarks) && (
                <div className="border-t pt-3">
                  {specialRequests && (
                    <div className="mb-2">
                      <p className="text-sm text-blue-600 font-medium">Special Requests:</p>
                      <p className="text-xs text-muted-foreground">{specialRequests}</p>
                    </div>
                  )}
                  {remarks && (
                    <div>
                      <p className="text-sm text-orange-600 font-medium">Remarks:</p>
                      <p className="text-xs text-muted-foreground">{remarks}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-muted-foreground">Payment:</span>
                <Badge 
                  variant={paymentStatus === "paid" ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    paymentStatus === "paid" && paymentMethod === "cash" && "bg-green-600 hover:bg-green-600/90",
                    paymentStatus === "paid" && paymentMethod === "gcash" && "bg-blue-600 hover:bg-blue-600/90"
                  )}
                >
                  {paymentStatus === "paid" 
                    ? `PAID - ${paymentMethod?.toUpperCase() || 'CASH'}`
                    : 'NOT PAID'}
                </Badge>
              </div>

              <div className="flex justify-between text-lg font-bold border-t pt-3">
                <span>Total Amount:</span>
                <span className="text-primary">₱{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowConfirmation(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={confirmPlaceOrder} className="flex-1">
                Confirm Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptData && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-background rounded-lg shadow-2xl w-full max-w-md sm:max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
            <div className="bg-primary text-primary-foreground p-4 sm:p-6 text-center rounded-t-lg">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2">
                <img src="/yrc-logo.png" alt="YRC Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold">YELLOWBELL ROAST CO.</h2>
            </div>

            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="text-center pb-2 sm:pb-3 border-b">
                <p className="text-xs text-muted-foreground">Order #</p>
                <p className="font-mono font-bold text-base sm:text-lg">{receiptData.orderNumber}</p>
              </div>

              <div className="space-y-1 text-xs sm:text-sm pb-2 sm:pb-3 border-b">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium truncate ml-2">{receiptData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Date</span>
                  <span>{receiptData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Time</span>
                  <span>{receiptData.createdAt ? new Date(receiptData.createdAt).toLocaleString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  }).replace(',', ' -') : ""}</span>
                </div>
                {receiptData.cookTime && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cook Time</span>
                    <span>{formatTimeForDisplay(receiptData.cookTime)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Meal Type</span>
                  <span>{receiptData.mealType}</span>
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2 pb-2 sm:pb-3 border-b">
                {receiptData.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-xs sm:text-sm">
                    <span className="flex-1 pr-2">
                      <span className="block truncate">{item.name}</span>
                      <span className="text-muted-foreground">x{item.quantity}</span>
                    </span>
                    <span className="font-medium whitespace-nowrap">₱{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {(receiptData.specialRequests || receiptData.remarks) && (
                <div className="space-y-1 sm:space-y-2 pb-2 sm:pb-3 border-b">
                  {receiptData.specialRequests && (
                    <div className="text-xs sm:text-sm">
                      <span className="font-medium text-blue-600 block mb-1">Special Requests:</span>
                      <p className="text-muted-foreground break-words">{receiptData.specialRequests}</p>
                    </div>
                  )}
                  {receiptData.remarks && (
                    <div className="text-xs sm:text-sm">
                      <span className="font-medium text-orange-600 block mb-1">Remarks:</span>
                      <p className="text-muted-foreground break-words">{receiptData.remarks}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between text-base sm:text-lg font-bold">
                <span>TOTAL</span>
                <span className="text-primary">₱{receiptData.total.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-xs sm:text-sm pt-2 sm:pt-3 border-t">
                <span className="text-muted-foreground">Payment</span>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={receiptData.paymentStatus === "paid" ? "default" : "secondary"} 
                    className={cn(
                      "text-xs",
                      receiptData.paymentStatus === "paid" && receiptData.paymentMethod === "cash" && "bg-green-600 hover:bg-green-600/90",
                      receiptData.paymentStatus === "paid" && receiptData.paymentMethod === "gcash" && "bg-blue-600 hover:bg-blue-600/90"
                    )}
                  >
                    {receiptData.paymentStatus === "paid" 
                      ? `PAID - ${receiptData.paymentMethod === 'cash' ? 'CASH' : 'GCASH'}`
                      : 'NOT PAID'}
                  </Badge>
                </div>
              </div>

              <div className="text-center pt-3 sm:pt-4 border-t">
                <p className="text-xs sm:text-sm font-semibold">Thank you!</p>
                <p className="text-xs text-muted-foreground mt-1 sm:mt-2">Redirecting...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddMenuModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add Menu Item</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-item-name" className={cn(errors.name && "text-destructive")}>
                  Item Name *
                </Label>
                <Input
                  id="menu-item-name"
                  placeholder="Enter item name"
                  value={newMenuItem.name}
                  onChange={(e) => {
                    setNewMenuItem(prev => ({ ...prev, name: e.target.value }))
                    setErrors(prev => ({ ...prev, name: "" }))
                  }}
                  className={cn(errors.name && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu-item-category">Category</Label>
                <div className="flex gap-2">
                  <select
                    id="menu-item-category"
                    value={newMenuItem.category}
                    onChange={(e) => setNewMenuItem(prev => ({ ...prev, category: e.target.value }))}
                    className="flex-1 p-2 border rounded-md bg-background"
                  >
                    {menuCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                    {customCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    + Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu-item-stock" className={cn(errors.stock && "text-destructive")}>
                  Stock *
                </Label>
                <Input
                  id="menu-item-stock"
                  type="number"
                  placeholder="10"
                  value={newMenuItem.stock || ""}
                  onChange={(e) => {
                    setNewMenuItem(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))
                    setErrors(prev => ({ ...prev, stock: "" }))
                  }}
                  className={cn(errors.stock && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.stock && <p className="text-sm text-destructive">{errors.stock}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu-item-price" className={cn(errors.price && "text-destructive")}>
                  Price (₱) *
                </Label>
                <Input
                  id="menu-item-price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newMenuItem.price || ""}
                  onChange={(e) => {
                    setNewMenuItem(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                    setErrors(prev => ({ ...prev, price: "" }))
                  }}
                  className={cn(errors.price && "border-destructive focus-visible:ring-destructive")}
                />
                {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddMenuModal(false)
                  setNewMenuItem({ name: "", category: "chicken", stock: 0, price: 0 })
                  setErrors({})
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAddMenuItem} className="flex-1">
                Add Item
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteMenuModal && itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-red-600">Delete Menu Item</h3>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Are you sure you want to delete this menu item? This action cannot be undone.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item Name:</span>
                  <span className="font-medium">{itemToDelete.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{itemToDelete.category}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-medium">{itemToDelete.stock} units</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-bold text-red-600">₱{itemToDelete.price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteMenuModal(false)
                  setItemToDelete(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteMenuItem}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete Item
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSelectionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Select Menu Item to Delete</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    openDeleteMenuModal(item)
                    setShowDeleteSelectionModal(false)
                  }}
                  className="w-full p-3 text-left border rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.category} • Stock: {item.stock} • ₱{item.price}
                      </p>
                    </div>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </div>
                </button>
              ))}
              {filteredItems.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No menu items available</p>
              )}
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteSelectionModal(false)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Add New Category</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-category-name">Category Name</Label>
                <Input
                  id="new-category-name"
                  placeholder="Enter category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a unique category name (e.g., beverages, desserts, appetizers)
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddCategoryModal(false)
                  setNewCategory("")
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddCategory} 
                className="flex-1"
                disabled={!newCategory.trim() || customCategories.includes(newCategory.trim().toLowerCase()) || menuCategories.includes(newCategory.trim().toLowerCase())}
              >
                Add Category
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">New Order</h1>
          <p className="text-muted-foreground mt-1">Create a new order for customers</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor="customer-name" className={cn(errors.customerName && "text-destructive")}>
                      Customer Name *
                    </Label>
                    <div className="relative">
                      <Input
                        id="customer-name"
                        placeholder="Enter customer name"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value)
                          setErrors((prev) => ({ ...prev, customerName: "" }))
                          setShowCustomerSuggestions(true)
                        }}
                        onFocus={() => setShowCustomerSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                        className={cn(errors.customerName && "border-destructive focus-visible:ring-destructive")}
                      />
                      {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredCustomers.slice(0, 5).map((customer) => (
                            <button
                              key={customer.name}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setCustomerName(customer.name)
                                setShowCustomerSuggestions(false)
                                setErrors((prev) => ({ ...prev, customerName: "" }))
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>{customer.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {customer.totalOrders} orders
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.customerName && <p className="text-base text-destructive">{errors.customerName}</p>}
                  </div>

                  <div className="space-y-2 relative">
                    <Label htmlFor="cooking-date" className={cn(errors.cookingDate && "text-destructive")}>
                      Cooking Date *
                    </Label>
                    <div className="relative">
                      <Input
                        id="cooking-date"
                        placeholder="Select date"
                        value={
                          cookingDate
                            ? new Date(cookingDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : ""
                        }
                        onClick={handleDatePickerOpen}
                        readOnly
                        className={cn(
                          errors.cookingDate && "border-destructive focus-visible:ring-destructive",
                          "cursor-pointer",
                        )}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {errors.cookingDate && <p className="text-base text-destructive">{errors.cookingDate}</p>}

                    {showDatePicker && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 sm:absolute sm:inset-auto sm:mt-1 sm:bg-transparent sm:p-0">
                        <div className="bg-background border rounded-lg shadow-lg p-4 w-full max-w-md sm:w-80 sm:max-w-none sm:relative">
                          <div className="flex items-center justify-between mb-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (selectedMonth === 0) {
                                  setSelectedMonth(11)
                                  setSelectedYear(selectedYear - 1)
                                } else {
                                  setSelectedMonth(selectedMonth - 1)
                                }
                              }}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="font-semibold text-sm sm:text-base">
                              {monthNames[selectedMonth]} {selectedYear}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (selectedMonth === 11) {
                                  setSelectedMonth(0)
                                  setSelectedYear(selectedYear + 1)
                                } else {
                                  setSelectedMonth(selectedMonth + 1)
                                }
                              }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                              <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1 sm:p-2">
                                {day}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1 text-xs sm:text-sm">
                            {Array.from({ length: getFirstDayOfMonth(selectedMonth, selectedYear) }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {Array.from({ length: getDaysInMonth(selectedMonth, selectedYear) }).map((_, i) => {
                              const day = i + 1
                              const date = new Date(selectedYear, selectedMonth, day)
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const dateOnly = new Date(date)
                              dateOnly.setHours(0, 0, 0, 0)
                              const isPast = dateOnly < today
                              const isSelected = cookingDate === `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

                              return (
                                <Button
                                  key={day}
                                  variant={isSelected ? "default" : "ghost"}
                                  size="sm"
                                  onClick={() => !isPast && handleDateSelect(day)}
                                  disabled={isPast}
                                  className={cn(
                                    "h-7 w-full sm:h-9 text-xs sm:text-sm",
                                    isPast && "opacity-50 cursor-not-allowed text-muted-foreground"
                                  )}
                                >
                                  {day}
                                </Button>
                              )
                            })}
                          </div>

                          <div className="flex justify-end mt-4">
                            <Button variant="outline" size="sm" onClick={() => setShowDatePicker(false)}>
                              Close
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Meal Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {mealTypes.map((type) => {
                      const isPast = isMealTypeInPast(type);
                      const isCurrent = getCurrentMealType() === type && cookingDate === new Date().toISOString().split('T')[0];
                      const isFutureDate = cookingDate && new Date(cookingDate) > new Date(new Date().toISOString().split('T')[0]);
                      
                      return (
                        <Button
                          key={type}
                          variant={selectedMealType === type ? "default" : "outline"}
                          size="sm"
                          onClick={() => !isPast && setSelectedMealType(type)}
                          disabled={isPast}
                          className={cn(
                            selectedMealType === type && "bg-primary",
                            isPast && "opacity-50 cursor-not-allowed",
                            isCurrent && !isPast && "ring-2 ring-green-500 ring-offset-2"
                          )}
                          title={isPast ? `${type} is no longer available` : 
                                 isCurrent ? `Current meal: ${type}` : 
                                 isFutureDate ? `Available for future date` : type}
                        >
                          {type}
                          {isCurrent && !isPast && (
                            <span className="ml-1 text-xs">•</span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  {cookingDate && (
                  <p className="text-base text-muted-foreground">
                    {(() => {
                      const selectedDate = new Date(cookingDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      selectedDate.setHours(0, 0, 0, 0);
                      
                      if (selectedDate.getTime() === today.getTime()) {
                        return `Today: ${getCurrentMealType()} (${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})`;
                      } else if (selectedDate > today) {
                        return `Future date: All meal types available`;
                      } else {
                        return `Past date: Only "Other" meal type available`;
                      }
                    })()}
                  </p>
                  )}
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="cook-time" className={cn(errors.cookTime && "text-destructive")}>
                    Cook Time {selectedMealType === "Other" && "*"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="cook-time"
                      placeholder="Select time (required for Other meal type)"
                      value={formatTimeForDisplay(cookTime)}
                      onClick={() => setShowTimePicker(!showTimePicker)}
                      readOnly
                      className={cn(
                        errors.cookTime && "border-destructive focus-visible:ring-destructive",
                        "cursor-pointer",
                      )}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {errors.cookTime && <p className="text-base text-destructive">{errors.cookTime}</p>}

                    {showTimePicker && (
                      <div className="absolute z-50 mt-1">
                        {isMobile ? (
                          <MobileTimePicker
                            value={cookTime}
                            onChange={(time) => {
                              setCookTime(time)
                              setErrors((prev) => ({ ...prev, cookTime: "" }))
                            }}
                            onClose={() => setShowTimePicker(false)}
                            cookingDate={cookingDate}
                          />
                        ) : (
                          <TimePicker
                            value={cookTime}
                            onChange={(time) => {
                              setCookTime(time)
                              setErrors((prev) => ({ ...prev, cookTime: "" }))
                            }}
                            onClose={() => setShowTimePicker(false)}
                            cookingDate={cookingDate}
                          />
                        )}
                      </div>
                    )}
                  </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3">Delivery Information (Optional)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delivery-phone" className={cn(errors.deliveryPhone && "text-destructive")}>
                        Phone Number
                      </Label>
                      <Input
                        id="delivery-phone"
                        placeholder="09XX-XXX-XXXX"
                        value={deliveryPhone}
                        onChange={(e) => handleDeliveryPhoneChange(e.target.value)}
                        className={cn(errors.deliveryPhone && "border-destructive focus-visible:ring-destructive")}
                        maxLength={13}
                      />
                      {errors.deliveryPhone && <p className="text-base text-destructive">{errors.deliveryPhone}</p>}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="delivery-address">Delivery Address</Label>
                      <Textarea
                        id="delivery-address"
                        placeholder="Enter complete address..."
                        rows={2}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Menu Items</CardTitle>
                    {errors.orderItems && <p className="text-base text-destructive mt-1">{errors.orderItems}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddMenuModal(true)}
                      className="text-green-600 border-green-600 hover:bg-green-50"
                      aria-label="Add Menu"
                    >
                      <PlusIcon className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Add Menu</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openDeleteSelectionModal}
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      disabled={filteredItems.length === 0}
                      aria-label="Delete Menu"
                    >
                      <Trash2 className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Delete Menu</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer px-4 py-2 text-base",
                        selectedCategory === category && "bg-primary hover:bg-primary/90",
                      )}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                  {customCategories.map((category) => (
                    <Badge
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer px-4 py-2 text-base",
                        selectedCategory === category && "bg-primary hover:bg-primary/90",
                      )}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-[calc(100vh-400px)] min-h-[300px] max-h-[700px] overflow-y-auto pr-1 -mr-1">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-8">
                  <p className="text-base text-muted-foreground">No items available</p>
                </div>
                  ) : (
                    filteredItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addToOrder(item)}
                        disabled={item.stock === 0}
                        className={cn(
                          "p-4 bg-card border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left",
                          (() => {
                            const existing = orderItems.find((i) => i.id === item.id)
                            const quantityInOrder = existing ? existing.quantity : 0
                            const remainingStock = item.stock - quantityInOrder
                            return remainingStock === 0 && "opacity-50 cursor-not-allowed border-red-400 bg-red-100"
                          })()
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-lg">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {(() => {
                                const existing = orderItems.find((i) => i.id === item.id)
                                const quantityInOrder = existing ? existing.quantity : 0
                                const remainingStock = item.stock - quantityInOrder
                                const isOutOfStock = remainingStock === 0
                                const isLowStock = remainingStock > 0 && remainingStock <= 5
                                return (
                                  <p className={cn("text-sm flex items-center gap-1", 
                                    isOutOfStock ? "text-red-600 font-medium" : 
                                    isLowStock ? "text-orange-600 font-medium" : 
                                    "text-green-600"
                                  )}>
                                    {isOutOfStock ? <AlertTriangle className="h-4 w-4 text-red-600" /> : isLowStock ? <AlertCircle className="h-4 w-4 text-orange-400" /> : <Package className="h-4 w-4" />}
                                    Stock: {remainingStock}
                                  </p>
                                )
                              })()}
                            </div>
                          </div>
                          <p className={cn("text-xl font-bold", 
                            (() => {
                              const existing = orderItems.find((i) => i.id === item.id)
                              const quantityInOrder = existing ? existing.quantity : 0
                              const remainingStock = item.stock - quantityInOrder
                              return remainingStock === 0 && "text-red-600"
                            })()
                          )}>₱{item.price}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="special-requests">Special Requests</Label>
                  <Textarea 
                    id="special-requests" 
                    placeholder="Any special requests..." 
                    rows={3}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea 
                    id="remarks" 
                    placeholder="Additional remarks..." 
                    rows={3}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Order Summary</CardTitle>
                  {orderItems.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setOrderItems([])}>
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderItems.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-base text-muted-foreground">No items added yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-base">{item.name}</p>
                          <p className="text-sm text-muted-foreground">₱{item.price} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-7 w-7 p-0"
                          >
                            -
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-7 w-7 p-0"
                          >
                            +
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromOrder(item.id)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total</span>
                    <span className="text-primary">₱{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Payment Status</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={paymentStatus === "not-paid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentStatus("not-paid")}
                      >
                        Not Paid
                      </Button>
                      <Button
                        variant={paymentStatus === "paid" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentStatus("paid")}
                      >
                        Paid
                      </Button>
                    </div>
                  </div>

                  {paymentStatus === "paid" && (
                    <>
                      <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={paymentMethod === "cash" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPaymentMethod("cash")}
                            className={paymentMethod === "cash" ? "bg-green-400 hover:bg-green-500" : ""}
                          >
                            Cash
                          </Button>
                          <Button
                            variant={paymentMethod === "gcash" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPaymentMethod("gcash")}
                            className={paymentMethod === "gcash" ? "bg-blue-600 hover:bg-blue-700" : ""}
                          >
                            GCash
                          </Button>
                        </div>
                      </div>

                      {paymentMethod === "cash" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="amount-given" className={cn(errors.amountGiven && "text-destructive")}>
                              Amount Given *
                            </Label>
                            <Input
                              id="amount-given"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={amountGiven}
                              onChange={(e) => {
                                setAmountGiven(e.target.value)
                                setErrors((prev) => ({ ...prev, amountGiven: "" }))
                              }}
                              className={cn(errors.amountGiven && "border-destructive focus-visible:ring-destructive")}
                            />
                            {errors.amountGiven && <p className="text-base text-destructive">{errors.amountGiven}</p>}
                          </div>
                          {amountGiven && (
                            <div className="flex justify-between text-base p-3 bg-muted rounded-lg">
                              <span className="text-muted-foreground">Change</span>
                              <span className={cn("font-bold text-lg", change < 0 ? "text-destructive" : "text-green-600")}>
                                ₱{change.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {paymentMethod === "gcash" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="gcash-phone" className={cn(errors.gcashPhone && "text-destructive")}>
                              Phone Number *
                            </Label>
                            <Input
                              id="gcash-phone"
                              placeholder="09XX-XXX-XXXX"
                              value={gcashPhone}
                              onChange={(e) => handleGcashPhoneChange(e.target.value)}
                              className={cn(errors.gcashPhone && "border-destructive focus-visible:ring-destructive")}
                              maxLength={13}
                            />
                            {errors.gcashPhone && <p className="text-base text-destructive">{errors.gcashPhone}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="gcash-reference"
                              className={cn(errors.gcashReference && "text-destructive")}
                            >
                              Reference Number
                            </Label>
                            <Input
                              id="gcash-reference"
                              placeholder="Enter reference number"
                              value={gcashReference}
                              onChange={(e) => {
                                setGcashReference(e.target.value)
                                setErrors((prev) => ({ ...prev, gcashReference: "" }))
                              }}
                              className={cn(
                                errors.gcashReference && "border-destructive focus-visible:ring-destructive",
                              )}
                            />
                            {errors.gcashReference && (
                              <p className="text-base text-destructive">{errors.gcashReference}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowGcashQrModal(true)}
                            className="w-full"
                          >
                            Share QR
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Button onClick={handlePlaceOrder} className="w-full bg-green-600 hover:bg-green-700" size="lg" disabled={orderItems.length === 0}>
                  Place Order
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* GCash QR Modal */}
      {showGcashQrModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <h3 className="text-xl font-bold mb-4">GCash QR Code</h3>
            <div className="flex flex-col items-center space-y-4">
              <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                <img 
                  src="/gcash-qr.png" 
                  alt="GCash QR Code" 
                  className="w-64 h-64 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = document.createElement('div');
                    fallback.className = 'w-64 h-64 flex items-center justify-center bg-gray-100 text-gray-500 text-center p-4';
                    fallback.innerHTML = 'QR Code Image Not Found';
                    target.parentNode?.replaceChild(fallback, target);
                  }}
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">Payment Amount</p>
                <p className="text-2xl font-bold text-primary">₱{total.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Scan this QR code with your GCash app to complete the payment</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowGcashQrModal(false)} className="flex-1">
                Close
              </Button>
              <Button onClick={handleGcashPaymentDone} className="flex-1 bg-green-600 hover:bg-green-700">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </POSLayout>
  )
}
