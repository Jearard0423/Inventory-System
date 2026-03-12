"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Bot, Send, User, Loader2, Sparkles, TrendingUp, Package, ShoppingCart, AlertTriangle, RefreshCw, ChefHat } from "lucide-react"
import { getInventoryItems, getLowStockItems, getCustomerOrders } from "@/lib/inventory-store"
import { cn } from "@/lib/utils"

interface Message { role: "user" | "assistant"; content: string }

const DONE = new Set(["delivered","served","cancelled","canceled","complete","completed"])
const readActive = () => {
  try {
    const now = new Date()
    const phNow = new Date(now.getTime() + now.getTimezoneOffset()*60000 + 8*3600000)
    const todayMidnight = new Date(phNow); todayMidnight.setHours(0,0,0,0)
    return getCustomerOrders().filter(o => {
      const status = (o.status || "").toLowerCase()
      if (DONE.has(status)) return false
      // If order has a delivery date, only include if today or future (no past ghosts)
      if (o.date) {
        const parts = o.date.split("-").map(Number)
        const deliveryDay = new Date(parts[0], parts[1]-1, parts[2], 23, 59, 59)
        const hoursAgo = (phNow.getTime() - deliveryDay.getTime()) / 3600000
        if (hoursAgo > 2) return false // Past delivery date = ghost, exclude
      } else if (o.createdAt) {
        // No delivery date set — exclude if created more than 2 days ago
        const created = new Date(o.createdAt)
        const daysAgo = (phNow.getTime() - created.getTime()) / (1000*60*60*24)
        if (daysAgo > 2) return false
      }
      return true
    })
  } catch { return [] }
}

