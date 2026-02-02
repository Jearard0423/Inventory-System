"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, ShoppingBag, TrendingUp, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Pagination } from "@/components/pagination"
import { useState, useEffect } from "react"
import { getCustomerAnalytics, type CustomerData } from "@/lib/customers"

export default function LoyalCustomersPage() {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  useEffect(() => {
    const loadData = () => {
      setCustomers(getCustomerAnalytics())
    }

    loadData()
    window.addEventListener("orders-updated", loadData)
    window.addEventListener("storage", loadData)

    const interval = setInterval(loadData, 2000)

    return () => {
      window.removeEventListener("orders-updated", loadData)
      window.removeEventListener("storage", loadData)
      clearInterval(interval)
    }
  }, [])

  const totalPages = Math.ceil(customers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCustomers = customers.slice(startIndex, endIndex)

  return (
    <POSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-balance">Loyal Customers</h1>
          <p className="text-muted-foreground mt-1">View and manage your most valuable customers</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-3xl font-bold text-primary">{customers.length}</p>
                </div>
                <Users className="h-10 w-10 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold text-accent">
                    ₱{customers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-3xl font-bold text-secondary">
                    {customers.reduce((sum, c) => sum + c.totalOrders, 0)}
                  </p>
                </div>
                <ShoppingBag className="h-10 w-10 text-secondary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer List */}
        {customers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
                <p className="text-sm text-muted-foreground">Customers who place orders will appear here</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {paginatedCustomers.map((customer, idx) => (
                <Card key={idx} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{customer.name}</CardTitle>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            Member since {customer.memberSince}
                          </p>
                        </div>
                      </div>
                      {customer.totalOrders >= 5 && (
                        <Badge variant="secondary" className="bg-accent/10 text-accent">
                          VIP
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-1 gap-3 p-3 bg-muted rounded-lg">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Orders</p>
                        <p className="text-xl font-bold">{customer.totalOrders}</p>
                      </div>
                    </div>

                    {/* Favorite Items */}
                    <div>
                      <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-accent" />
                        Usually Orders:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {customer.favoriteItems.length > 0 ? (
                          customer.favoriteItems.map((item, i) => (
                            <Badge key={i} variant="outline" className="bg-background">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No favorite items yet</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            )}
          </>
        )}
      </div>
    </POSLayout>
  )
}
