"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { POSLayout } from "@/components/pos-layout"
import { Trash2, Plus } from "lucide-react"

type Unit = "kg" | "g" | "pcs"

type Ingredient = {
  id: string
  name: string
  purchaseUnit: Unit
  purchaseUnitAmount: number // e.g., 1 if purchase unit is 1 kg, or 1000 if using grams
  costPerPurchaseUnit: number // cost for the purchase unit (₱)
  amountUsedPerProduct: number // amount used per product
  usedUnit: Unit
}

function currency(v: number) {
  return v.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
}

export default function PricingCalculatorPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: "ing-1", name: "", purchaseUnit: "kg", purchaseUnitAmount: 1, costPerPurchaseUnit: 0, amountUsedPerProduct: 0, usedUnit: "g" },
  ])

  type Packaging = {
    id: string
    name: string
    pcs: number
    costPerPiece: number
  }

  const [packaging, setPackaging] = useState<Packaging[]>([
    { id: 'pkg-1', name: '', pcs: 0, costPerPiece: 0 }
  ])

  const [overheadPct, setOverheadPct] = useState<number>(10)
  const [profitPct, setProfitPct] = useState<number>(30)
  const [overheadAuto, setOverheadAuto] = useState<boolean>(true)
  const [profitAuto, setProfitAuto] = useState<boolean>(true)
  const [regularSellingPrice, setRegularSellingPrice] = useState<number | "">("")

  // Templates and draft persistence
  const [templateName, setTemplateName] = useState("")
  const [templates, setTemplates] = useState<Record<string, { ingredients: Ingredient[]; overhead: number; profit: number; regularSellingPrice?: number }>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const DRAFT_KEY = "pricing_draft_v1"
  const TEMPLATES_KEY = "pricing_templates_v1"

  // Load draft and templates from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.ingredients) setIngredients(parsed.ingredients)
        if (typeof parsed?.overhead === "number") setOverheadPct(parsed.overhead)
        if (typeof parsed?.profit === "number") setProfitPct(parsed.profit)
        if (parsed?.packaging) setPackaging(parsed.packaging)
        if (typeof parsed?.regularSellingPrice !== 'undefined') setRegularSellingPrice(parsed.regularSellingPrice)
      }
    } catch (e) {
      // ignore
    }

    try {
      const t = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "{}")
      setTemplates(t)
    } catch (e) {}
  }, [])

  // Persist draft on change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ingredients, packaging, overhead: overheadPct, profit: profitPct, regularSellingPrice }))
    } catch (e) {}
  }, [ingredients, packaging, overheadPct, profitPct, regularSellingPrice])

  const saveTemplate = (name: string) => {
    if (!name) return
    const t = { ...templates, [name]: { ingredients, overhead: overheadPct, profit: profitPct, regularSellingPrice } }
    setTemplates(t)
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)) } catch (e) {}
    setTemplateName("")
  }

  const loadTemplate = (name: string) => {
    const tpl = templates[name]
    if (!tpl) return
    setIngredients(tpl.ingredients)
    setOverheadPct(tpl.overhead)
    setProfitPct(tpl.profit)
    if (typeof tpl.regularSellingPrice !== 'undefined') setRegularSellingPrice(tpl.regularSellingPrice)
  }

  const deleteTemplate = (name: string) => {
    const t = { ...templates }
    delete t[name]
    setTemplates(t)
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)) } catch (e) {}
  }

  const exportCSV = () => {
    const rows = [
      ["Ingredient", "PurchaseUnit", "PurchaseUnitAmount", "CostPerPurchaseUnit", "UsedPerProduct", "UsedUnit", "CostContribution"],
      ...ingredients.map(i => [
        i.name,
        i.purchaseUnit,
        String(i.purchaseUnitAmount),
        String(i.costPerPurchaseUnit),
        String(i.amountUsedPerProduct),
        String(i.usedUnit),
        String((ingredientCostForExport(i)).toFixed(2))
      ]),
      ["", "", "", "", "Total Ingredients", String(totalIngredientCost.toFixed(2))],
      ["Packaging Item", "Pcs", "CostPerPiece", "TotalPackagingCost"],
      ...packaging.map(p => [p.name, String(p.pcs), String(p.costPerPiece), String((p.pcs * (p.costPerPiece || 0)).toFixed(2))]),
      ["", "", "Total Packaging", String(totalPackagingCost.toFixed(2))],
      ["", "", "Grand Total", String(grandTotalCost.toFixed(2))]
    ]

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pricing-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const updateIngredient = (id: string, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { id: `ing-${Date.now()}`, name: "", purchaseUnit: "kg", purchaseUnitAmount: 1, costPerPurchaseUnit: 0, amountUsedPerProduct: 0, usedUnit: "g" }])
  }

  const removeIngredient = (id: string) => {
    setIngredients((prev) => prev.filter(i => i.id !== id))
  }

  const addPackaging = () => {
    setPackaging((prev) => [...prev, { id: `pkg-${Date.now()}`, name: '', pcs: 0, costPerPiece: 0 }])
  }

  const updatePackaging = (id: string, patch: Partial<Packaging>) => {
    setPackaging((prev) => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  const removePackaging = (id: string) => {
    setPackaging((prev) => prev.filter(p => p.id !== id))
  }

  function computeIngredientCost(i: Ingredient) {
    try {
      const toGrams = (unit: Unit, amount: number) => {
        if (unit === "kg") return amount * 1000
        if (unit === "g") return amount
        return null
      }

      const purchaseInGrams = toGrams(i.purchaseUnit, i.purchaseUnitAmount)
      const usedInGrams = toGrams(i.usedUnit, i.amountUsedPerProduct)

      // both weight units
      if (purchaseInGrams != null && usedInGrams != null) {
        const factor = purchaseInGrams > 0 ? usedInGrams / purchaseInGrams : 0
        return (i.costPerPurchaseUnit || 0) * factor
      }

      // both pieces
      if (i.purchaseUnit === "pcs" && i.usedUnit === "pcs") {
        const factor = i.purchaseUnitAmount > 0 ? (i.amountUsedPerProduct / i.purchaseUnitAmount) : 0
        return (i.costPerPurchaseUnit || 0) * factor
      }

      // incompatible units (pcs vs weight)
      return 0
    } catch (e) {
      return 0
    }
  }

  function ingredientCostForExport(i: Ingredient) {
    return computeIngredientCost(i)
  }

  const ingredientCosts = useMemo(() => {
    return ingredients.map(i => {
      const cost = computeIngredientCost(i)
      return { id: i.id, name: i.name, cost }
    })
  }, [ingredients])

  const totalIngredientCost = useMemo(() => ingredientCosts.reduce((s, x) => s + x.cost, 0), [ingredientCosts])
  const packagingCosts = useMemo(() => packaging.map(p => ({ id: p.id, total: (p.pcs || 0) * (p.costPerPiece || 0) })), [packaging])
  const totalPackagingCost = useMemo(() => packagingCosts.reduce((s, x) => s + x.total, 0), [packagingCosts])
  const grandTotalCost = useMemo(() => totalIngredientCost + totalPackagingCost, [totalIngredientCost, totalPackagingCost])
  // Apply overhead to grand total (ingredients + packaging)
  const totalWithOverhead = grandTotalCost * (1 + (overheadPct || 0) / 100)
  const sellingPriceSimple = totalWithOverhead * (1 + (profitPct || 0) / 100)
  const sellingPriceByMargin = profitPct >= 100 ? Infinity : totalWithOverhead / (1 - (profitPct || 0) / 100)

  const profitPerOrder = useMemo(() => {
    if (regularSellingPrice === "") return null
    return Number(regularSellingPrice) - totalWithOverhead
  }, [regularSellingPrice, totalWithOverhead])

  // display helper: show empty input when value is 0 to allow typing/clearing
  const displayNumber = (v: number) => (v === 0 ? "" : String(v))

  // Auto-calc helpers for overhead and profit
  useEffect(() => {
    if (overheadAuto) {
      const auto = totalIngredientCost <= 0 ? 10 : Math.min(50, Math.max(5, Math.round((totalPackagingCost / Math.max(totalIngredientCost, 1)) * 100 * 0.15) + 10))
      setOverheadPct(auto)
    }
  }, [totalIngredientCost, totalPackagingCost, overheadAuto])

  useEffect(() => {
    if (profitAuto) {
      const autoProfit = Math.min(200, Math.max(10, Math.round((totalWithOverhead === 0 ? 30 : (totalWithOverhead < 50 ? 50 : 30)))))
      setProfitPct(autoProfit)
    }
  }, [totalWithOverhead, profitAuto])

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pricing Calculator</h1>
            <p className="text-sm text-muted-foreground">Build product costs from ingredient lists and calculate suggested prices.</p>
          </div>
          <div className="flex gap-2">
              <Button onClick={addIngredient} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" /> Add Ingredient
              </Button>
              <Button onClick={addPackaging} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" /> Add Packaging
              </Button>
              <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Ingredients & Packaging</h3>
              <p className="text-sm text-muted-foreground">Fill purchase amounts and amounts used per product</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Ingredients Used — enter the quantity used per product. Unit selects: kg / g / pcs. Purchase unit is the market/package unit and amount (eg. 1 kg or 1000 g).</div>
                <div className="overflow-auto border rounded">
                  <table className="w-full table-fixed border-collapse">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-left">Ingredient</th>
                        <th className="px-3 py-2 text-left">Quantity (used)</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-left">Purchase Unit Amount</th>
                        <th className="px-3 py-2 text-left">Purchase Unit</th>
                        <th className="px-3 py-2 text-left">Cost per Purchase Unit (₱)</th>
                        <th className="px-3 py-2 text-left">Cost Contribution</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ing) => (
                        <tr key={ing.id} className="border-t">
                          <td className="px-3 py-2"><Input value={ing.name} onChange={(e) => updateIngredient(ing.id, { name: e.target.value })} placeholder="e.g., Chicken" /></td>
                          <td className="px-3 py-2 w-24"><Input type="number" value={displayNumber(ing.amountUsedPerProduct) as any} onChange={(e) => updateIngredient(ing.id, { amountUsedPerProduct: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0 })} placeholder="e.g., 250" /></td>
                          <td className="px-3 py-2 w-28">
                            <select value={ing.usedUnit} onChange={(e) => updateIngredient(ing.id, { usedUnit: e.target.value as Unit })} className="w-full p-2 border rounded">
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="pcs">pcs</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 w-32"><Input type="number" value={displayNumber(ing.purchaseUnitAmount) as any} onChange={(e) => updateIngredient(ing.id, { purchaseUnitAmount: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0 })} placeholder="e.g., 1 or 1000" /></td>
                          <td className="px-3 py-2 w-28">
                            <select value={ing.purchaseUnit} onChange={(e) => updateIngredient(ing.id, { purchaseUnit: e.target.value as Unit })} className="w-full p-2 border rounded">
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="pcs">pcs</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 w-40"><Input type="number" value={displayNumber(ing.costPerPurchaseUnit) as any} onChange={(e) => updateIngredient(ing.id, { costPerPurchaseUnit: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0 })} placeholder="₱ 0.00" /></td>
                          <td className="px-3 py-2 w-36 font-medium">{currency(ingredientCosts.find(ic => ic.id === ing.id)?.cost || 0)}</td>
                          <td className="px-3 py-2 w-12"><button className="p-2 text-red-600" onClick={() => removeIngredient(ing.id)} aria-label="Remove"><Trash2 /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="font-medium">Packaging Used</h4>
                <div className="text-sm text-muted-foreground mb-2">Enter packaging items used per product. 'Pcs' is how many pieces are included/used.</div>
                <div className="overflow-auto border rounded">
                  <table className="w-full table-fixed border-collapse">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-left">Pcs</th>
                        <th className="px-3 py-2 text-left">Cost per Piece (₱)</th>
                        <th className="px-3 py-2 text-left">Total</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {packaging.map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-2"><Input value={p.name} onChange={(e) => updatePackaging(p.id, { name: e.target.value })} placeholder="e.g., Container" /></td>
                          <td className="px-3 py-2 w-24"><Input type="number" value={displayNumber(p.pcs) as any} onChange={(e) => updatePackaging(p.id, { pcs: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0 })} placeholder="1" /></td>
                          <td className="px-3 py-2 w-36"><Input type="number" value={displayNumber(p.costPerPiece) as any} onChange={(e) => updatePackaging(p.id, { costPerPiece: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0 })} placeholder="₱ 0.00" /></td>
                          <td className="px-3 py-2 w-36 font-medium">{currency((p.pcs || 0) * (p.costPerPiece || 0))}</td>
                          <td className="px-3 py-2"><button className="p-2 text-red-600" onClick={() => removePackaging(p.id)}><Trash2 /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Operating overhead (%)</label>
                  <div className="flex gap-2 items-center">
                    <Input type="number" value={displayNumber(overheadPct) as any} onChange={(e) => { setOverheadAuto(false); setOverheadPct(e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0) }} />
                    <label className="text-sm"><input type="checkbox" checked={overheadAuto} onChange={(e) => setOverheadAuto(e.target.checked)} /> Auto</label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Desired profit (%)</label>
                  <div className="flex gap-2 items-center">
                    <Input type="number" value={displayNumber(profitPct) as any} onChange={(e) => { setProfitAuto(false); setProfitPct(e.target.value === "" ? 0 : Number.parseFloat(e.target.value) || 0) }} />
                    <label className="text-sm"><input type="checkbox" checked={profitAuto} onChange={(e) => setProfitAuto(e.target.checked)} /> Auto</label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Ingredients total</label>
                  <div className="font-semibold">{currency(totalIngredientCost)}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total packaging cost</p>
                    <div className="text-lg font-semibold">{currency(totalPackagingCost)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Grand total cost</p>
                    <div className="text-lg font-semibold">{currency(grandTotalCost)}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Regular selling price (₱)</label>
                    <Input type="number" value={regularSellingPrice as any} onChange={(e) => setRegularSellingPrice(e.target.value === "" ? "" : Number.parseFloat(e.target.value) || 0)} />
                    <div className="text-sm mt-2">Profit per order: <strong>{profitPerOrder == null ? '—' : currency(profitPerOrder)}</strong></div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total with overhead (ingredients only)</p>
                    <div className="text-lg font-semibold">{currency(totalWithOverhead)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Suggested price (simple markup)</p>
                    <div className="text-lg font-semibold">{isFinite(sellingPriceSimple) ? currency(sellingPriceSimple) : '—'}</div>
                    <p className="text-xs text-muted-foreground mt-1">Price = cost × (1 + overhead) × (1 + profit)</p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Suggested price (target margin)</p>
                  <div className="text-lg font-semibold">{isFinite(sellingPriceByMargin) ? currency(sellingPriceByMargin) : '—'}</div>
                  <p className="text-xs text-muted-foreground mt-1">Price = cost_with_overhead ÷ (1 - desired_margin)</p>
                </div>
              </div>

              {/* Templates controls moved out of per-row rendering */}
              <div className="flex items-center gap-2 pt-4">
                <Input placeholder="Template name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} className="w-64" />
                <Button onClick={() => saveTemplate(templateName)} disabled={!templateName} size="sm">Save Template</Button>
                <div className="ml-auto flex items-center gap-2">
                  <select className="text-sm p-1" value={selectedTemplate || ""} onChange={(e) => setSelectedTemplate(e.target.value)}>
                    <option value="">Select template...</option>
                    {Object.keys(templates).map(tn => <option key={tn} value={tn}>{tn}</option>)}
                  </select>
                  <Button size="sm" onClick={() => selectedTemplate && loadTemplate(selectedTemplate)} disabled={!selectedTemplate}>Load</Button>
                  <Button size="sm" variant="destructive" onClick={() => { if (selectedTemplate) { deleteTemplate(selectedTemplate); setSelectedTemplate("") } }} disabled={!selectedTemplate}>Delete</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  )
}
