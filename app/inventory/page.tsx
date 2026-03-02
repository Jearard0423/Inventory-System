"use client"

import type React from "react"
import { Pagination } from "@/components/pagination"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Search, Package, Plus, Pencil, Trash2, X, Check, ChevronsUpDown } from "lucide-react"
import { useState, useEffect } from "react"
import { getInventory, updateInventory, getStockStatus, type InventoryItem } from "@/lib/inventory-store"

export default function InventoryPage() {
  const [menuItems, setMenuItems] = useState<InventoryItem[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all-categories")
  const [statusFilter, setStatusFilter] = useState("all-status")
  const [showSuccessSheet, setShowSuccessSheet] = useState(false)
  const [lastAddedItem, setLastAddedItem] = useState<InventoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasReceivedFirebaseData, setHasReceivedFirebaseData] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    category: "chicken",
    stock: 0,
    price: 0,
  })

  // Linked items state
  const [linkedItems, setLinkedItems] = useState<Array<{ itemId: string; ratio: number }>>([])
  const [openCombobox, setOpenCombobox] = useState(false)
  const [selectedItemForLink, setSelectedItemForLink] = useState("")
  const [linkRatio, setLinkRatio] = useState(1)

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    let isMounted = true
    let lastLocalSave = 0 // timestamp of last local save

    // Load initial data from localStorage (fallback)
    const loadInitialData = () => {
      if (isMounted) {
        const data = getInventory()
        console.log('[inventory-page] Loading initial data:', data.length, 'items')
        setMenuItems(data)
        setIsLoading(false)
      }
    }
    
    // Firebase data handler - fires when Firebase RTDB updates
    const handleFirebaseInventoryUpdate = () => {
      if (isMounted) {
        // If a local save happened within the last 5 seconds, ignore Firebase
        // This prevents Firebase from overwriting fresh local edits
        if (Date.now() - lastLocalSave < 5000) {
          console.log('[inventory-page] Ignoring Firebase update - recent local save')
          return
        }
        console.log("Firebase inventory update received - loading fresh data")
        const freshData = getInventory()
        console.log('[inventory-page] Firebase update apply:', freshData.length, 'items')
        setMenuItems(freshData)
        setHasReceivedFirebaseData(true)
        setIsLoading(false)
      }
    }

    // Local inventory update handler
    const handleInventoryUpdate = () => {
      if (isMounted) {
        lastLocalSave = Date.now()
        const data = getInventory()
        console.log('[inventory-page] Local update apply:', data.length, 'items')
        setMenuItems(data)
      }
    }

    // Listen for Firebase updates (highest priority) - set up immediately
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener("firebase-inventory-updated", handleFirebaseInventoryUpdate)
      // Listen for local updates (lower priority)
      window.addEventListener("inventory-updated", handleInventoryUpdate)
    } else {
      console.warn('[inventory-page] window.addEventListener not available')
    }

    // Wait longer for Firebase to initialize before using localStorage fallback
    // Firebase forceRefresh is async and can take 500ms-1s on slow connections
    const initialLoadTimer = setTimeout(() => {
      loadInitialData()
    }, 1000)

    // After 4 seconds, if no Firebase data has arrived, just proceed with what we have
    const fallbackTimer = setTimeout(() => {
      if (isMounted && !hasReceivedFirebaseData) {
        console.warn("[inventory-page] Firebase data not received after 4 seconds, using current data")
        setHasReceivedFirebaseData(true)
      }
    }, 4000)
    
    return () => {
      isMounted = false
      clearTimeout(initialLoadTimer)
      clearTimeout(fallbackTimer)
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener("firebase-inventory-updated", handleFirebaseInventoryUpdate)
        window.removeEventListener("inventory-updated", handleInventoryUpdate)
      }
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Normalize category - convert "raw-stocks" to "raw-stock" for consistency
    const normalizedCategory = formData.category === "raw-stocks" ? "raw-stock" : formData.category

    // Prevent saving if stock exceeds the limit based on linked items
    if (stockExceedsLimit) {
      // build a detailed explanation so users understand where the limit comes from
      const breakdown = linkedItems
        .map(link => {
          const raw = menuItems.find(i => i.id === link.itemId)
          if (!raw) return null
          const allowed = Math.floor(raw.stock / link.ratio)
          return `${raw.name} has ${raw.stock} unit${raw.stock === 1 ? '' : 's'} available (ratio ${link.ratio}:1) → max ${allowed}`
        })
        .filter(Boolean)
        .join('; ')
      alert(
        `Cannot save! The quantity you entered (${formData.stock}) exceeds what's possible based on raw inventory.` +
        (breakdown ? `\n
Limit details: ${breakdown}` : '')
      )
      return
    }

    let updatedItems: InventoryItem[]
    let addedItem: InventoryItem | null = null

    if (editingItem) {
      const oldStock = editingItem.stock
      const newStock = formData.stock
      const stockDelta = newStock - oldStock // positive = adding stock, negative = removing

      // If this item has linked raw stocks and we're ADDING stock,
      // deduct the raw stock proportionally (making food from raw materials)
      if (stockDelta > 0 && linkedItems.length > 0) {
        const currentItems = [...menuItems]
        linkedItems.forEach(link => {
          const rawItem = currentItems.find(i => i.id === link.itemId)
          if (rawItem) {
            const rawToDeduct = stockDelta * link.ratio
            rawItem.stock = Math.max(0, rawItem.stock - rawToDeduct)
            rawItem.status = getStockStatus(rawItem.stock)
          }
        })
        // Save raw stock changes
        updateInventory(currentItems)
        setMenuItems(currentItems)
      }

      updatedItems = menuItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              name: formData.name,
              category: normalizedCategory,
              stock: formData.stock,
              price: formData.price,
              status: getStockStatus(formData.stock),
              linkedItems: linkedItems.length > 0 ? linkedItems : undefined,
            }
          : item,
      )
      addedItem = editingItem
    } else {
      const newItem: InventoryItem = {
        id: Date.now().toString(),
        name: formData.name,
        category: normalizedCategory,
        stock: formData.stock,
        status: getStockStatus(formData.stock),
        price: formData.price,
        linkedItems: linkedItems.length > 0 ? linkedItems : undefined,
      }
      updatedItems = [...menuItems, newItem]
      addedItem = newItem
    }

    updateInventory(updatedItems)
    setMenuItems(updatedItems)
    setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
    setLinkedItems([])
    setShowAddDialog(false)
    setEditingItem(null)
    
    // Show success confirmation with updated data
    if (addedItem) {
      // Update the item with the new form data before showing in success dialog
      const updatedAddedItem = {
        ...addedItem,
        name: formData.name,
        category: normalizedCategory,
        stock: formData.stock,
        price: formData.price,
        status: getStockStatus(formData.stock),
      }
      setLastAddedItem(updatedAddedItem)
      setShowSuccessSheet(true)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    // Normalize category when loading for editing (convert raw-stocks to raw-stock)
    const normalizedCategory = item.category === "raw-stocks" ? "raw-stock" : item.category
    
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: normalizedCategory,
      stock: item.stock,
      price: item.price,
    })
    setLinkedItems(item.linkedItems || [])
    setShowAddDialog(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      const updatedItems = menuItems.filter((item) => item.id !== id)
      updateInventory(updatedItems)
      setMenuItems(updatedItems)
    }
  }

  const addLinkedItem = () => {
    if (!selectedItemForLink || linkedItems.some(link => link.itemId === selectedItemForLink)) return;
    
    setLinkedItems([...linkedItems, { itemId: selectedItemForLink, ratio: linkRatio }]);
    setSelectedItemForLink("");
    setLinkRatio(1);
    setOpenCombobox(false);
  };

  const removeLinkedItem = (itemId: string) => {
    setLinkedItems(linkedItems.filter(link => link.itemId !== itemId));
  };

  // Normalize category for consistent comparison (handle raw-stock/raw-stocks variants)
  const normalizeCategory = (category: string): string => {
    if (category === "raw-stocks" || category === "raw-stock") {
      return "raw-stock"
    }
    return category
  }

  const availableItems = menuItems.filter(item => 
    item.id !== (editingItem?.id || "") && 
    !linkedItems.some(link => link.itemId === item.id)
  );

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
    const normalizedItemCategory = normalizeCategory(item.category)
    const normalizedFilter = normalizeCategory(categoryFilter)
    const matchesCategory = normalizedFilter === "all-categories" || normalizedItemCategory === normalizedFilter
    const matchesStatus = statusFilter === "all-status" || item.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, categoryFilter, statusFilter])

  const getCategoryName = (category: string) => {
    const categories: Record<string, string> = {
      chicken: "Chicken Roast",
      liempo: "Liempo",
      sisig: "Sisig",
      rice: "Rice",
      meals: "Meals",
      "raw-stock": "Raw Stocks",
      "raw-stocks": "Raw Stocks",  // Handle both singular and plural
      utensil: "Utensils",
      container: "Container",
      others: "Others",
    }
    return categories[category] || category
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      "in-stock": "bg-green-100 text-green-800",
      "low-stock": "bg-yellow-100 text-yellow-800",
      "out-of-stock": "bg-red-100 text-red-800",
    }
    const labels = {
      "in-stock": "In Stock",
      "low-stock": "Low Stock",
      "out-of-stock": "Out of Stock",
    }
    return { className: styles[status as keyof typeof styles], label: labels[status as keyof typeof labels] }
  }

  // Calculate maximum stock that can be added based on linked raw stock items
  const calculateMaxStock = (links: Array<{ itemId: string; ratio: number }>) => {
    if (links.length === 0) return Infinity;
    
    let minPossibleUnits = Infinity;
    
    for (const link of links) {
      const linkedItem = menuItems.find(item => item.id === link.itemId);
      if (linkedItem) {
        // Calculate how many units can be made with the available stock
        // If linked item has 10 stock and ratio is 5, we can make 10/5 = 2 units
        const possibleUnits = Math.floor(linkedItem.stock / link.ratio);
        minPossibleUnits = Math.min(minPossibleUnits, possibleUnits);
      }
    }
    
    return minPossibleUnits === Infinity ? Infinity : minPossibleUnits;
  }

  const maxStockAllowed = calculateMaxStock(linkedItems);
  const stockExceedsLimit = linkedItems.length > 0 && formData.stock > maxStockAllowed;

  // helper to produce a human readable list of linked raw item status
  const linkedStatusDetails = linkedItems
    .map(link => {
      const raw = menuItems.find(i => i.id === link.itemId)
      if (!raw) return null
      const possible = Math.floor(raw.stock / link.ratio)
      return `${raw.name}: ${raw.stock} available → ${possible} unit${possible === 1 ? '' : 's'}`
    })
    .filter(Boolean)
    .join(', ')

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Inventory</h1>
            <p className="text-muted-foreground mt-1">Manage your product inventory and stock levels</p>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              setEditingItem(null)
              setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
              setLinkedItems([])
              setShowAddDialog(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">All Categories</SelectItem>
                  <SelectItem value="chicken">Chicken Roast</SelectItem>
                  <SelectItem value="liempo">Liempo</SelectItem>
                  <SelectItem value="sisig">Sisig</SelectItem>
                  <SelectItem value="rice">Rice</SelectItem>
                  <SelectItem value="meals">Meals</SelectItem>
                  <SelectItem value="raw-stock">Raw Stocks</SelectItem>
                  <SelectItem value="utensil">Utensils</SelectItem>
                  <SelectItem value="container">Container</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">All Status</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Product Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Category</th>
                    <th className="text-left py-3 px-4 font-semibold">Stock Level</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Price</th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No products found</h3>
                        <p className="text-sm text-muted-foreground mb-6">No products found matching your criteria.</p>
                        <Button
                          className="bg-primary hover:bg-primary/90"
                          onClick={() => {
                            setEditingItem(null)
                            setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
                            setLinkedItems([])
                            setShowAddDialog(true)
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Product
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const statusBadge = getStatusBadge(item.status)
                      return (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{item.name}</td>
                          <td className="py-3 px-4">{getCategoryName(item.category)}</td>
                          <td className="py-3 px-4">{item.stock} units</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}
                            >
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">₱{item.price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </div>

            <div className="md:hidden space-y-4">
              {paginatedItems.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No products found</h3>
                  <p className="text-sm text-muted-foreground mb-6">No products found matching your criteria.</p>
                  <Button
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => {
                      setEditingItem(null)
                      setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
                      setLinkedItems([])
                      setShowAddDialog(true)
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Product
                  </Button>
                </div>
              ) : (
                <>
                  {paginatedItems.map((item) => {
                    const statusBadge = getStatusBadge(item.status)
                    return (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-semibold">{item.name}</h3>
                              <p className="text-sm text-muted-foreground">{getCategoryName(item.category)}</p>
                            </div>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.className}`}
                            >
                              {statusBadge.label}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-muted-foreground">Stock: {item.stock} units</span>
                            <span className="font-semibold text-lg">₱{item.price.toFixed(2)}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 bg-transparent"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-red-600 hover:text-red-700 bg-transparent"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {totalPages > 1 && (
                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{editingItem ? "Edit Product" : "Add New Product"}</h2>
                <p className="text-sm text-muted-foreground">Enter product details</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddDialog(false)
                  setEditingItem(null)
                  setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
                  setLinkedItems([])
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Product Name</label>
                  <Input
                    placeholder="Enter product name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chicken">Chicken Roast</SelectItem>
                      <SelectItem value="liempo">Liempo</SelectItem>
                      <SelectItem value="sisig">Sisig</SelectItem>
                      <SelectItem value="rice">Rice</SelectItem>
                      <SelectItem value="meals">Meals</SelectItem>
                      <SelectItem value="raw-stock">Raw Stocks</SelectItem>
                      <SelectItem value="utensil">Utensils</SelectItem>
                      <SelectItem value="container">Container</SelectItem>
                      <SelectItem value="others">Others</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Stock Level</label>
                  <Input
                    type="number"
                    placeholder="Enter stock quantity"
                    required
                    min="0"
                    max={maxStockAllowed === Infinity ? undefined : maxStockAllowed}
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number.parseInt(e.target.value) || 0 })}
                    className={stockExceedsLimit ? "border-red-500" : ""}
                  />
                  {stockExceedsLimit && (
                    <p className="text-sm text-red-600 mt-1">
                      ⚠ Cannot add {formData.stock} units. You only have enough raw materials for {maxStockAllowed} {maxStockAllowed === 1 ? "unit" : "units"}.
                      {linkedStatusDetails && <><br />Details: {linkedStatusDetails}</>}
                    </p>
                  )}
                  {linkedItems.length > 0 && !stockExceedsLimit && (
                    <p className="text-sm text-blue-600 mt-1">
                      ℹ Max stock based on linked items: {maxStockAllowed === Infinity ? "Unlimited" : maxStockAllowed} {maxStockAllowed === 1 ? "unit" : "units"}.
                      {linkedStatusDetails && <><br />({linkedStatusDetails})</>}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Price (₱)</label>
                  <Input
                    type="number"
                    placeholder="Enter price"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number.parseFloat(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Linked Items (optional)</label>
                  
                  {/* Display selected linked items with stock info */}
                  {linkedItems.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-700 font-semibold mb-2">Linked Raw Materials:</p>
                      <div className="space-y-1">
                        {linkedItems.map(link => {
                          const item = menuItems.find(mi => mi.id === link.itemId);
                          const availableUnits = item ? Math.floor(item.stock / link.ratio) : 0;
                          return item ? (
                            <div key={link.itemId} className="flex items-center justify-between text-xs">
                              <div className="flex-1">
                                {item.name}: {link.ratio} needed per unit
                              </div>
                              <div className="text-right">
                                {item.stock} available → {availableUnits} {availableUnits === 1 ? "unit" : "units"}
                              </div>
                              <X 
                                className="h-3 w-3 cursor-pointer hover:text-destructive ml-2" 
                                onClick={() => removeLinkedItem(link.itemId)}
                              />
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add new linked item */}
                  <div className="flex gap-2">
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCombobox}
                          className="flex-1 justify-between"
                        >
                          {selectedItemForLink 
                            ? menuItems.find(item => item.id === selectedItemForLink)?.name || "Select item..."
                            : "Select item to link..."
                          }
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search items..." />
                          <CommandList>
                            <CommandEmpty>No items found.</CommandEmpty>
                            <CommandGroup>
                              {availableItems.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={item.name}
                                  onSelect={() => {
                                    setSelectedItemForLink(item.id);
                                    setOpenCombobox(false);
                                  }}
                                  disabled={item.stock <= 0}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedItemForLink === item.id ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {item.name} {item.stock !== undefined && <span className="text-xs text-muted-foreground">({item.stock} in stock)</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <Input
                      type="number"
                      placeholder="Ratio"
                      value={linkRatio}
                      onChange={(e) => setLinkRatio(Number.parseFloat(e.target.value) || 1)}
                      className="w-20"
                      min="0.1"
                      step="0.1"
                    />

                    <Button 
                      type="button" 
                      onClick={addLinkedItem}
                      disabled={!selectedItemForLink}
                    >
                      Add
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">
                    When this item's stock is reduced, linked items will be reduced by the specified ratio.  
                    Stock is automatically capped by the available quantity of the linked raw materials – any limit will be shown above the input.
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => {
                      setShowAddDialog(false)
                      setEditingItem(null)
                      setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
                      setLinkedItems([])
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={stockExceedsLimit} className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                    {editingItem ? "Update" : "Add"} Product
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Sheet open={showSuccessSheet} onOpenChange={setShowSuccessSheet}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-green-600">✓ Product Added Successfully</SheetTitle>
            <p className="text-sm text-muted-foreground">Your product has been added to inventory</p>
          </SheetHeader>
          
          {lastAddedItem && (
            <div className="py-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">{lastAddedItem.name}</h3>
                    <p className="text-sm text-green-600 dark:text-green-400">₱{lastAddedItem.price.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Category:</span>
                    <span className="font-medium">{getCategoryName(lastAddedItem.category)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Stock:</span>
                    <span className="font-medium">{lastAddedItem.stock} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Status:</span>
                    <span className="font-medium capitalize">{lastAddedItem.status.replace('-', ' ')}</span>
                  </div>
                </div>
                
                {lastAddedItem.linkedItems && lastAddedItem.linkedItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                    <p className="text-sm text-green-700 dark:text-green-300 mb-2">Linked Items:</p>
                    <div className="flex flex-wrap gap-1">
                      {lastAddedItem.linkedItems.map(link => {
                        const linkedItem = menuItems.find(item => item.id === link.itemId);
                        return linkedItem ? (
                          <Badge key={link.itemId} variant="outline" className="text-xs">
                            {linkedItem.name} ({link.ratio}:1)
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  The product is now available in your inventory and can be used for orders.
                </p>
              </div>
            </div>
          )}
          
          <SheetFooter>
            <Button 
              onClick={() => setShowSuccessSheet(false)} 
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </POSLayout>
  )
}