import { NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function buildCsvContextFromText(csvText: string, delimiter: string, csvMaxRows: number, ragColumns: string, ragMaxChars: number): string {
  const records: string[][] = parse(csvText, {
    delimiter: delimiter || ',',
    relaxQuotes: true,
    relaxColumnCount: true,
  })
  if (!records || records.length === 0) return ''
  const header = (records[0] || []).map((c) => String(c).trim())
  const allRows = records.slice(1, 1 + Math.max(1, csvMaxRows)).map((row) => row.map((c) => String(c).trim()))
  const colIndices = (() => {
    if (!ragColumns || ragColumns.trim() === '*') return Array.from({ length: header.length }, (_, i) => i)
    const requested = ragColumns.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
    const headerLc = header.map((h) => h.toLowerCase())
    const indices: number[] = []
    for (const name of requested) {
      if (/^\d+$/.test(name)) {
        const idx = Number(name)
        if (idx >= 0 && idx < header.length) indices.push(idx)
      } else {
        const found = headerLc.indexOf(name)
        if (found !== -1) indices.push(found)
      }
    }
    const seen = new Set<number>()
    const unique: number[] = []
    for (const i of indices) { if (!seen.has(i)) { seen.add(i); unique.push(i) } }
    return unique.length > 0 ? unique : Array.from({ length: header.length }, (_, i) => i)
  })()
  const selectedHeader = colIndices.length > 0 ? colIndices.map((i) => header[i]) : header.slice()
  const lines: string[] = []
  lines.push(selectedHeader.join(' | '))
  lines.push(selectedHeader.map((h) => '-'.repeat(Math.max(3, Math.min(20, String(h).length)))).join(' | '))
  for (const row of allRows) {
    const line = (colIndices.length > 0 ? colIndices.map((i) => (i < row.length ? String(row[i]) : '')) : row).join(' | ')
    lines.push(line)
    const running = lines.reduce((acc, l) => acc + l.length + 1, 0)
    if (running > ragMaxChars) break
  }
  let table = lines.join('\n')
  if (table.length > ragMaxChars) table = table.slice(0, Math.max(0, ragMaxChars - 3)) + '...'
  return (
    'You are given a CSV-derived context table.\n' +
    'Use this table as authoritative context if it answers the question.\n\n' +
    `CSV Context (first ${allRows.length} rows):\n${table}\n\n`
  )
}

async function cerebrasGenerate(promptText: string, opts?: { model?: string; temperature?: number; maxTokens?: number }) {
  const baseUrl = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1'
  const apiKey = process.env.CEREBRAS_API_KEY || process.env.OPENAI_API_KEY || ''
  const model = opts?.model || process.env.CEREBRAS_MODEL || 'gpt-oss-120b'
  const temperature = typeof opts?.temperature === 'number' ? opts!.temperature : 0.7
  const maxTokens = typeof opts?.maxTokens === 'number' ? opts!.maxTokens : 4096
  if (!apiKey) throw new Error('Missing CEREBRAS_API_KEY')

  // Try chat.completions first
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: promptText },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (resp.ok) {
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content === 'string' && content.length > 0) return { content, modelUsed: data?.model || model }
  }

  // Fallback to Responses API
  const resp2 = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: promptText, temperature, max_output_tokens: maxTokens }),
  })
  if (!resp2.ok) {
    const errTxt = await resp2.text()
    throw new Error(`Cerebras error ${resp.status}/${resp2.status}: ${errTxt}`)
  }
  const data2 = await resp2.json()
  if (typeof data2?.output_text === 'string' && data2.output_text.length > 0) return { content: data2.output_text, modelUsed: data2?.model || model }
  const maybe = data2?.output?.[0]?.content?.[0]?.text
  if (typeof maybe === 'string' && maybe.length > 0) return { content: maybe, modelUsed: data2?.model || model }
  throw new Error('Cerebras returned no text')
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const promptText = data?.prompt
    if (!promptText) return NextResponse.json({ error: "Missing 'prompt' in JSON body." }, { status: 400 })

    const csvContent = data?.csv_content
    const csvDelimiter = data?.csv_delimiter || ','
    const csvMaxRows = Number(data?.csv_max_rows != null ? data.csv_max_rows : 1000)
    const ragColumns = data?.rag_columns || '*'
    const ragMaxChars = Number(data?.rag_max_chars != null ? data.rag_max_chars : 4000)

    let userContent = String(promptText)
    if (csvContent) {
      try {
        const context = buildCsvContextFromText(String(csvContent), csvDelimiter, csvMaxRows, ragColumns, ragMaxChars)
        userContent = `${context}${userContent}`
      } catch (e: any) {
        return NextResponse.json({ error: `Failed to process CSV content: ${e?.message || String(e)}` }, { status: 400 })
      }
    }

    const { content, modelUsed } = await cerebrasGenerate(userContent)
    return NextResponse.json({ content, model: modelUsed })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}