function buildContext() {
  try {
    const inv=getInventoryItems(), orders=readActive(), low=getLowStockItems()
    const now=new Date(), ph=new Date(now.getTime()+now.getTimezoneOffset()*60000+8*3600000)
    const dl=ph.toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Manila"})
    const tl=ph.toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Asia/Manila"})
    const food=inv.filter(i=>!i.isUtensil&&!i.isContainer&&i.category!=="raw-stock")
    const raw=inv.filter(i=>i.category==="raw-stock")
    const paid=orders.filter(o=>o.paymentStatus==="paid"), unpaid=orders.filter(o=>o.paymentStatus!=="paid")
    const rev=paid.reduce((s,o)=>s+(o.total||0),0), pend=unpaid.reduce((s,o)=>s+(o.total||0),0)
    const freq:Record<string,number>={};orders.forEach(o=>(o.items||o.orderedItems||[]).forEach((it:any)=>{freq[it.name]=(freq[it.name]||0)+(it.quantity||1)}))
    const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,q])=>`${n}(${q})`)
    const mb:Record<string,number>={};orders.forEach(o=>{const mt=(o.mealType||o.originalMealType||"other").toLowerCase();mb[mt]=(mb[mt]||0)+1})
    const today=ph.toDateString();const tod=orders.filter(o=>new Date(o.date||o.createdAt||"").toDateString()===today)
    return `PH Date/Time: ${dl}, ${tl}\nFood inventory: ${food.map(i=>`${i.name}:${i.stock}@₱${i.price}[${i.status}]`).join(", ")}\nRaw stock: ${raw.map(i=>`${i.name}:${i.stock}`).join(", ")}\nLow stock alerts: ${low.map(i=>`${i.name}(${i.stock})`).join(", ")||"none"}\nActive orders: ${orders.length} total, today:${tod.length}, paid:${paid.length}, unpaid:${unpaid.length}\nRevenue: collected ₱${rev.toLocaleString()}, pending ₱${pend.toLocaleString()}\nMeal breakdown: ${Object.entries(mb).map(([m,c])=>`${m}:${c}`).join(", ")}\nTop ordered: ${top.join(", ")}\nLatest: ${orders.slice(0,10).map(o=>`${o.customerName}|${o.orderNumber||o.id}|₱${o.total||0}`).join("; ")||"none"}`
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
  const r=reply.toLowerCase(), all: {label:string;text:string}[]=[]
  if(r.includes("stock")||r.includes("inventory")) all.push({label:"📈 Top sellers",text:"Which items sell the most?"})
  if(r.includes("revenue")||r.includes("₱")) all.push({label:"💸 Unpaid list",text:"List all unpaid orders with totals."})
  if(r.includes("order")||r.includes("pending")) all.push({label:"⏱ Overdue?",text:"Are any orders overdue or approaching delivery time?"})
  if(r.includes("meal")||r.includes("breakfast")) all.push({label:"🍗 Best meal type",text:"Which meal type generates the most revenue?"})
  const fb=[{label:"⚠️ Urgent?",text:"Any urgent issues right now?"},{label:"💡 Quick wins",text:"Top 3 quick actions to improve operations."},{label:"📅 Today's summary",text:"Full summary of today — orders, revenue, stock."}]
  const res=all.slice(0,3); for(const f of fb){if(res.length>=4)break;if(!res.find(x=>x.text===f.text))res.push(f)}
  return res
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [context, setContext]   = useState("")
  const [refreshed, setRefreshed] = useState(new Date())
  const [stats, setStats] = useState({low:0,out:0,orders:0,rev:0,today:0})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  function refresh() {
    try {
      const inv=getInventoryItems(), orders=readActive(), paid=orders.filter(o=>o.paymentStatus==="paid")
      const now=new Date(), ph=new Date(now.getTime()+now.getTimezoneOffset()*60000+8*3600000)
      setStats({
        low:  inv.filter(i=>i.stock>0&&i.stock<=5&&!i.isUtensil&&!i.isContainer&&i.category!=="raw-stock").length,
        out:  inv.filter(i=>i.stock===0&&!i.isUtensil&&!i.isContainer&&i.category!=="raw-stock").length,
        orders: new Set(orders.map((o:any)=>o.id).filter(Boolean)).size,
        rev:  paid.reduce((s,o)=>s+(o.total||0),0),
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
    return()=>{clearInterval(iv);["firebase-orders-updated","customer-orders-updated","firebase-inventory-updated"].forEach(e=>window.removeEventListener(e,fn))}
  },[])

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}) },[messages,loading])

  const grow=(e: React.ChangeEvent<HTMLTextAreaElement>)=>{
    setInput(e.target.value)
    e.target.style.height="auto"
    e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"
  }

  const send=async(text?: string)=>{
    const t=(text??input).trim(); if(!t||loading) return
    setInput(""); if(inputRef.current) inputRef.current.style.height="auto"
    const um:Message={role:"user",content:t}
    const msgs=[...messages,um]; setMessages(msgs); setLoading(true)
    try {
      const res=await fetch("/api/ai-assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:msgs,context})})
      if(!res.ok) throw new Error(`HTTP ${res.status}`)
      const d=await res.json(); if(d.error) throw new Error(d.error)
      setMessages(p=>[...p,{role:"assistant",content:d.reply}])
    } catch(err) {
      setMessages(p=>[...p,{role:"assistant",content:`❌ Could not reach AI. Check GROQ_API_KEY in Vercel environment variables.`}])
    } finally { setLoading(false) }
  }

  const onKey=(e: React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}
  }

  // YRC brand colors
  const YRC_RED    = "#C8333A"   // primary from logo
  const YRC_YELLOW = "#F4C542"   // secondary from logo  
  const YRC_CREAM  = "#FDF8F0"   // warm off-white background
  const YRC_BROWN  = "#3D1A0A"   // deep roast brown
  const YRC_RUST   = "#A0240B"   // darker red

  return (
    <POSLayout fullWidth>
      <div className="h-full flex flex-col min-h-0" style={{background:YRC_CREAM}}>

        {/* ── Header — deep roast brown with YRC red/yellow accents ── */}
        <div className="shrink-0 relative overflow-hidden rounded-b-none"
          style={{background:`linear-gradient(135deg, ${YRC_BROWN} 0%, #5a2210 50%, ${YRC_BROWN} 100%)`,zIndex:1}}>

          {/* Subtle warm texture */}
          <div className="absolute inset-0" style={{
            backgroundImage:"radial-gradient(ellipse at 20% 50%, rgba(200,51,58,0.2) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(244,197,66,0.12) 0%, transparent 50%)",
          }} />
          {/* Thin gold border line at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{background:`linear-gradient(90deg, transparent, ${YRC_YELLOW}55, transparent)`}} />

          <div className="relative px-4 sm:px-6 pt-4 pb-3">
            {/* Logo row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{background:`linear-gradient(135deg, ${YRC_RED}, ${YRC_RUST})`,boxShadow:`0 2px 12px ${YRC_RED}55`}}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm sm:text-base tracking-tight">YRC Insight</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{background:"rgba(244,197,66,0.2)",color:YRC_YELLOW,border:`1px solid ${YRC_YELLOW}44`}}>
                      AI
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs mt-0.5" style={{color:"rgba(255,255,255,0.45)"}}>
                    Live business intelligence · updates every 30s
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length>0&&(
                  <button onClick={()=>setMessages([])}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.06)"}}>
                    Clear
                  </button>
                )}
                <button onClick={refresh} title="Refresh data"
                  className="p-1.5 rounded-lg"
                  style={{color:"rgba(255,255,255,0.5)",background:"rgba(255,255,255,0.06)"}}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{scrollbarWidth:"none"}}>
              {[
                {icon:Package,      label:"Low stock",                      val:stats.low,   warn:stats.low>0},
                {icon:AlertTriangle,label:"Out",                            val:stats.out,   warn:stats.out>0},
                {icon:ShoppingCart, label:"Orders",                         val:stats.orders,warn:false},
                {icon:ChefHat,      label:"Today",                          val:stats.today, warn:false},
                {icon:TrendingUp,   label:`₱${stats.rev.toLocaleString()}`, val:null,        warn:false},
              ].map((s,i)=>(
                <div key={i} className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                  style={s.warn
                    ? {background:"rgba(200,51,58,0.25)",color:"#fca5a5",border:"1px solid rgba(200,51,58,0.4)"}
                    : {background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.65)",border:"1px solid rgba(255,255,255,0.12)"}
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
        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-5 space-y-5" style={{background:YRC_CREAM}}>

          {/* Empty state */}
          {messages.length===0&&(
            <div className="flex flex-col items-center justify-center h-full text-center gap-5 pb-6 overflow-hidden">
              {/* YRC-branded icon — no overflow glow on mobile */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background:`linear-gradient(135deg, ${YRC_BROWN}, #5a2210)`,
                  border:`1px solid ${YRC_YELLOW}44`,
                  boxShadow:`0 4px 20px ${YRC_RED}30, 0 0 0 4px ${YRC_RED}10`
                }}>
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" style={{color:YRC_YELLOW}} />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{color:YRC_BROWN}}>
                  What can I help with?
                </h2>
                <p className="text-sm mt-1.5" style={{color:"oklch(0.55 0.02 30)"}}>
                  Ask about stock, orders, revenue, or predictions
                </p>
              </div>

              {/* 2-col chips on mobile, row on desktop */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 justify-center max-w-xs sm:max-w-lg w-full">
                {SUGGESTED.map(s=>(
                  <button key={s.label} onClick={()=>send(s.text)} disabled={loading}
                    className="text-xs sm:text-sm px-3 sm:px-4 py-2.5 rounded-xl text-left sm:text-center transition-all disabled:opacity-40 active:scale-95"
                    style={{
                      background:"#fff",
                      border:`1px solid #e8e0d5`,
                      color:YRC_BROWN,
                      boxShadow:"0 1px 3px rgba(61,26,10,0.07)",
                    }}
                    onMouseEnter={e=>{
                      e.currentTarget.style.borderColor=`${YRC_RED}66`
                      e.currentTarget.style.background=`${YRC_RED}06`
                    }}
                    onMouseLeave={e=>{
                      e.currentTarget.style.borderColor="#e8e0d5"
                      e.currentTarget.style.background="#fff"
                    }}>
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
                  style={{background:`linear-gradient(135deg, ${YRC_RED}, ${YRC_RUST})`,boxShadow:`0 2px 8px ${YRC_RED}44`}}>
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
              )}
              <div className="flex flex-col gap-2 max-w-[86%] sm:max-w-[76%]">
                <div className="px-3.5 py-2.5 text-sm leading-relaxed"
                  style={msg.role==="assistant"
                    ? {
                        background:"#fff",
                        color:YRC_BROWN,
                        borderRadius:"4px 18px 18px 18px",
                        border:"1px solid #ede8e2",
                        boxShadow:"0 1px 4px rgba(61,26,10,0.06)"
                      }
                    : {
                        background:`linear-gradient(135deg, ${YRC_RED}, ${YRC_RUST})`,
                        color:"#fff",
                        borderRadius:"18px 4px 18px 18px",
                        boxShadow:`0 2px 12px ${YRC_RED}44`
                      }
                  }>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role==="assistant"&&i===messages.length-1&&!loading&&(
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {followUps(msg.content).map(s=>(
                      <button key={s.text} onClick={()=>send(s.text)} disabled={loading}
                        className="text-[11px] px-2.5 py-1 rounded-full transition-all disabled:opacity-50"
                        style={{border:"1px solid #e8e0d5",background:"#fff",color:"oklch(0.55 0.02 30)"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=`${YRC_RED}55`}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="#e8e0d5"}}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role==="user"&&(
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{background:"#ede8e2",border:"1px solid #ddd6cc"}}>
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{color:YRC_BROWN}} />
                </div>
              )}
            </div>
          ))}

          {/* Typing dots */}
          {loading&&(
            <div className="flex gap-2.5 justify-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{background:`linear-gradient(135deg, ${YRC_RED}, ${YRC_RUST})`,boxShadow:`0 2px 8px ${YRC_RED}44`}}>
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
                style={{background:"#fff",border:"1px solid #ede8e2",borderRadius:"4px 18px 18px 18px"}}>
                {[0,150,300].map(d=>(
                  <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                    style={{background:YRC_RED,opacity:0.6,animationDelay:`${d}ms`}} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 px-3 sm:px-6 pb-3 sm:pb-4 pt-2" style={{background:YRC_CREAM}}>
          {/* Thin decorative top line */}
          <div className="h-px mb-2 mx-4" style={{background:`linear-gradient(90deg, transparent, ${YRC_YELLOW}44, transparent)`}} />
          <div className="flex items-end gap-2 rounded-2xl px-3 sm:px-4 py-2.5 transition-all"
            style={{background:"#fff",border:`1px solid #e8e0d5`,boxShadow:"0 2px 16px rgba(61,26,10,0.07)"}}
            onFocusCapture={e=>(e.currentTarget.style.borderColor=`${YRC_RED}55`)}
            onBlurCapture={e=>(e.currentTarget.style.borderColor="#e8e0d5")}>
            <textarea ref={inputRef} value={input} onChange={grow} onKeyDown={onKey}
              placeholder="Ask anything…"
              disabled={loading} rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none disabled:opacity-50 py-0.5 min-h-[24px] max-h-[120px] leading-relaxed"
              style={{color:YRC_BROWN,height:"auto"}}
            />
            <button onClick={()=>send()} disabled={loading||!input.trim()}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 transition-all disabled:opacity-40"
              style={input.trim()&&!loading
                ? {background:`linear-gradient(135deg, ${YRC_RED}, ${YRC_RUST})`,boxShadow:`0 2px 10px ${YRC_RED}44`}
                : {background:"#f0ebe4"}
              }>
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{color:input.trim()?"white":YRC_BROWN}} />
                : <Send className="w-3.5 h-3.5" style={{color:input.trim()&&!loading?"white":YRC_BROWN,opacity:input.trim()?1:0.4}} />
              }
            </button>
          </div>
          <p className="text-center text-[10px] mt-1.5" style={{color:"oklch(0.55 0.02 30)",opacity:0.5}}>
            YRC Insight can make mistakes — verify critical decisions
          </p>
        </div>

      </div>
    </POSLayout>
  )
}