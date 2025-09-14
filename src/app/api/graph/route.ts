import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function slugify(text: string): string {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nodeTypeFrom(sourceType: string): 'Condition' | 'LabTest' | 'Drug' | 'Guideline' | 'Patient' | 'Appointment' {
  const t = String(sourceType || '').trim().toLowerCase()
  if (t === 'diagnosis' || t === 'condition') return 'Condition'
  if (t === 'test' || t === 'test results' || t === 'lab' || t === 'labtest' || t === 'lab test') return 'LabTest'
  if (t === 'medication' || t === 'drug') return 'Drug'
  if (t === 'patient') return 'Patient'
  if (t === 'appointment') return 'Appointment'
  return 'Guideline'
}

function edgeTypeFrom(srcTypeRaw: string, tgtTypeRaw: string): string {
  const src = nodeTypeFrom(srcTypeRaw)
  const tgt = nodeTypeFrom(tgtTypeRaw)
  if (src === 'Condition' && tgt === 'LabTest') return 'has_lab'
  if (src === 'Condition' && tgt === 'Drug') return 'prescribed'
  if (src === 'LabTest' && tgt === 'Drug') return 'prescribed'
  if (src === 'Drug' && tgt === 'Drug') return 'interacts_with'
  if (src === 'Patient' && tgt === 'Appointment') return 'has_appointment'
  return 'guideline'
}

function safeReadJson(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const text = fs.readFileSync(filePath, { encoding: 'utf-8' })
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const appCwd = process.cwd()
    const repoRoot = path.resolve(appCwd, '..')
    // Resolve graph.json relative to the route's prompts directory in the repo
    const graphPath = path.join(process.cwd(), 'src', 'app', 'api', 'graph', 'prompts', 'graph.json')

    let data: any = safeReadJson(graphPath)

    if (!data) {
      // Fallback: build a minimal graph from available JSONs if present
      const diagnoses = safeReadJson(path.join(repoRoot, 'diagnoses.json')) || []
      const labs = safeReadJson(path.join(repoRoot, 'labs.json')) || []
      const meds = safeReadJson(path.join(repoRoot, 'medications.json')) || []
      data = { Nodes: [...diagnoses, ...labs, ...meds], Links: [] }
    }

    const links: any[] = Array.isArray(data.Links) ? data.Links : []
    const rawNodes: any[] = Array.isArray(data.Nodes) ? data.Nodes : []

    const labelToNode = new Map<string, any>()
    try {
      rawNodes.forEach((n) => {
        if (!n || typeof n !== 'object') return
        const titleLc = String(n.title || '').trim().toLowerCase()
        if (titleLc) labelToNode.set(titleLc, n)
      })
    } catch {}

    const nodesMap = new Map<string, any>()
    try {
      rawNodes.forEach((n) => {
        if (!n || typeof n !== 'object') return
        const label = String(n.title || '').trim()
        if (!label) return
        const tags = String(n.tags || '').trim()
        const type = nodeTypeFrom(tags || '')
        const id = `${type.toLowerCase()}:${slugify(label)}`
        if (nodesMap.has(id)) return
        const nodeObj: any = { id, type, label }
        if (n.body != null) nodeObj.body = String(n.body)
        if (tags) nodeObj.tags = String(tags)
        nodesMap.set(id, nodeObj)
      })
    } catch {}

    const edges: any[] = []
    links.forEach((link: any, idx: number) => {
      const srcLabel = String(link.source || '').trim()
      const tgtLabel = String(link.target || '').trim()
      if (!srcLabel || !tgtLabel) return
      const srcTypeRaw = String(link.source_type || link.sourceType || '').trim()
      const tgtTypeRaw = String(link.target_type || link.targetType || '').trim()
      const srcType = nodeTypeFrom(srcTypeRaw)
      const tgtType = nodeTypeFrom(tgtTypeRaw)
      const srcId = `${srcType.toLowerCase()}:${slugify(srcLabel)}`
      const tgtId = `${tgtType.toLowerCase()}:${slugify(tgtLabel)}`
      if (!nodesMap.has(srcId)) {
        const info = labelToNode.get(srcLabel.toLowerCase())
        const nodeObj: any = { id: srcId, type: srcType, label: srcLabel }
        if (info && info.body) nodeObj.body = String(info.body)
        if (info && info.tags) nodeObj.tags = String(info.tags)
        nodesMap.set(srcId, nodeObj)
      }
      if (!nodesMap.has(tgtId)) {
        const info = labelToNode.get(tgtLabel.toLowerCase())
        const nodeObj: any = { id: tgtId, type: tgtType, label: tgtLabel }
        if (info && info.body) nodeObj.body = String(info.body)
        if (info && info.tags) nodeObj.tags = String(info.tags)
        nodesMap.set(tgtId, nodeObj)
      }
      const edgeType = edgeTypeFrom(srcTypeRaw, tgtTypeRaw)
      const rawVal = link.value != null ? link.value : link.confidence
      let confidence = Number(rawVal)
      if (!isFinite(confidence)) confidence = 0.8
      if (confidence < 0) confidence = 0
      if (confidence > 1) confidence = 1
      const description = String(link.description || '').trim()
      const edgeObj: any = { id: `edge-${idx}`, source: srcId, target: tgtId, type: edgeType, confidence }
      if (description) edgeObj.description = description
      edges.push(edgeObj)
    })

    return NextResponse.json({ nodes: Array.from(nodesMap.values()), edges })
  } catch (err: any) {
    return NextResponse.json({ nodes: [], edges: [], error: String(err && err.message ? err.message : err) }, { status: 500 })
  }
}

