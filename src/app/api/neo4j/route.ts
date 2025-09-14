import { NextResponse } from 'next/server'
import neo4j from 'neo4j-driver'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function resolveNeo4jCreds() {
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
  return { uri, user, password }
}

function toPlain(value: any): any {
  if (value == null) return value
  // neo4j integers
  // @ts-ignore - isInt exists at runtime
  if (typeof (neo4j as any).isInt === 'function' && (neo4j as any).isInt(value)) {
    return value.toNumber()
  }
  if (Array.isArray(value)) return value.map((v) => toPlain(v))
  if (typeof value === 'object') {
    // Node or Relationship shape
    const v: any = value
    if (v && v.identity != null && v.properties != null) {
      const id = typeof v.identity?.toNumber === 'function' ? v.identity.toNumber() : v.identity
      const props = toPlain(v.properties)
      if (Array.isArray(v.labels)) {
        return { id, labels: v.labels, properties: props }
      }
      if (typeof v.type === 'string') {
        const start = typeof v.start?.toNumber === 'function' ? v.start.toNumber() : v.start
        const end = typeof v.end?.toNumber === 'function' ? v.end.toNumber() : v.end
        return { id, type: v.type, start, end, properties: props }
      }
    }
    const out: Record<string, any> = {}
    for (const [k, val] of Object.entries(v)) out[k] = toPlain(val)
    return out
  }
  return value
}

export async function GET() {
  try {
    const { uri, user, password } = resolveNeo4jCreds()
    if (!user || !password) return NextResponse.json({ error: 'Neo4j credentials not provided. Set NEO4J_USER/NEO4J_PASSWORD or NEO4J_AUTH.' }, { status: 400 })
    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
    try {
      const session = driver.session()
      try {
        const res = await session.run('RETURN 1 AS ok')
        const ok = res.records?.[0]?.get('ok')
        return NextResponse.json({ connected: true, ok: typeof ok?.toNumber === 'function' ? ok.toNumber() : ok })
      } finally {
        await session.close()
      }
    } finally {
      await driver.close()
    }
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: String(err?.message || err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = String(body?.query || '').trim()
    const params = (body?.params && typeof body.params === 'object') ? body.params : {}
    const database = typeof body?.database === 'string' && body.database ? body.database : undefined
    const readOnly = Boolean(body?.readOnly)
    if (!query) return NextResponse.json({ error: "Missing 'query' in request body." }, { status: 400 })

    const { uri, user, password } = resolveNeo4jCreds()
    if (!user || !password) return NextResponse.json({ error: 'Neo4j credentials not provided. Set NEO4J_USER/NEO4J_PASSWORD or NEO4J_AUTH.' }, { status: 400 })

    const driver = neo4j.driver(uri, neo4j.auth.basic(user, password))
    try {
      const session = driver.session({ database, defaultAccessMode: readOnly ? neo4j.session.READ : neo4j.session.WRITE })
      try {
        const result = await session.run(query, params)
        const records = (result.records || []).map((r) => {
          const obj = r.toObject()
          return toPlain(obj)
        })
        return NextResponse.json({ records })
      } finally {
        await session.close()
      }
    } finally {
      await driver.close()
    }
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 })
  }
}



