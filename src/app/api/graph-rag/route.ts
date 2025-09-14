import { NextResponse } from 'next/server'
import { queryGraphContext } from '@/app/api/graph/graph_rag.cjs'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function cerebrasGenerate(promptText: string, opts?: { model?: string; temperature?: number; maxTokens?: number }) {
  const baseUrl = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1'
  const apiKey = process.env.CEREBRAS_API_KEY || process.env.OPENAI_API_KEY || ''
  const model = opts?.model || process.env.CEREBRAS_MODEL || 'gpt-oss-120b'
  const temperature = typeof opts?.temperature === 'number' ? opts!.temperature : 0.7
  const maxTokens = typeof opts?.maxTokens === 'number' ? opts!.maxTokens : 4096
  if (!apiKey) throw new Error('Missing CEREBRAS_API_KEY')

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a clinical assistant.' },
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

function normalizeText(text: string) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildContextFromLocal(topNodes: any[], neighborRows: any[]) {
  const lines: string[] = []
  lines.push('Relevant Nodes:')
  topNodes.forEach((n: any, i: number) => {
    let body = String(n.body || '').trim()
    if (body.length > 400) body = body.slice(0, 400) + '…'
    lines.push(`${i + 1}. [${n.label}] ${n.title}\n${body}`)
  })
  if (neighborRows && neighborRows.length > 0) {
    lines.push('\nNeighbor Relationships:')
    for (const row of neighborRows) {
      if (row.nbr_title == null) continue
      let desc: any = row.rel_props && row.rel_props.description ? row.rel_props.description : null
      if (!desc) {
        try { desc = JSON.stringify(row.rel_props) } catch { desc = String(row.rel_props || '') }
      }
      const src = `[${row.src_label}] ${row.src_title}`
      const tgt = `[${row.nbr_label}] ${row.nbr_title}`
      lines.push(`- ${src} --ASSOCIATED_WITH--> ${tgt} :: ${desc}`)
    }
  }
  return lines.join('\n')
}

function mapTagToLabel(tag: string): string {
  const t = String(tag || '').toLowerCase().trim()
  if (t === 'diagnosis' || t === 'condition') return 'Diagnosis'
  if (t === 'medication' || t === 'drug') return 'Medication'
  if (t === 'lab' || t === 'labtest' || t === 'test' || t === 'testresult') return 'TestResult'
  return 'Entity'
}

function readGraphJSONFromRepo() {
  const appCwd = process.cwd()
  const graphPath = path.join(process.cwd(), 'src', 'app', 'api', 'graph', 'prompts', 'graph.json')
  try {
    if (fs.existsSync(graphPath)) {
      const txt = fs.readFileSync(graphPath, { encoding: 'utf-8' })
      const obj = JSON.parse(txt)
      return obj
    }
  } catch {}
  // Fallback to separate node lists if present
  const diagnosesPath = path.join(process.cwd(), 'src', 'app', 'api', 'graph', 'prompts', 'diagnoses.json')
  const labsPath = path.join(process.cwd(), 'src', 'app', 'api', 'graph', 'prompts', 'labs.json')
  const medsPath = path.join(process.cwd(), 'src', 'app', 'api', 'graph', 'prompts', 'medications.json')
  const safeRead = (p: string) => {
    try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : [] } catch { return [] }
  }
  return { Nodes: [...safeRead(diagnosesPath), ...safeRead(labsPath), ...safeRead(medsPath)], Links: [] }
}

