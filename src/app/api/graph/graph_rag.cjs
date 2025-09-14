const neo4j = require("neo4j-driver");

function normalizeText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function ensureFulltextIndexes(session) {
  const statements = [
    "CREATE FULLTEXT INDEX nodeText_Diagnosis IF NOT EXISTS FOR (n:Diagnosis) ON EACH [n.title, n.body]",
    "CREATE FULLTEXT INDEX nodeText_Medication IF NOT EXISTS FOR (n:Medication) ON EACH [n.title, n.body]",
    "CREATE FULLTEXT INDEX nodeText_TestResult IF NOT EXISTS FOR (n:TestResult) ON EACH [n.title, n.body]",
    "CREATE FULLTEXT INDEX nodeText_Entity IF NOT EXISTS FOR (n:Entity) ON EACH [n.title, n.body]",
  ];
  for (const stmt of statements) {
    try { await session.run(stmt); } catch (_) {}
  }
}

async function runFulltextSearch(session, query, topK, includeTypes) {
  const labels = Array.isArray(includeTypes) && includeTypes.length > 0
    ? includeTypes
    : ["Diagnosis", "Medication", "TestResult", "Entity"];
  const results = [];
  const kInt = neo4j.int(Math.max(0, Math.floor(Number(topK) || 6)));
  for (const label of labels) {
    const indexName = `nodeText_${label}`;
    try {
      const cypher = "CALL db.index.fulltext.queryNodes($index, $q, {limit: $k}) " +
        "YIELD node, score RETURN id(node) AS id, labels(node)[0] AS label, node.title AS title, node.body AS body, score";
      const res = await session.run(cypher, { index: indexName, q: query, k: kInt });
      for (const r of res.records) {
        results.push({
          node_id: r.get("id").toInt ? r.get("id").toInt() : r.get("id"),
          label: r.get("label"),
          title: r.get("title") || "",
          body: r.get("body") || "",
          score: Number(r.get("score")),
        });
      }
    } catch (_) {}
  }
  const best = new Map();
  for (const rn of results) {
    const prev = best.get(rn.node_id);
    if (!prev || rn.score > prev.score) best.set(rn.node_id, rn);
  }
  const ranked = Array.from(best.values()).sort((a, b) => b.score - a.score);
  return ranked.slice(0, Number(topK) || 6);
}

async function runSubstringFallback(session, query, topK, includeTypes) {
  const q = normalizeText(query);
  const labels = Array.isArray(includeTypes) && includeTypes.length > 0
    ? includeTypes
    : ["Diagnosis", "Medication", "TestResult", "Entity"];
  const labelFilter = labels.join("|");
  const cypher = "MATCH (n) WHERE ANY(l IN labels(n) WHERE l IN split($labels, '|')) " +
    "RETURN id(n) AS id, labels(n)[0] AS label, n.title AS title, n.body AS body";
  const res = await session.run(cypher, { labels: labelFilter });
  const candidates = [];
  const kInt = Math.max(0, Math.floor(Number(topK) || 6));
  for (const rec of res.records) {
    const id = rec.get("id");
    const nodeId = id && typeof id.toInt === "function" ? id.toInt() : id;
    const title = rec.get("title") || "";
    const body = rec.get("body") || "";
    const hay = normalizeText(`${title} ${body}`);
    let score = 0;
    for (const term of q.split(" ")) {
      if (term && hay.includes(term)) score += hay.split(term).length - 1;
    }
    if (score > 0) candidates.push({ node_id: nodeId, label: rec.get("label"), title, body, score });
  }
  const ranked = candidates.sort((a, b) => b.score - a.score);
  return ranked.slice(0, kInt);
}

async function getNeighbors(session, nodeIds, neighborK) {
  if (!nodeIds || nodeIds.length === 0) return [];
  const cypher = "MATCH (n) WHERE id(n) IN $ids " +
    "OPTIONAL MATCH (n)-[r:ASSOCIATED_WITH]-(m) " +
    "WITH n, r, m ORDER BY coalesce(r.weight, 1.0) DESC LIMIT $k " +
    "RETURN id(n) AS src_id, labels(n)[0] AS src_label, n.title AS src_title, n.body AS src_body, " +
    "id(m) AS nbr_id, labels(m)[0] AS nbr_label, m.title AS nbr_title, m.body AS nbr_body, properties(r) AS rel_props";
  const kInt = neo4j.int(Math.max(0, Math.floor(Number(neighborK) || 4)));
  const idsParam = nodeIds.map((id) => (typeof id === "number" ? neo4j.int(id) : id));
  const res = await session.run(cypher, { ids: idsParam, k: kInt });
  const rows = [];
  for (const rec of res.records) {
    const srcId = rec.get("src_id");
    const nbrId = rec.get("nbr_id");
    rows.push({
      src_id: srcId && typeof srcId.toInt === "function" ? srcId.toInt() : srcId,
      src_label: rec.get("src_label"),
      src_title: rec.get("src_title") || "",
      src_body: rec.get("src_body") || "",
      nbr_id: nbrId && typeof nbrId?.toInt === "function" ? nbrId.toInt() : nbrId,
      nbr_label: rec.get("nbr_label") || null,
      nbr_title: rec.get("nbr_title") || null,
      nbr_body: rec.get("nbr_body") || null,
      rel_props: rec.get("rel_props") || {},
    });
  }
  return rows;
}

function buildContext(topNodes, neighborRows) {
  const lines = [];
  lines.push("Relevant Nodes:");
  topNodes.forEach((n, i) => {
    let body = String(n.body || "").trim();
    if (body.length > 400) body = body.slice(0, 400) + "…";
    lines.push(`${i + 1}. [${n.label}] ${n.title}\n${body}`);
  });
  if (neighborRows && neighborRows.length > 0) {
    lines.push("\nNeighbor Relationships:");
    for (const row of neighborRows) {
      if (row.nbr_id == null) continue;
      let desc = row.rel_props && row.rel_props.description ? row.rel_props.description : null;
      if (!desc) {
        try { desc = JSON.stringify(row.rel_props); } catch (_) { desc = String(row.rel_props || ""); }
      }
      const src = `[${row.src_label}] ${row.src_title}`;
      const tgt = `[${row.nbr_label}] ${row.nbr_title}`;
      lines.push(`- ${src} --ASSOCIATED_WITH--> ${tgt} :: ${desc}`);
    }
  }
  return lines.join("\n");
}

async function queryGraphContext({ uri, user, password, question, topK, neighborK, includeTypes }) {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  try {
    const session = driver.session();
    try {
      await ensureFulltextIndexes(session);
      let topNodes = await runFulltextSearch(session, question, topK, includeTypes);
      if (!topNodes || topNodes.length === 0) {
        topNodes = await runSubstringFallback(session, question, topK, includeTypes);
      }
      let neighborRows = [];
      if (topNodes && topNodes.length > 0) {
        const ids = topNodes.map((n) => n.node_id);
        neighborRows = await getNeighbors(session, ids, neighborK);
      }
      const context = buildContext(topNodes, neighborRows);
      return { topNodes, neighborRows, context };
    } finally {
      await session.close();
    }
  } finally {
    await driver.close();
  }
}

module.exports = {
  queryGraphContext,
};


