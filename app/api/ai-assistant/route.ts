import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/ai-assistant
 * Uses Google Gemini API (free tier — 1,500 requests/day)
 * Get your free key at: aistudio.google.com → Get API Key
 * Add to .env.local: GEMINI_API_KEY=your-key-here
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
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set. Go to aistudio.google.com, get a free API key, then add GEMINI_API_KEY=your-key to your .env.local file and restart the server.' },
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

    // Build Gemini conversation history
    // Gemini uses "user" and "model" roles (not "assistant")
    const geminiHistory = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    // Last message is the current user prompt
    const lastMessage = messages[messages.length - 1]
    const userText = lastMessage?.content || ''

    const geminiBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: userText }] },
      ],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[ai-assistant] Gemini error:', response.status, errText)
      let friendlyError = `Gemini API returned ${response.status}.`
      try {
        const parsed = JSON.parse(errText)
        if (parsed?.error?.message) friendlyError = parsed.error.message
      } catch { /* use default */ }
      return NextResponse.json({ error: friendlyError }, { status: 200, headers: corsHeaders })
    }

    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)'
    return NextResponse.json({ reply }, { headers: corsHeaders })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown server error'
    console.error('[ai-assistant] Unexpected error:', msg)
    return NextResponse.json({ error: msg }, { status: 200, headers: corsHeaders })
  }
}