type GraphObj = { Nodes?: any[]; Links?: any[] }

function toNodesAndEdgesFromGraphObj(data: GraphObj) {
  const links: any[] = Array.isArray(data.Links) ? data.Links : []
  const rawNodes: any[] = Array.isArray(data.Nodes) ? data.Nodes : []

  const labelToNode = new Map<string, any>()
  try {
    rawNodes.forEach((n) => {
      if (!n || typeof n !== 'object') return
      const titleLc = String(n.title || '').trim().toLowerCase()
      if (titleLc) labelToNode.set(titleLc, n)
    })
  } catch {}

  const nodesMap = new Map<string, any>()
  try {
    rawNodes.forEach((n) => {
      if (!n || typeof n !== 'object') return
      const label = String(n.title || '').trim()
      if (!label) return
      const tags = String(n.tags || '').trim()
      const type = nodeTypeFrom(tags || '')
      const id = `${type.toLowerCase()}:${slugify(label)}`
      if (nodesMap.has(id)) return
      const nodeObj: any = { id, type, label }
      if (n.body != null) nodeObj.body = String(n.body)
      if (tags) nodeObj.tags = String(tags)
      nodesMap.set(id, nodeObj)
    })
  } catch {}

  const edges: any[] = []
  links.forEach((link: any, idx: number) => {
    const srcLabel = String(link.source || '').trim()
    const tgtLabel = String(link.target || '').trim()
    if (!srcLabel || !tgtLabel) return
    const srcTypeRaw = String(link.source_type || link.sourceType || '').trim()
    const tgtTypeRaw = String(link.target_type || link.targetType || '').trim()
    const srcType = nodeTypeFrom(srcTypeRaw)
    const tgtType = nodeTypeFrom(tgtTypeRaw)
    const srcId = `${srcType.toLowerCase()}:${slugify(srcLabel)}`
    const tgtId = `${tgtType.toLowerCase()}:${slugify(tgtLabel)}`
    if (!nodesMap.has(srcId)) {
      const info = labelToNode.get(srcLabel.toLowerCase())
      const nodeObj: any = { id: srcId, type: srcType, label: srcLabel }
      if (info && info.body) nodeObj.body = String(info.body)
      if (info && info.tags) nodeObj.tags = String(info.tags)
      nodesMap.set(srcId, nodeObj)
    }
    if (!nodesMap.has(tgtId)) {
      const info = labelToNode.get(tgtLabel.toLowerCase())
      const nodeObj: any = { id: tgtId, type: tgtType, label: tgtLabel }
      if (info && info.body) nodeObj.body = String(info.body)
      if (info && info.tags) nodeObj.tags = String(info.tags)
      nodesMap.set(tgtId, nodeObj)
    }
    const edgeType = edgeTypeFrom(srcTypeRaw, tgtTypeRaw)
    const rawVal = link.value != null ? link.value : link.confidence
    let confidence = Number(rawVal)
    if (!isFinite(confidence)) confidence = 0.8
    if (confidence < 0) confidence = 0
    if (confidence > 1) confidence = 1
    const description = String(link.description || '').trim()
    const edgeObj: any = { id: `edge-${idx}`, source: srcId, target: tgtId, type: edgeType, confidence }
    if (description) edgeObj.description = description
    edges.push(edgeObj)
  })

  return { nodes: Array.from(nodesMap.values()), edges }
}

