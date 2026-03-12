"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Bot, Send, User, Loader2, Sparkles, TrendingUp, Package, ShoppingCart, AlertTriangle, RefreshCw, ChefHat } from "lucide-react"
import { getInventoryItems, getLowStockItems, getCustomerOrders } from "@/lib/inventory-store"
import { cn } from "@/lib/utils"

interface Message { role: "user" | "assistant"; content: string }

const DONE = new Set(["delivered","served","cancelled","canceled","complete","completed"])
const readActive = () => { try { return getCustomerOrders().filter(o => !DONE.has((o.status||"").toLowerCase())) } catch { return [] } }

function buildContext() {
  try {
    const inv = getInventoryItems(), orders = readActive(), low = getLowStockItems()
    const now = new Date(), ph = new Date(now.getTime()+now.getTimezoneOffset()*60000+8*3600000)
    const dl = ph.toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Manila"})
    const tl = ph.toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Manila"})
    const food=inv.filter(i=>!i.isUtensil&&!i.isContainer&&i.category!=="raw-stock")
    const raw=inv.filter(i=>i.category==="raw-stock"), ut=inv.filter(i=>i.isUtensil), ct=inv.filter(i=>i.isContainer)
    const paid=orders.filter(o=>o.paymentStatus==="paid"), unpaid=orders.filter(o=>o.paymentStatus!=="paid")
    const rev=paid.reduce((s,o)=>s+(o.total||0),0), pend=unpaid.reduce((s,o)=>s+(o.total||0),0)
    const freq:Record<string,number>={};orders.forEach(o=>(o.items||o.orderedItems||[]).forEach((it:any)=>{freq[it.name]=(freq[it.name]||0)+(it.quantity||1)}))
    const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,q])=>`${n} (${q})`)
    const mb:Record<string,number>={};orders.forEach(o=>{const mt=(o.mealType||o.originalMealType||"other").toLowerCase();mb[mt]=(mb[mt]||0)+1})
    const today=ph.toDateString();const tod=orders.filter(o=>new Date(o.date||o.createdAt||"").toDateString()===today)
    return `Date/Time PH: ${dl}, ${tl}\nFood: ${food.map(i=>`${i.name}:${i.stock}@₱${i.price}[${i.status}]`).join(", ")}\nRaw: ${raw.map(i=>`${i.name}:${i.stock}`).join(", ")}\nLow stock: ${low.map(i=>`${i.name}(${i.stock})`).join(", ")||"none"}\nOrders: ${orders.length} active, today:${tod.length}, paid:${paid.length}, unpaid:${unpaid.length}\nRevenue: collected ₱${rev.toLocaleString()}, pending ₱${pend.toLocaleString()}\nMeal types: ${Object.entries(mb).map(([m,c])=>`${m}:${c}`).join(", ")}\nTop items: ${top.join(", ")}\nLatest orders: ${orders.slice(0,10).map(o=>`${o.customerName}|${o.orderNumber||o.id}|₱${o.total||0}`).join("; ")||"none"}`
  } catch(e) { return `Error: ${e}` }
}

const SUGGESTED = [
  { label: "📦 Low stock?",        text: "Which items are running low or out of stock? Give me a restock plan." },
  { label: "📈 Top sellers",       text: "What are our top selling items? Any slow-moving items I should know about?" },
  { label: "💰 Revenue summary",   text: "Give me a revenue summary — collected, pending, and breakdown by payment method." },
  { label: "🔮 Demand prediction", text: "Based on our order history, predict demand for the next 3 days." },
  { label: "📋 Pending orders",    text: "How many orders are currently pending and what's the total value outstanding?" },
  { label: "⚠️ Urgent issues",     text: "Are there any urgent issues I should address right now — stock, orders, or payments?" },
]

