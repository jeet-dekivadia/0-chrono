import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function readText(filePath: string): string {
  return fs.readFileSync(filePath, { encoding: 'utf-8' })
}

function safeJsonLoads(text: string): any {
  try { return JSON.parse(text) } catch (e) {
    const objMatch = String(text).match(/\{[\s\S]*\}/)
    if (objMatch) { try { return JSON.parse(objMatch[0]) } catch {} }
    const arrMatch = String(text).match(/\[[\s\S]*\]/)
    if (arrMatch) { try { return JSON.parse(arrMatch[0]) } catch {} }
    throw e
  }
}

async function cerebrasGenerate(promptText: string, opts?: { model?: string; temperature?: number; maxTokens?: number }) {
  const baseUrl = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1'
  const apiKey = process.env.CEREBRAS_API_KEY || process.env.OPENAI_API_KEY || ''
  const model = opts?.model || process.env.LINK_MODEL || process.env.CEREBRAS_LINK_MODEL || process.env.CEREBRAS_MODEL || 'gpt-oss-120b'
  const temperature = typeof opts?.temperature === 'number' ? opts!.temperature : 0.35
  const maxTokens = typeof opts?.maxTokens === 'number' ? opts!.maxTokens : 16384
  if (!apiKey) throw new Error('Missing CEREBRAS_API_KEY')

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
    if (typeof content === 'string' && content.length > 0) return content
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
  if (typeof data2?.output_text === 'string' && data2.output_text.length > 0) return data2.output_text
  const maybe = data2?.output?.[0]?.content?.[0]?.text
  if (typeof maybe === 'string' && maybe.length > 0) return maybe
  throw new Error('Cerebras returned no text')
}

function normalizeNodeArray(maybeNodes: any[]): { title: string; body: string; tags: string }[] {
  const out: { title: string; body: string; tags: string }[] = []
  const seen = new Set<string>()
  ;(Array.isArray(maybeNodes) ? maybeNodes : []).forEach((n) => {
    if (!n || typeof n !== 'object') return
    const title = String((n as any).title || (n as any).label || '').trim()
    if (!title) return
    const key = title.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const body = String((n as any).body || (n as any).description || '').trim()
    const tags = String((n as any).tags || (n as any).type || '').trim()
    out.push({ title, body, tags })
  })
  return out
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const appCwd = process.cwd()
    const repoRoot = path.resolve(appCwd, '..')

    const diagNodes = normalizeNodeArray(body?.diagnoses || body?.diag || body?.conditions)
    const labNodes = normalizeNodeArray(body?.labs || body?.lab_tests || body?.labTests)
    const medNodes = normalizeNodeArray(body?.medications || body?.meds || body?.drugs)

    if (diagNodes.length === 0 && labNodes.length === 0 && medNodes.length === 0) {
      return NextResponse.json({ error: "No nodes provided. Include 'diagnoses', 'labs', or 'medications'." }, { status: 400 })
    }

    const promptsDir = path.join(process.cwd(), 'src', 'app', 'api', 'graph', 'prompts')
    const tryResolvePrompt = (name: string) => {
      const p1 = path.join(promptsDir, name)
      if (fs.existsSync(p1)) return p1
      const p2 = path.join(repoRoot, name)
      if (fs.existsSync(p2)) return p2
      return p1
    }

    const linkerPrompt = tryResolvePrompt('linker_prompt.txt')
    const tmpl = readText(linkerPrompt)
    const reasoningPreamble = [
      'You are an expert clinical knowledge graph builder.',
      'Think step-by-step. Infer clinically plausible relationships, but avoid hallucination.',
      'Prefer high-recall edges that are still clinically reasonable.',
      "Return strictly valid JSON with a top-level object containing 'Links'.",
      'Do not include any free text outside the JSON.',
    ].join('\n')
    const filled = `${reasoningPreamble}\n\n${tmpl}`
      .replace('<PATIENT_DIAGNOSES>', JSON.stringify(diagNodes, null, 2))
      .replace('<PATIENT_LABS>', JSON.stringify(labNodes, null, 2))
      .replace('<PATIENT_MEDICATIONS>', JSON.stringify(medNodes, null, 2))

    try { fs.writeFileSync(path.join(repoRoot, 'linker.txt'), filled, { encoding: 'utf-8' }) } catch {}

    let links: any[] = []
    try {
      const content = await cerebrasGenerate(filled)
      try { fs.writeFileSync(path.join(repoRoot, 'linker_response.txt'), String(content ?? ''), { encoding: 'utf-8' }) } catch {}
      const data = safeJsonLoads(content)
      links = Array.isArray(data?.Links) ? data.Links : []
    } catch {
      links = []
    }

    const toTitleSet = (arr: any[]) => new Set((arr || []).map((n) => String(n && n.title ? n.title : '').trim().toLowerCase()).filter(Boolean))
    const diagSet = toTitleSet(diagNodes)
    const labSet = toTitleSet(labNodes)
    const medSet = toTitleSet(medNodes)
    const normType = (raw: any, labelLc: string) => {
      const t = String(raw || '').trim().toLowerCase()
      if (t) return t
      if (diagSet.has(labelLc)) return 'diagnosis'
      if (labSet.has(labelLc)) return 'lab'
      if (medSet.has(labelLc)) return 'medication'
      return ''
    }
    const clamp01 = (x: any) => {
      const n = Number(x)
      if (!isFinite(n)) return null
      if (n < 0) return 0
      if (n > 1) return 1
      return n
    }
    links = (links || []).filter((l: any) => l && typeof l === 'object').map((l: any) => {
      const srcLabel = String(l.source || '').trim()
      const tgtLabel = String(l.target || '').trim()
      const srcLabelLc = srcLabel.toLowerCase()
      const tgtLabelLc = tgtLabel.toLowerCase()
      const srcType = normType(l.source_type || l.sourceType, srcLabelLc)
      const tgtType = normType(l.target_type || l.targetType, tgtLabelLc)
      const valueNum = clamp01(l.value != null ? l.value : l.confidence)
      const desc = String(l.description || '').trim()
      const out: any = { source: srcLabel, source_type: srcType, target: tgtLabel, target_type: tgtType, description: desc }
      if (valueNum != null) out.value = valueNum
      return out
    })

    const graphObj = { Nodes: [...diagNodes, ...labNodes, ...medNodes], Links: links }
    if (body?.save === true || body?.save_graph === true) {
      try { fs.writeFileSync(path.join(repoRoot, 'graph.json'), JSON.stringify(graphObj, null, 2), { encoding: 'utf-8' }) } catch {}
    }

    return NextResponse.json(graphObj)
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}