function buildLocalGraphContext(params: { question: string; topK: number; neighborK: number; includeTypes: string[] | null }) {
  const { question, topK, neighborK, includeTypes } = params
  const data = readGraphJSONFromRepo() || { Nodes: [], Links: [] }
  const nodes: any[] = Array.isArray(data.Nodes) ? data.Nodes : []
  const links: any[] = Array.isArray(data.Links) ? data.Links : []

  const q = normalizeText(question)
  const terms = q.split(' ').filter(Boolean)
  const typeAllow = includeTypes && includeTypes.length > 0 ? new Set(includeTypes.map((x) => String(x).toLowerCase())) : null

  const scored: any[] = []
  for (const n of nodes) {
    const title = String(n.title || '').trim()
    const body = String(n.body || '').trim()
    const tags = String(n.tags || '').trim()
    const label = mapTagToLabel(tags)
    if (typeAllow && !typeAllow.has(label.toLowerCase())) continue
    const hay = normalizeText(`${title} ${body}`)
    let score = 0
    for (const term of terms) {
      if (term && hay.includes(term)) score += hay.split(term).length - 1
    }
    if (score > 0) scored.push({ node_id: null, label, title, body, score })
  }
  const topNodes = scored.sort((a, b) => b.score - a.score).slice(0, Math.max(1, topK || 6))

  // Build neighbor rows from Links (if available)
  const titleSet = new Set(topNodes.map((n) => String(n.title).toLowerCase()))
  const neighborRows: any[] = []
  const cap = Math.max(1, neighborK || 4)
  for (const l of links) {
    const sLabel = String(l.source || '').trim()
    const tLabel = String(l.target || '').trim()
    const sType = mapTagToLabel(String(l.source_type || l.sourceType || ''))
    const tType = mapTagToLabel(String(l.target_type || l.targetType || ''))
    if (titleSet.has(sLabel.toLowerCase()) || titleSet.has(tLabel.toLowerCase())) {
      neighborRows.push({
        src_id: null,
        src_label: sType,
        src_title: sLabel,
        src_body: '',
        nbr_id: null,
        nbr_label: tType,
        nbr_title: tLabel,
        nbr_body: '',
        rel_props: { description: String(l.description || ''), confidence: l.value ?? l.confidence },
      })
      if (neighborRows.length >= cap) break
    }
  }

  const context = buildContextFromLocal(topNodes, neighborRows)
  return { topNodes, neighborRows, context }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const question = String(body?.question || body?.query || '').trim()
    if (!question) return NextResponse.json({ error: "Missing 'question' in request body." }, { status: 400 })
    const defaultTopK = Number(process.env.GRAPH_RAG_TOP_K_DEFAULT ?? 12)
    const defaultNeighborK = Number(process.env.GRAPH_RAG_NEIGHBOR_K_DEFAULT ?? 10)
    const topK = Number(body?.top_k != null ? body.top_k : defaultTopK)
    const neighborK = Number(body?.neighbor_k != null ? body.neighbor_k : defaultNeighborK)
    const includeTypes = Array.isArray(body?.include_types) ? body.include_types : null

    // Resolve Neo4j creds (optional)
    const uriEnv = process.env.NEO4J_URI || 'bolt://localhost:7687'
    let user = process.env.NEO4J_USER || 'neo4j'
    let password = process.env.NEO4J_PASSWORD || ''
    if (!password && process.env.NEO4J_AUTH) {
      const auth = String(process.env.NEO4J_AUTH)
      const sep = auth.includes(':') ? ':' : '/'
      const parts = auth.split(sep)
      if (parts.length >= 2) {
        if (!user) user = parts[0]
        password = parts.slice(1).join(sep)
      }
    }
    if (!password) {
      const m = uriEnv.match(/^bolt:\/\/([^:@]+):([^@]+)@(.+)$/)
      if (m) {
        user = m[1]
        password = m[2]
      }
    }
    const uri = uriEnv.replace(/^bolt:\/\/[^@]+@/, 'bolt://')

    let topNodes: any[] = []
    let neighborRows: any[] = []
    let context = ''

    const haveNeo4j = Boolean(user && password)
    if (haveNeo4j) {
      try {
        const res = await queryGraphContext({ uri, user, password, question, topK, neighborK, includeTypes })
        topNodes = res.topNodes
        neighborRows = res.neighborRows
        context = res.context
      } catch {
        // fall back to local graph.json
      }
    }

    if (!context || context.trim().length === 0) {
      const local = buildLocalGraphContext({ question, topK, neighborK, includeTypes })
      topNodes = local.topNodes
      neighborRows = local.neighborRows
      context = local.context
    }

    const systemPrompt = 'You are a clinical assistant. Use the provided graph context consisting of relevant nodes and their relationships to answer the question accurately. Cite node titles when applicable.'
    const userContent = `Question:\n${question}\n\nGraph Context:\n${context}\n\nAnswer concisely.`
    const { content, modelUsed } = await cerebrasGenerate([systemPrompt, userContent].join('\n\n'))

    return NextResponse.json({ question, answer: content, model: modelUsed, context, top_nodes: topNodes, neighbors: neighborRows })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}



