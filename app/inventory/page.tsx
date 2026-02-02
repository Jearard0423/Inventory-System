"use client"

import type React from "react"
import { Pagination } from "@/components/pagination"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Package, Plus, Pencil, Trash2, X } from "lucide-react"
import { useState, useEffect } from "react"
import { getInventory, updateInventory, getStockStatus, type InventoryItem } from "@/lib/inventory-store"

export default function InventoryPage() {
  const [menuItems, setMenuItems] = useState<InventoryItem[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all-categories")
  const [statusFilter, setStatusFilter] = useState("all-status")

  const [formData, setFormData] = useState({
    name: "",
    category: "chicken",
    stock: 0,
    price: 0,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setMenuItems(getInventory())

    const handleInventoryUpdate = () => {
      setMenuItems(getInventory())
    }

    window.addEventListener("inventory-updated", handleInventoryUpdate)
    return () => window.removeEventListener("inventory-updated", handleInventoryUpdate)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let updatedItems: InventoryItem[]

    if (editingItem) {
      updatedItems = menuItems.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              name: formData.name,
              category: formData.category,
              stock: formData.stock,
              price: formData.price,
              status: getStockStatus(formData.stock),
            }
          : item,
      )
    } else {
      const newItem: InventoryItem = {
        id: Date.now().toString(),
        name: formData.name,
        category: formData.category,
        stock: formData.stock,
        status: getStockStatus(formData.stock),
        price: formData.price,
      }
      updatedItems = [...menuItems, newItem]
    }

    updateInventory(updatedItems)
    setMenuItems(updatedItems)
    setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
    setShowAddDialog(false)
    setEditingItem(null)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      const updatedItems = menuItems.filter((item) => item.id !== id)
      updateInventory(updatedItems)
      setMenuItems(updatedItems)
    }
  }

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      stock: item.stock,
      price: item.price,
    })
    setShowAddDialog(true)
  }

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all-categories" || item.category === categoryFilter
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
      utensils: "Utensils",
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
                  <SelectItem value="utensils">Utensils</SelectItem>
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
          <Card className="w-full max-w-md">
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
                      <SelectItem value="utensils">Utensils</SelectItem>
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
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number.parseInt(e.target.value) || 0 })}
                  />
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
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-transparent"
                    onClick={() => {
                      setShowAddDialog(false)
                      setEditingItem(null)
                      setFormData({ name: "", category: "chicken", stock: 0, price: 0 })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                    {editingItem ? "Update" : "Add"} Product
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </POSLayout>
  )
}
