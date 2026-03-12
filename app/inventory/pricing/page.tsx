"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { POSLayout } from "@/components/pos-layout"
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react"

type Unit = "kg" | "g" | "pcs"
type Ingredient = {
  id: string; name: string; purchaseUnit: Unit; purchaseUnitAmount: number
  costPerPurchaseUnit: number; amountUsedPerProduct: number; usedUnit: Unit
}
type Packaging = { id: string; name: string; pcs: number; costPerPiece: number }

function currency(v: number) {
  return v.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
}

const DRAFT_KEY = "pricing_draft_v1"
const TEMPLATES_KEY = "pricing_templates_v1"

export default function PricingCalculatorPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: "ing-1", name: "", purchaseUnit: "kg", purchaseUnitAmount: 1, costPerPurchaseUnit: 0, amountUsedPerProduct: 0, usedUnit: "g" },
  ])
  const [packaging, setPackaging] = useState<Packaging[]>([{ id: "pkg-1", name: "", pcs: 0, costPerPiece: 0 }])
  const [overheadPct, setOverheadPct] = useState<number>(10)
  const [profitPct, setProfitPct] = useState<number>(30)
  const [overheadAuto, setOverheadAuto] = useState<boolean>(true)
  const [profitAuto, setProfitAuto] = useState<boolean>(true)
  const [regularSellingPrice, setRegularSellingPrice] = useState<number | "">("")
  const [templateName, setTemplateName] = useState("")
  const [templates, setTemplates] = useState<Record<string, any>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [showIngredients, setShowIngredients] = useState(true)
  const [showPackaging, setShowPackaging] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p?.ingredients) setIngredients(p.ingredients)
        if (typeof p?.overhead === "number") setOverheadPct(p.overhead)
        if (typeof p?.profit === "number") setProfitPct(p.profit)
        if (p?.packaging) setPackaging(p.packaging)
        if (typeof p?.regularSellingPrice !== "undefined") setRegularSellingPrice(p.regularSellingPrice)
      }
    } catch {}
    try { setTemplates(JSON.parse(localStorage.getItem(TEMPLATES_KEY) || "{}")) } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ingredients, packaging, overhead: overheadPct, profit: profitPct, regularSellingPrice })) } catch {}
  }, [ingredients, packaging, overheadPct, profitPct, regularSellingPrice])

  const updateIngredient = (id: string, patch: Partial<Ingredient>) =>
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  const removeIngredient = (id: string) => setIngredients(prev => prev.filter(i => i.id !== id))
  const addIngredient = () => setIngredients(prev => [...prev, { id: `ing-${Date.now()}`, name: "", purchaseUnit: "kg", purchaseUnitAmount: 1, costPerPurchaseUnit: 0, amountUsedPerProduct: 0, usedUnit: "g" }])
  const updatePackaging = (id: string, patch: Partial<Packaging>) => setPackaging(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  const removePackaging = (id: string) => setPackaging(prev => prev.filter(p => p.id !== id))
  const addPackaging = () => setPackaging(prev => [...prev, { id: `pkg-${Date.now()}`, name: "", pcs: 0, costPerPiece: 0 }])

  function computeIngredientCost(i: Ingredient) {
    try {
      const toGrams = (u: Unit, a: number) => u === "kg" ? a * 1000 : u === "g" ? a : null
      const pg = toGrams(i.purchaseUnit, i.purchaseUnitAmount)
      const ug = toGrams(i.usedUnit, i.amountUsedPerProduct)
      if (pg != null && ug != null) return (i.costPerPurchaseUnit || 0) * (pg > 0 ? ug / pg : 0)
      if (i.purchaseUnit === "pcs" && i.usedUnit === "pcs")
        return (i.costPerPurchaseUnit || 0) * (i.purchaseUnitAmount > 0 ? i.amountUsedPerProduct / i.purchaseUnitAmount : 0)
      return 0
    } catch { return 0 }
  }

  const ingredientCosts = useMemo(() => ingredients.map(i => ({ id: i.id, cost: computeIngredientCost(i) })), [ingredients])
  const totalIngredientCost = useMemo(() => ingredientCosts.reduce((s, x) => s + x.cost, 0), [ingredientCosts])
  const totalPackagingCost = useMemo(() => packaging.reduce((s, p) => s + (p.pcs || 0) * (p.costPerPiece || 0), 0), [packaging])
  const grandTotalCost = totalIngredientCost + totalPackagingCost
  const totalWithOverhead = grandTotalCost * (1 + (overheadPct || 0) / 100)
  const sellingPriceSimple = totalWithOverhead * (1 + (profitPct || 0) / 100)
  const sellingPriceByMargin = profitPct >= 100 ? Infinity : totalWithOverhead / (1 - (profitPct || 0) / 100)
  const profitPerOrder = regularSellingPrice !== "" ? Number(regularSellingPrice) - totalWithOverhead : null

  const displayNumber = (v: number) => v === 0 ? "" : String(v)

  useEffect(() => {
    if (overheadAuto) {
      const auto = totalIngredientCost <= 0 ? 10 : Math.min(50, Math.max(5, Math.round((totalPackagingCost / Math.max(totalIngredientCost, 1)) * 100 * 0.15) + 10))
      setOverheadPct(auto)
    }
  }, [totalIngredientCost, totalPackagingCost, overheadAuto])

  useEffect(() => {
    if (profitAuto) setProfitPct(Math.min(200, Math.max(10, Math.round(totalWithOverhead === 0 ? 30 : totalWithOverhead < 50 ? 50 : 30))))
  }, [totalWithOverhead, profitAuto])

  const saveTemplate = (name: string) => {
    if (!name) return
    const t = { ...templates, [name]: { ingredients, packaging, overhead: overheadPct, profit: profitPct, regularSellingPrice } }
    setTemplates(t)
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)) } catch {}
    setTemplateName("")
  }

  const loadTemplate = (name: string) => {
    const tpl = templates[name]
    if (!tpl) return
    setSelectedTemplate(name)
    if (tpl.ingredients) setIngredients(tpl.ingredients)
    if (tpl.packaging) setPackaging(tpl.packaging)
    if (typeof tpl.overhead === "number") { setOverheadPct(tpl.overhead); setOverheadAuto(false) }
    if (typeof tpl.profit === "number") { setProfitPct(tpl.profit); setProfitAuto(false) }
    if (typeof tpl.regularSellingPrice !== "undefined") setRegularSellingPrice(tpl.regularSellingPrice)
  }

  const deleteTemplate = (name: string) => {
    const t = { ...templates }
    delete t[name]
    setTemplates(t)
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)) } catch {}
  }

  const exportCSV = () => {
    const rows = [
      ["Type", "Name", "Detail", "Cost (PHP)"],
      ...ingredients.map(i => ["Ingredient", i.name, `${i.amountUsedPerProduct}${i.usedUnit} of ${i.purchaseUnitAmount}${i.purchaseUnit} @ ₱${i.costPerPurchaseUnit}`, computeIngredientCost(i).toFixed(2)]),
      ...packaging.map(p => ["Packaging", p.name, `${p.pcs} pcs @ ₱${p.costPerPiece}`, ((p.pcs || 0) * (p.costPerPiece || 0)).toFixed(2)]),
      ["", "Grand Total Cost", "", grandTotalCost.toFixed(2)],
      ["", "Suggested Price (markup)", "", isFinite(sellingPriceSimple) ? sellingPriceSimple.toFixed(2) : "N/A"],
      ["", "Suggested Price (margin)", "", isFinite(sellingPriceByMargin) ? sellingPriceByMargin.toFixed(2) : "N/A"],
    ]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "pricing.csv"; a.click()
  }

  return (
    <POSLayout>
      <div className="space-y-4 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Pricing Calculator</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Build costs from ingredients and calculate suggested prices.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={addIngredient} size="sm" className="bg-primary hover:bg-primary/90 text-xs sm:text-sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Ingredient
            </Button>
            <Button onClick={addPackaging} size="sm" className="bg-primary hover:bg-primary/90 text-xs sm:text-sm">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Packaging
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs sm:text-sm">Export CSV</Button>
          </div>
        </div>

        {/* Templates — pinned at top so they're always accessible */}
        <Card>
          <CardContent className="px-3 sm:px-4 py-3">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Load existing template */}
              {Object.keys(templates).length > 0 && (
                <div className="flex gap-2 flex-1">
                  <Select value={selectedTemplate} onValueChange={v => { if (v) loadTemplate(v) }}>
                    <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue placeholder="Load template…" /></SelectTrigger>
                    <SelectContent className="max-h-48 overflow-y-auto">
                      {Object.keys(templates).map(tn => <SelectItem key={tn} value={tn}>{tn}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="destructive" className="text-xs shrink-0 h-9"
                    onClick={() => { if (selectedTemplate) { deleteTemplate(selectedTemplate); setSelectedTemplate("") } }}
                    disabled={!selectedTemplate}>Delete</Button>
                </div>
              )}
              {/* Save / New */}
              <div className="flex gap-2">
                <Input placeholder="Template name…" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  className="h-9 text-sm w-36 sm:w-44" />
                <Button onClick={() => saveTemplate(templateName)} disabled={!templateName} size="sm" className="text-xs shrink-0 h-9">Save</Button>
                <Button variant="outline" size="sm" className="text-xs shrink-0 h-9" onClick={() => {
                  setIngredients([{ id: `ing-${Date.now()}`, name: "", purchaseUnit: "kg", purchaseUnitAmount: 1, costPerPurchaseUnit: 0, amountUsedPerProduct: 0, usedUnit: "g" }])
                  setPackaging([{ id: `pkg-${Date.now()}`, name: "", pcs: 0, costPerPiece: 0 }])
                  setTemplateName(""); setSelectedTemplate(""); setRegularSellingPrice("")
                }}>New</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button onClick={() => setShowIngredients(v => !v)} className="flex items-center justify-between w-full text-left">
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Ingredients Used</h3>
                <p className="text-xs text-muted-foreground">Qty used per product, purchase unit &amp; cost</p>
              </div>
              {showIngredients ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {showIngredients && (
            <CardContent className="px-3 sm:px-4 pb-4 space-y-3">
              {ingredients.map((ing) => (
                <div key={ing.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex gap-2">
                    <Input
                      value={ing.name}
                      onChange={e => updateIngredient(ing.id, { name: e.target.value })}
                      placeholder="Ingredient name (e.g. Chicken)"
                      className="flex-1 text-sm h-9"
                    />
                    <button onClick={() => removeIngredient(ing.id)} className="p-2 text-red-500 hover:text-red-700 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Qty Used</label>
                      <Input type="number" value={displayNumber(ing.amountUsedPerProduct) as any}
                        onChange={e => updateIngredient(ing.id, { amountUsedPerProduct: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 250" className="h-9 text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Used Unit</label>
                      <select value={ing.usedUnit} onChange={e => updateIngredient(ing.id, { usedUnit: e.target.value as Unit })}
                        className="w-full h-9 mt-0.5 px-2 border rounded-md text-sm bg-background">
                        <option value="g">g</option><option value="kg">kg</option><option value="pcs">pcs</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Purchase Amount</label>
                      <Input type="number" value={displayNumber(ing.purchaseUnitAmount) as any}
                        onChange={e => updateIngredient(ing.id, { purchaseUnitAmount: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                        placeholder="e.g. 1" className="h-9 text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Purchase Unit</label>
                      <select value={ing.purchaseUnit} onChange={e => updateIngredient(ing.id, { purchaseUnit: e.target.value as Unit })}
                        className="w-full h-9 mt-0.5 px-2 border rounded-md text-sm bg-background">
                        <option value="kg">kg</option><option value="g">g</option><option value="pcs">pcs</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Cost / Purchase (₱)</label>
                      <Input type="number" value={displayNumber(ing.costPerPurchaseUnit) as any}
                        onChange={e => updateIngredient(ing.id, { costPerPurchaseUnit: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                        placeholder="₱ 0.00" className="h-9 text-sm mt-0.5" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="text-xs text-muted-foreground">Cost</label>
                      <div className="h-9 mt-0.5 flex items-center font-semibold text-sm text-primary">
                        {currency(ingredientCosts.find(ic => ic.id === ing.id)?.cost || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={addIngredient} variant="outline" size="sm" className="w-full text-xs border-dashed">
                <Plus className="h-3 w-3 mr-1" /> Add Ingredient
              </Button>
              <div className="flex justify-between items-center pt-1 text-sm font-medium border-t">
                <span className="text-muted-foreground">Ingredients Total</span>
                <span className="text-primary">{currency(totalIngredientCost)}</span>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Packaging */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <button onClick={() => setShowPackaging(v => !v)} className="flex items-center justify-between w-full text-left">
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Packaging Used</h3>
                <p className="text-xs text-muted-foreground">Pcs = how many pieces included/used per product</p>
              </div>
              {showPackaging ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {showPackaging && (
            <CardContent className="px-3 sm:px-4 pb-4 space-y-3">
              {packaging.map(p => (
                <div key={p.id} className="border rounded-lg p-3 space-y-2 bg-muted/20">
                  <div className="flex gap-2">
                    <Input value={p.name} onChange={e => updatePackaging(p.id, { name: e.target.value })}
                      placeholder="e.g. Container" className="flex-1 text-sm h-9" />
                    <button onClick={() => removePackaging(p.id)} className="p-2 text-red-500 hover:text-red-700 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Pcs</label>
                      <Input type="number" value={displayNumber(p.pcs) as any}
                        onChange={e => updatePackaging(p.id, { pcs: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                        placeholder="1" className="h-9 text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Cost/Piece (₱)</label>
                      <Input type="number" value={displayNumber(p.costPerPiece) as any}
                        onChange={e => updatePackaging(p.id, { costPerPiece: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                        placeholder="₱ 0.00" className="h-9 text-sm mt-0.5" />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="text-xs text-muted-foreground">Total</label>
                      <div className="h-9 mt-0.5 flex items-center font-semibold text-sm text-primary">
                        {currency((p.pcs || 0) * (p.costPerPiece || 0))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={addPackaging} variant="outline" size="sm" className="w-full text-xs border-dashed">
                <Plus className="h-3 w-3 mr-1" /> Add Packaging
              </Button>
              <div className="flex justify-between items-center pt-1 text-sm font-medium border-t">
                <span className="text-muted-foreground">Packaging Total</span>
                <span className="text-primary">{currency(totalPackagingCost)}</span>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Overhead, Profit & Results */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <h3 className="font-semibold text-sm sm:text-base">Pricing Results</h3>
          </CardHeader>
          <CardContent className="px-3 sm:px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Operating overhead (%)</label>
                <div className="flex gap-2 items-center mt-0.5">
                  <Input type="number" value={displayNumber(overheadPct) as any}
                    onChange={e => { setOverheadAuto(false); setOverheadPct(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0) }}
                    className="h-9 text-sm" />
                </div>
                <label className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <input type="checkbox" checked={overheadAuto} onChange={e => setOverheadAuto(e.target.checked)} className="h-3 w-3" /> Auto
                </label>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Desired profit (%)</label>
                <div className="flex gap-2 items-center mt-0.5">
                  <Input type="number" value={displayNumber(profitPct) as any}
                    onChange={e => { setProfitAuto(false); setProfitPct(e.target.value === "" ? 0 : parseFloat(e.target.value) || 0) }}
                    className="h-9 text-sm" />
                </div>
                <label className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <input type="checkbox" checked={profitAuto} onChange={e => setProfitAuto(e.target.checked)} className="h-3 w-3" /> Auto
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Grand Total Cost</p>
                <p className="text-lg font-bold">{currency(grandTotalCost)}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total with Overhead</p>
                <p className="text-lg font-bold">{currency(totalWithOverhead)}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Suggested Price (markup)</p>
                <p className="text-lg font-bold text-primary">{isFinite(sellingPriceSimple) ? currency(sellingPriceSimple) : "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">cost × (1+overhead) × (1+profit)</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Suggested Price (margin)</p>
                <p className="text-lg font-bold text-primary">{isFinite(sellingPriceByMargin) ? currency(sellingPriceByMargin) : "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">cost ÷ (1−margin)</p>
              </div>
            </div>

            <div className="border-t pt-3">
              <label className="text-xs text-muted-foreground">Your selling price (₱) — to check profit</label>
              <Input type="number" value={regularSellingPrice as any}
                onChange={e => setRegularSellingPrice(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                placeholder="e.g. 280" className="h-9 text-sm mt-1" />
              {profitPerOrder != null && (
                <div className={`mt-2 text-sm font-semibold ${profitPerOrder >= 0 ? "text-green-600" : "text-red-600"}`}>
                  Profit per order: {currency(profitPerOrder)} {profitPerOrder < 0 ? "⚠️ Selling at a loss!" : "✓"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </POSLayout>
  )
}