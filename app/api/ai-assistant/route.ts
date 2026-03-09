import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ai-assistant
 * Uses Groq API (free tier — fast inference)
 * Get your free key at: console.groq.com → API Keys
 * Add to .env.local: GROQ_API_KEY=your-key-here
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not set. Go to console.groq.com, create a free API key, then add GROQ_API_KEY=your-key to your .env.local file and restart the server.' },
        { status: 200, headers: corsHeaders }
      )
    }

    const body = await req.json()
    const { messages = [], context = '' } = body

    const systemPrompt = `You are YRC Insight — the smart business assistant for Yellow Roast Co. (YRC), a roast chicken restaurant based in the Philippines.

You have real-time access to the restaurant's live data provided below. Use it to give sharp, actionable insights.

Your core abilities:
1. INVENTORY ANALYSIS — identify low-stock, overstock, and consumption patterns
2. ORDER ANALYSIS — daily/weekly trends, peak times, most ordered items
3. DEMAND PREDICTION — based on order history, predict what will be needed
4. REVENUE TRACKING — paid vs unpaid, cash vs GCash breakdown
5. RECOMMENDATIONS — restock alerts, pricing opportunities, menu suggestions
6. OPERATIONAL ALERTS — flag urgent issues (zero stock on high-demand items)

Tone: Confident, concise, Filipino-business-friendly. Use ₱ for Philippine Peso.
Format: Bullet points and short paragraphs. Be specific with numbers.
If data is empty or missing, say so clearly and offer general guidance.

━━━━━━━━━━━━ LIVE BUSINESS DATA ━━━━━━━━━━━━
${context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

    // Groq uses the OpenAI-compatible chat completions format
    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    ]

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[ai-assistant] Groq error:', response.status, errText)
      let friendlyError = `Groq API returned ${response.status}.`
      try {
        const parsed = JSON.parse(errText)
        if (parsed?.error?.message) friendlyError = parsed.error.message
      } catch { /* use default */ }
      return NextResponse.json({ error: friendlyError }, { status: 200, headers: corsHeaders })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content ?? '(no response)'
    return NextResponse.json({ reply }, { headers: corsHeaders })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    console.error('[ai-assistant] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 200, headers: corsHeaders })
  }
}