function followUps(reply: string) {
  const r = reply.toLowerCase(), all: {label:string;text:string}[] = []
  if(r.includes("stock")||r.includes("inventory")) all.push({label:"📈 Top sellers",text:"Which items sell the most?"})
  if(r.includes("revenue")||r.includes("₱")) all.push({label:"💸 Unpaid list",text:"List all unpaid orders with totals."})
  if(r.includes("order")||r.includes("pending")) all.push({label:"⏱ Overdue?",text:"Are any orders overdue or approaching delivery time?"})
  if(r.includes("meal")||r.includes("breakfast")||r.includes("lunch")) all.push({label:"🍗 Best meal type",text:"Which meal type generates the most revenue?"})
  const fb=[{label:"⚠️ Urgent?",text:"Any urgent issues right now?"},{label:"💡 Quick wins",text:"Top 3 quick actions to improve operations."},{label:"📅 Today's summary",text:"Full summary of today — orders, revenue, stock."}]
  const res=all.slice(0,3); for(const f of fb){if(res.length>=4)break;if(!res.find(x=>x.text===f.text))res.push(f)}
  return res
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState("")
  const [refreshed, setRefreshed] = useState(new Date())
  const [stats, setStats] = useState({low:0,out:0,orders:0,rev:0,today:0})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function refresh() {
    try {
      const inv=getInventoryItems(), orders=readActive(), paid=orders.filter(o=>o.paymentStatus==="paid")
      const now=new Date(), ph=new Date(now.getTime()+now.getTimezoneOffset()*60000+8*3600000)
      setStats({
        low: inv.filter(i=>i.stock>0&&i.stock<=5&&!i.isUtensil&&!i.isContainer&&i.category!=="raw-stock").length,
        out: inv.filter(i=>i.stock===0&&!i.isUtensil&&!i.isContainer&&i.category!=="raw-stock").length,
        orders: new Set(orders.map((o:any)=>o.id).filter(Boolean)).size,
        rev: paid.reduce((s,o)=>s+(o.total||0),0),
        today: new Set(orders.filter(o=>new Date(o.date||o.createdAt||"").toDateString()===ph.toDateString()).map((o:any)=>o.id).filter(Boolean)).size,
      })
      setContext(buildContext())
      setRefreshed(new Date())
    } catch {}
  }

  useEffect(()=>{
    refresh()
    const iv=setInterval(refresh,30000)
    const fn=()=>refresh()
    window.addEventListener("firebase-orders-updated",fn)
    window.addEventListener("customer-orders-updated",fn)
    window.addEventListener("firebase-inventory-updated",fn)
    return()=>{clearInterval(iv);window.removeEventListener("firebase-orders-updated",fn);window.removeEventListener("customer-orders-updated",fn);window.removeEventListener("firebase-inventory-updated",fn)}
  },[])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}) },[messages,loading])

  const grow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height="auto"
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"
  }

  const send = async (text?: string) => {
    const t=(text??input).trim(); if(!t||loading) return
    setInput(""); if(inputRef.current)inputRef.current.style.height="auto"
    const um:Message={role:"user",content:t}
    const msgs=[...messages,um]; setMessages(msgs); setLoading(true)
    try {
      const res=await fetch("/api/ai-assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:msgs,context})})
      if(!res.ok)throw new Error(`HTTP ${res.status}`)
      const d=await res.json(); if(d.error)throw new Error(d.error)
      setMessages(p=>[...p,{role:"assistant",content:d.reply}])
    } catch(err) {
      setMessages(p=>[...p,{role:"assistant",content:`❌ Could not reach AI service. Check GROQ_API_KEY in Vercel.`}])
    } finally { setLoading(false) }
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}
  }

  return (
    <POSLayout fullWidth>
      <div className="h-full flex flex-col min-h-0" style={{background:"var(--background)"}}>

        {/* ── Gradient hero header ── */}
        <div className="shrink-0 relative overflow-hidden"
          style={{background:"linear-gradient(135deg, #1a0a00 0%, #2d1500 40%, #1a0a00 100%)"}}>
          {/* Subtle noise grain overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",backgroundSize:"128px"}} />
          {/* Amber glow blob */}
          <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full opacity-20 blur-3xl"
            style={{background:"radial-gradient(circle, #f59e0b, transparent)"}} />
          <div className="absolute -top-4 right-8 w-32 h-32 rounded-full opacity-10 blur-2xl"
            style={{background:"radial-gradient(circle, #fb923c, transparent)"}} />

          <div className="relative px-4 sm:px-6 pt-4 pb-3">
            {/* Top row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{background:"linear-gradient(135deg,#f59e0b,#ea580c)",boxShadow:"0 2px 12px rgba(245,158,11,0.4)"}}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm sm:text-base tracking-tight">YRC Insight</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{background:"rgba(245,158,11,0.2)",color:"#fbbf24",border:"1px solid rgba(245,158,11,0.3)"}}>AI</span>
                  </div>
                  <p className="text-[10px] sm:text-xs mt-0.5" style={{color:"rgba(255,255,255,0.45)"}}>
                    Live business intelligence · updates every 30s
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length>0&&(
                  <button onClick={()=>setMessages([])}
                    className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
                    style={{color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.06)"}}>
                    Clear
                  </button>
                )}
                <button onClick={refresh} title="Refresh"
                  className="p-1.5 rounded-lg transition-all hover:rotate-180"
                  style={{color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.06)",transition:"all 0.4s"}}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{scrollbarWidth:"none"}}>
              {[
                {icon:Package,    label:"Low stock", val:stats.low,   warn:stats.low>0},
                {icon:AlertTriangle,label:"Out",     val:stats.out,   warn:stats.out>0},
                {icon:ShoppingCart, label:"Orders",  val:stats.orders,warn:false},
                {icon:ChefHat,    label:"Today",     val:stats.today, warn:false},
                {icon:TrendingUp, label:`₱${stats.rev.toLocaleString()}`, val:null, warn:false},
              ].map((s,i)=>(
                <div key={i} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                  style={s.warn
                    ? {background:"rgba(239,68,68,0.2)",color:"#fca5a5",border:"1px solid rgba(239,68,68,0.3)"}
                    : {background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.1)"}
                  }>
                  <s.icon className="w-3 h-3" />
                  {s.val!==null&&<span>{s.val}</span>}
                  <span>{s.label}</span>
                </div>
              ))}
              <span className="ml-auto shrink-0 text-[10px] hidden sm:block" style={{color:"rgba(255,255,255,0.3)"}}>
                {refreshed.toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Manila"})}
              </span>
            </div>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-5 space-y-5"
          style={{background:"linear-gradient(180deg,var(--background) 0%,var(--background) 100%)"}}>

          {/* Empty state */}
          {messages.length===0&&(
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 pb-6">
              {/* Glowing icon */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl opacity-40"
                  style={{background:"radial-gradient(circle,#f59e0b,transparent)",transform:"scale(1.5)"}} />
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                  style={{background:"linear-gradient(135deg,#1a0a00,#2d1500)",border:"1px solid rgba(245,158,11,0.3)",boxShadow:"0 8px 32px rgba(245,158,11,0.15),inset 0 1px 0 rgba(255,255,255,0.05)"}}>
                  <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" style={{color:"#f59e0b"}} />
                </div>
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{color:"var(--foreground)"}}>
                  What can I help with?
                </h2>
                <p className="text-sm mt-1.5" style={{color:"var(--muted-foreground)"}}>
                  Ask about stock, orders, revenue, or predictions
                </p>
              </div>
              {/* Suggestion chips in 2-col on mobile */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 justify-center max-w-xs sm:max-w-lg w-full">
                {SUGGESTED.map(s=>(
                  <button key={s.label} onClick={()=>send(s.text)} disabled={loading}
                    className="text-xs sm:text-sm px-3 sm:px-4 py-2.5 rounded-xl text-left sm:text-center transition-all disabled:opacity-40"
                    style={{
                      background:"var(--card)",
                      border:"1px solid var(--border)",
                      color:"var(--foreground)",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
                    }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(245,158,11,0.5)")}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg,i)=>(
            <div key={i} className={cn("flex gap-2.5 sm:gap-3",msg.role==="user"?"justify-end":"justify-start")}>
              {msg.role==="assistant"&&(
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{background:"linear-gradient(135deg,#f59e0b,#ea580c)",boxShadow:"0 2px 8px rgba(245,158,11,0.35)"}}>
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
              <div className="flex flex-col gap-2 max-w-[86%] sm:max-w-[76%]">
                <div className={cn("rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed")}
                  style={msg.role==="assistant"
                    ? {background:"var(--muted)",color:"var(--foreground)",borderRadius:"4px 18px 18px 18px",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}
                    : {background:"linear-gradient(135deg,#f59e0b,#ea580c)",color:"#fff",borderRadius:"18px 4px 18px 18px",boxShadow:"0 2px 12px rgba(245,158,11,0.3)"}}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role==="assistant"&&i===messages.length-1&&!loading&&(
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {followUps(msg.content).map(s=>(
                      <button key={s.text} onClick={()=>send(s.text)} disabled={loading}
                        className="text-[11px] px-2.5 py-1 rounded-full transition-all disabled:opacity-50"
                        style={{border:"1px solid var(--border)",background:"var(--background)",color:"var(--muted-foreground)"}}
                        onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(245,158,11,0.5)")}
                        onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--border)")}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role==="user"&&(
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{background:"var(--muted)",border:"1px solid var(--border)"}}>
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{color:"var(--muted-foreground)"}} />
                </div>
              )}
            </div>
          ))}

          {/* Typing dots */}
          {loading&&(
            <div className="flex gap-2.5 justify-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{background:"linear-gradient(135deg,#f59e0b,#ea580c)",boxShadow:"0 2px 8px rgba(245,158,11,0.35)"}}>
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl" style={{background:"var(--muted)",borderRadius:"4px 18px 18px 18px"}}>
                {[0,150,300].map(d=>(
                  <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{background:"var(--muted-foreground)",opacity:0.5,animationDelay:`${d}ms`}} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 px-3 sm:px-6 pb-3 sm:pb-4 pt-2">
          <div className="flex items-end gap-2 rounded-2xl px-3 sm:px-4 py-2.5 transition-all"
            style={{
              background:"var(--card)",
              border:"1px solid var(--border)",
              boxShadow:"0 4px 24px rgba(0,0,0,0.07)",
            }}
            onFocusCapture={e=>((e.currentTarget as HTMLElement).style.borderColor="rgba(245,158,11,0.5)")}
            onBlurCapture={e=>((e.currentTarget as HTMLElement).style.borderColor="var(--border)")}>
            <textarea ref={inputRef} value={input} onChange={grow} onKeyDown={onKey}
              placeholder="Ask anything…"
              disabled={loading} rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 py-0.5 min-h-[24px] max-h-[120px] leading-relaxed"
              style={{height:"auto"}} />
            <button onClick={()=>send()} disabled={loading||!input.trim()}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 transition-all disabled:opacity-40"
              style={input.trim()&&!loading
                ? {background:"linear-gradient(135deg,#f59e0b,#ea580c)",boxShadow:"0 2px 10px rgba(245,158,11,0.4)"}
                : {background:"var(--muted)"}}>
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{color:input.trim()?"white":"var(--muted-foreground)"}} />
                : <Send className="w-3.5 h-3.5" style={{color:input.trim()&&!loading?"white":"var(--muted-foreground)"}} />
              }
            </button>
          </div>
          <p className="text-center text-[10px] mt-1.5" style={{color:"var(--muted-foreground)",opacity:0.5}}>
            YRC Insight can make mistakes — verify critical decisions
          </p>
        </div>
      </div>
    </POSLayout>
  )
}