function splitItems(text: string): string[] {
  return String(text || '')
    .split(/[;,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function POST() {
  try {
    // Fetch data from Supabase
    const { data: medRecords, error: mrErr } = await supabase
      .from('medical_records')
      .select('id, diagnosis, history_of_present_illness, physical_examination')

    if (mrErr) throw new Error(`Supabase medical_records error: ${mrErr.message}`)

    const { data: prescriptions, error: prErr } = await supabase
      .from('prescriptions')
      .select('id, medication_name, dosage, frequency, instructions')

    if (prErr) throw new Error(`Supabase prescriptions error: ${prErr.message}`)

    // Build nodes
    const diagMap = new Map<string, { title: string; body?: string; tags: string }>()
    for (const rec of medRecords || []) {
      const dx = String(rec?.diagnosis || '').trim()
      if (!dx) continue
      const candidates = splitItems(dx)
      const bodyParts: string[] = []
      if (rec?.history_of_present_illness) bodyParts.push(String(rec.history_of_present_illness))
      if (rec?.physical_examination) bodyParts.push(String(rec.physical_examination))
      const body = bodyParts.join('\n').trim()
      for (const c of candidates) {
        const key = c.toLowerCase()
        if (!diagMap.has(key)) diagMap.set(key, { title: c, body, tags: 'diagnosis' })
      }
    }

    const medMap = new Map<string, { title: string; body?: string; tags: string }>()
    for (const p of prescriptions || []) {
      const name = String(p?.medication_name || '').trim()
      if (!name) continue
      const bodyBits: string[] = []
      if (p?.dosage) bodyBits.push(`Dosage: ${p.dosage}`)
      if (p?.frequency) bodyBits.push(`Frequency: ${p.frequency}`)
      if (p?.instructions) bodyBits.push(`Instructions: ${p.instructions}`)
      const body = bodyBits.join(' | ').trim()
      const key = name.toLowerCase()
      if (!medMap.has(key)) medMap.set(key, { title: name, body, tags: 'medication' })
    }

    const diagnoses = Array.from(diagMap.values())
    const medications = Array.from(medMap.values())
    const labs: any[] = []

    if (diagnoses.length === 0 && medications.length === 0) {
      return NextResponse.json({ nodes: [], edges: [], error: 'No Supabase data found to build graph.' }, { status: 200 })
    }

    // Build links locally using Cerebras
    const appCwd = process.cwd()
    const repoRoot = path.resolve(appCwd, '..')

    function tryResolvePrompt(name: string): string {
      const p1 = path.join(repoRoot, name)
      if (fs.existsSync(p1)) return p1
      const p2 = path.join(repoRoot, 'zero-chrono', 'zero-chrono-be', 'prompts', name)
      if (fs.existsSync(p2)) return p2
      return p1
    }

    const linkerPromptPath = tryResolvePrompt('linker_prompt.txt')
    const tmpl = fs.readFileSync(linkerPromptPath, { encoding: 'utf-8' })
    const reasoningPreamble = [
      'You are an expert clinical knowledge graph builder.',
      'Think step-by-step. Infer clinically plausible relationships, but avoid hallucination.',
      'Prefer high-recall edges that are still clinically reasonable.',
      "Return strictly valid JSON with a top-level object containing 'Links'.",
      'Do not include any free text outside the JSON.',
    ].join('\n')
    const filled = `${reasoningPreamble}\n\n${tmpl}`
      .replace('<PATIENT_DIAGNOSES>', JSON.stringify(diagnoses, null, 2))
      .replace('<PATIENT_LABS>', JSON.stringify(labs, null, 2))
      .replace('<PATIENT_MEDICATIONS>', JSON.stringify(medications, null, 2))

    try {
      fs.writeFileSync(path.join(repoRoot, 'linker.txt'), filled, { encoding: 'utf-8' })
    } catch {}

    async function cerebrasChat(promptText: string): Promise<string> {
      const baseUrl = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1'
      const apiKey = process.env.CEREBRAS_API_KEY || process.env.OPENAI_API_KEY || ''
      const model = process.env.LINK_MODEL || process.env.CEREBRAS_LINK_MODEL || process.env.CEREBRAS_MODEL || 'gpt-oss-120b'
      const temperature = Number(process.env.LINK_TEMPERATURE != null ? process.env.LINK_TEMPERATURE : 0.35)
      const maxTokens = Number(process.env.LINK_MAX_TOKENS != null ? process.env.LINK_MAX_TOKENS : 16384)
      if (!apiKey) throw new Error('Missing CEREBRAS_API_KEY')

      // Try chat.completions first
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
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
      // Fallback to Responses API
      const resp2 = await fetch(`${baseUrl}/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
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

    function safeJsonLoads(text: string): any {
      try {
        return JSON.parse(text)
      } catch (e) {
        const objMatch = String(text).match(/\{[\s\S]*\}/)
        if (objMatch) {
          try { return JSON.parse(objMatch[0]) } catch {}
        }
        const arrMatch = String(text).match(/\[[\s\S]*\]/)
        if (arrMatch) {
          try { return JSON.parse(arrMatch[0]) } catch {}
        }
        throw e
      }
    }

    let links: any[] = []
    try {
      const content = await cerebrasChat(filled)
      try { fs.writeFileSync(path.join(repoRoot, 'linker_response.txt'), String(content ?? ''), { encoding: 'utf-8' }) } catch {}
      const data = safeJsonLoads(content)
      links = Array.isArray(data?.Links) ? data.Links : []
    } catch (err) {
      links = []
    }

    // Normalize links
    const toTitleSet = (arr: any[]) => new Set((arr || []).map((n) => String(n && n.title ? n.title : '').trim().toLowerCase()).filter(Boolean))
    const diagSet = toTitleSet(diagnoses)
    const labSet = toTitleSet(labs)
    const medSet = toTitleSet(medications)
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

    const graphObj: GraphObj = { Nodes: [...diagnoses, ...labs, ...medications], Links: links }
    const { nodes, edges } = toNodesAndEdgesFromGraphObj(graphObj)
    return NextResponse.json({ nodes, edges })
  } catch (err: any) {
    return NextResponse.json({ nodes: [], edges: [], error: String(err && err.message ? err.message : err) }, { status: 500 })
  }
}


