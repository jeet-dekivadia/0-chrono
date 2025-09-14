const express = require("express");
const fs = require("fs");
const path = require("path");
const CerebrasImport = require("@cerebras/cerebras_cloud_sdk");
const Cerebras = CerebrasImport && CerebrasImport.default ? CerebrasImport.default : CerebrasImport;
const { queryGraphContext } = require("./graph_rag.cjs");
const { parse } = require("csv-parse/sync");

// ---------------- Config (Cerebras API) ----------------
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 5001);

const CEREBRAS_BASE_URL = process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1";
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || process.env.OPENAI_API_KEY || "";
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || process.env.MODEL || "gpt-oss-120b";
const CEREBRAS_TEMPERATURE = Number(process.env.CEREBRAS_TEMPERATURE || 0.7);
const CEREBRAS_MAX_TOKENS = Number(process.env.CEREBRAS_MAX_TOKENS || 4096);
const CEREBRAS_TOP_P = Number(process.env.CEREBRAS_TOP_P != null ? process.env.CEREBRAS_TOP_P : 1);
const CEREBRAS_REASONING_EFFORT = process.env.CEREBRAS_REASONING_EFFORT || null;
const CEREBRAS_SYSTEM_PROMPT = process.env.CEREBRAS_SYSTEM_PROMPT || "You are a helpful assistant.";

// Link-generation specific tuning knobs
const LINK_MODEL = process.env.LINK_MODEL || process.env.CEREBRAS_LINK_MODEL || null;
const LINK_TEMPERATURE = Number(process.env.LINK_TEMPERATURE != null ? process.env.LINK_TEMPERATURE : (process.env.CEREBRAS_LINK_TEMPERATURE != null ? process.env.CEREBRAS_LINK_TEMPERATURE : 0.35));
const LINK_MAX_TOKENS = Number(process.env.LINK_MAX_TOKENS != null ? process.env.LINK_MAX_TOKENS : (process.env.CEREBRAS_LINK_MAX_TOKENS != null ? process.env.CEREBRAS_LINK_MAX_TOKENS : 16384));

const client = new Cerebras({ apiKey: CEREBRAS_API_KEY });
if (!CEREBRAS_API_KEY) {
  try { console.warn("[Cerebras] Missing CEREBRAS_API_KEY; set it to authenticate requests."); } catch {}
}

// ---------------- Express app and CORS ----------------
const app = express();
app.use(express.json({ limit: "4mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ---------------- Helpers (ported from Python) ----------------
function readText(filePath) {
  return fs.readFileSync(filePath, { encoding: "utf-8" });
}

function safeJsonLoads(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("[DEBUG] Failed to parse JSON:", e);
    const objMatch = String(text).match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch (_) {}
    }
    const arrMatch = String(text).match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch (_) {}
    }
    throw e;
  }
}

function splitWords(text) {
  if (!text) return [];
  const matches = String(text).toLowerCase().match(/[A-Za-z0-9_]+/g);
  return matches || [];
}

function loadCsvHeadRowsFromText(csvText, delimiter, maxRows) {
  if (csvText == null) throw new Error("CSV text is null");
  const records = parse(csvText, {
    delimiter: delimiter || ",",
    relaxQuotes: true,
    relaxColumnCount: true,
  });
  if (!records || records.length === 0) return { header: [], rows: [] };
  const header = (records[0] || []).map((c) => String(c).trim());
  const rows = records
    .slice(1, 1 + Math.max(1, maxRows))
    .map((row) => row.map((c) => String(c).trim()));
  return { header, rows };
}

function loadCsvHeadRows(filePath, delimiter, maxRows) {
  const csvText = fs.readFileSync(filePath, { encoding: "utf-8" });
  return loadCsvHeadRowsFromText(csvText, delimiter, maxRows);
}

function selectColumnIndices(header, columnsArg) {
  if (!header || header.length === 0) return [];
  if (!columnsArg || String(columnsArg).trim() === "*") {
    return Array.from({ length: header.length }, (_, i) => i);
  }
  const requested = String(columnsArg)
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const headerLc = header.map((h) => String(h).toLowerCase());
  const indices = [];
  for (const name of requested) {
    if (/^\d+$/.test(name)) {
      const idx = Number(name);
      if (idx >= 0 && idx < header.length) indices.push(idx);
      continue;
    }
    const found = headerLc.indexOf(name);
    if (found !== -1) indices.push(found);
  }
  const seen = new Set();
  const unique = [];
  for (const i of indices) {
    if (!seen.has(i)) { seen.add(i); unique.push(i); }
  }
  return unique.length > 0 ? unique : Array.from({ length: header.length }, (_, i) => i);
}

function buildRowText(row, colIndices) {
  if (!colIndices || colIndices.length === 0) return row.map((c) => String(c)).join(" | ");
  return colIndices.map((i) => (i < row.length ? String(row[i]) : "")).join(" | ");
}

function formatContextTable(header, rows, selectedIndices, colIndices, maxChars) {
  const selectedHeader = colIndices && colIndices.length > 0 ? colIndices.map((i) => header[i]) : header.slice();
  const lines = [];
  lines.push(selectedHeader.join(" | "));
  lines.push(selectedHeader.map((h) => "-".repeat(Math.max(3, Math.min(20, String(h).length)))).join(" | "));
  for (const rowIdx of selectedIndices) {
    const row = rows[rowIdx] || [];
    const line = buildRowText(row, colIndices);
    lines.push(line);
    const running = lines.reduce((acc, l) => acc + l.length + 1, 0);
    if (running > maxChars) break;
  }
  let table = lines.join("\n");
  if (table.length > maxChars) table = table.slice(0, Math.max(0, maxChars - 3)) + "...";
  return table;
}

function buildCsvContextFromComponents(header, rows, ragColumns, ragMaxChars) {
  const colIndices = selectColumnIndices(header, ragColumns);
  const selectedIndices = Array.from({ length: rows.length }, (_, i) => i);
  const table = formatContextTable(header, rows, selectedIndices, colIndices, Math.max(500, ragMaxChars));
  return (
    "You are given a CSV-derived context table.\n" +
    "Use this table as authoritative context if it answers the question.\n\n" +
    `CSV Context (all ${selectedIndices.length} rows):\n${table}\n\n`
  );
}

function buildCsvContextFromFile(filePath, delimiter, csvMaxRows, ragColumns, ragMaxChars) {
  const { header, rows } = loadCsvHeadRows(filePath, delimiter, Math.max(1, csvMaxRows));
  return buildCsvContextFromComponents(header, rows, ragColumns, ragMaxChars);
}

function buildCsvContextFromText(csvText, delimiter, csvMaxRows, ragColumns, ragMaxChars) {
  const { header, rows } = loadCsvHeadRowsFromText(csvText, delimiter, Math.max(1, csvMaxRows));
  return buildCsvContextFromComponents(header, rows, ragColumns, ragMaxChars);
}

async function generateCompletionLM({ promptText, model, temperature, maxTokens }) {
  const modelName = model || CEREBRAS_MODEL;
  const temp = typeof temperature === "number" ? temperature : CEREBRAS_TEMPERATURE;
  const maxTok = typeof maxTokens === "number" ? maxTokens : CEREBRAS_MAX_TOKENS;
  const promptStr = String(promptText || "");
  try {
    const prev = promptStr.slice(0, 200).replace(/\n/g, " ");
    console.log(`[Cerebras][JS] Request model=${modelName || "auto"} temp=${temp} max_tokens=${maxTok} prompt_chars=${promptStr.length} preview=${prev}`);
  } catch {}
  let content = null;
  let response = null;
  try {
    response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: CEREBRAS_SYSTEM_PROMPT },
        { role: "user", content: promptStr },
      ],
      stream: false,
      max_completion_tokens: maxTok,
      temperature: temp,
      top_p: CEREBRAS_TOP_P,
      ...(CEREBRAS_REASONING_EFFORT ? { reasoning_effort: CEREBRAS_REASONING_EFFORT } : {}),
    });
    content = response && response.choices && response.choices[0] && response.choices[0].message
      ? response.choices[0].message.content
      : null;
    if (content) return { content, modelUsed: response.model || modelName || "auto" };
  } catch (err) {
    const status = err && err.status ? err.status : undefined;
    try { console.warn(`[Cerebras][JS] chat.completions failed${status ? ` (status ${status})` : ""}:`, err && err.message ? err.message : err); } catch {}
    // If the provider doesn't support chat.completions (404), try the Responses API as a fallback
    try {
      const resp = await client.responses.create({
        model: modelName,
        input: promptStr,
        temperature: temp,
        max_output_tokens: maxTok,
      });
      // Attempt robust extraction of text from Responses API
      if (resp && typeof resp.output_text === "string" && resp.output_text.length > 0) {
        return { content: resp.output_text, modelUsed: resp.model || modelName || "auto" };
      }
      if (resp && Array.isArray(resp.output) && resp.output[0] && Array.isArray(resp.output[0].content) && resp.output[0].content[0] && typeof resp.output[0].content[0].text === "string") {
        return { content: resp.output[0].content[0].text, modelUsed: resp.model || modelName || "auto" };
      }
    } catch (err2) {
      const status2 = err2 && err2.status ? err2.status : undefined;
      try { console.warn(`[Cerebras][JS] responses.create failed${status2 ? ` (status ${status2})` : ""}:`, err2 && err2.message ? err2.message : err2); } catch {}
      // fall through to throw below
    }
  }
  throw new Error("No content returned.");
}

async function generateCompletionForLinks({ promptText }) {
  // Use link-specialized parameters if provided
  return generateCompletionLM({
    promptText,
    model: LINK_MODEL || CEREBRAS_MODEL,
    temperature: LINK_TEMPERATURE,
    maxTokens: LINK_MAX_TOKENS,
  });
}

// ---------------- Generate endpoint (Cerebras API-compatible) ----------------
app.post("/generate", async (req, res) => {
  try {
    const data = req.body || {};
    const promptText = data.prompt;
    if (!promptText) return res.status(400).json({ error: "Missing 'prompt' in JSON body." });

    const csvContent = data.csv_content;
    const csvDelimiter = data.csv_delimiter || ",";
    const csvMaxRows = Number(data.csv_max_rows != null ? data.csv_max_rows : 1000);
    const ragColumns = data.rag_columns || "*";
    const ragMaxChars = Number(data.rag_max_chars != null ? data.rag_max_chars : 4000);

    let csvContext = null;
    if (csvContent) {
      try {
        csvContext = buildCsvContextFromText(csvContent, csvDelimiter, csvMaxRows, ragColumns, ragMaxChars);
      } catch (e) {
        return res.status(400).json({ error: `Failed to process CSV content: ${e && e.message ? e.message : e}` });
      }
    }

    const userContent = csvContext ? `${csvContext}${promptText}` : promptText;
    const { content, modelUsed } = await generateCompletionLM({ promptText: userContent });
    return res.status(200).json({ content, model: modelUsed });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// ---------------- Graph helpers ----------------
function slugify(text) {
  return String(text || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function nodeTypeFrom(sourceType) {
  const t = String(sourceType || "").trim().toLowerCase();
  if (t === "diagnosis" || t === "condition") return "Condition";
  if (t === "test" || t === "test results" || t === "lab" || t === "labtest" || t === "lab test") return "LabTest";
  if (t === "medication" || t === "drug") return "Drug";
  return "Guideline";
}

function edgeTypeFrom(srcTypeRaw, tgtTypeRaw) {
  const src = nodeTypeFrom(srcTypeRaw);
  const tgt = nodeTypeFrom(tgtTypeRaw);
  if (src === "Condition" && tgt === "LabTest") return "has_lab";
  if (src === "Condition" && tgt === "Drug") return "prescribed";
  if (src === "LabTest" && tgt === "Drug") return "prescribed";
  if (src === "Drug" && tgt === "Drug") return "interacts_with";
  if (src === "Patient" && tgt === "Appointment") return "has_appointment";
  return "guideline";
}

async function ensureNodesFromCsv(csvPath, promptPath, outJsonPath) {
  if (!fs.existsSync(csvPath)) return [];
  const promptText = readText(promptPath);
  const context = buildCsvContextFromFile(csvPath, ",", 1000, "*", 4000);
  const { content } = await generateCompletionLM({ promptText: `${context}${promptText}` });
  const data = safeJsonLoads(content);
  let nodes = [];
  if (data && typeof data === "object" && !Array.isArray(data) && data.Nodes) {
    nodes = data.Nodes || [];
  } else if (Array.isArray(data)) {
    nodes = data;
  }
  const norm = [];
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    const title = String(n.title || "").trim();
    const body = String(n.body || "").trim();
    const tags = String(n.tags || "").trim();
    if (!title) continue;
    norm.push({ title, body, tags });
  }
  fs.writeFileSync(outJsonPath, JSON.stringify(norm, null, 2), { encoding: "utf-8" });
  return norm;
}

function loadNodes(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const text = fs.readFileSync(filePath, { encoding: "utf-8" });
    return JSON.parse(text);
  } catch (_) {
    return [];
  }
}

function tryResolvePrompt(promptsDir, repoRootDir, name) {
  const p1 = path.join(promptsDir, name);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(repoRootDir, name);
  if (fs.existsSync(p2)) return p2;
  return p1;
}

async function autobuildGraph(repoRootDir) {
  const thisDir = __dirname;
  const promptsDir = path.join(thisDir, "prompts");
  const diagCsv = path.join(repoRootDir, "diagnoses.csv");
  const labCsv = path.join(repoRootDir, "labs.csv");
  const medCsv = path.join(repoRootDir, "medications.csv");

  const diagPrompt = tryResolvePrompt(promptsDir, repoRootDir, "diagnosis_summary.txt");
  const labPrompt = tryResolvePrompt(promptsDir, repoRootDir, "lab_summary_prompt.txt");
  const medPrompt = tryResolvePrompt(promptsDir, repoRootDir, "drug_summary_prompt.txt");
  const linkerPrompt = tryResolvePrompt(promptsDir, repoRootDir, "linker_prompt.txt");

  const diagJson = path.join(repoRootDir, "diagnoses.json");
  const labJson = path.join(repoRootDir, "labs.json");
  const medJson = path.join(repoRootDir, "medications.json");

  let diagNodes = [];
  let labNodes = [];
  let medNodes = [];
  try {
    diagNodes = await ensureNodesFromCsv(diagCsv, diagPrompt, diagJson);
    labNodes = await ensureNodesFromCsv(labCsv, labPrompt, labJson);
    medNodes = await ensureNodesFromCsv(medCsv, medPrompt, medJson);
  } catch (_) {}
  if (!diagNodes.length) diagNodes = loadNodes(diagJson);
  if (!labNodes.length) labNodes = loadNodes(labJson);
  if (!medNodes.length) medNodes = loadNodes(medJson);

  // Generate links via linker prompt (reasoning-enhanced)
  let links = [];
  try {
    console.log("[DEBUG] Generating links from nodes");
    const tmpl = readText(linkerPrompt);
    const reasoningPreamble = [
      "You are an expert clinical knowledge graph builder.",
      "Think step-by-step. Infer clinically plausible relationships, but avoid hallucination.",
      "Prefer high-recall edges that are still clinically reasonable.",
      "Return strictly valid JSON with a top-level object containing 'Links'.",
      "Do not include any free text outside the JSON.",
    ].join("\n");
    const filled = `${reasoningPreamble}\n\n${tmpl}`
      .replace("<PATIENT_DIAGNOSES>", JSON.stringify(diagNodes, null, 2))
      .replace("<PATIENT_LABS>", JSON.stringify(labNodes, null, 2))
      .replace("<PATIENT_MEDICATIONS>", JSON.stringify(medNodes, null, 2));
    try {
      const promptOutPath = path.join(repoRootDir, "linker.txt");
      fs.writeFileSync(promptOutPath, filled, { encoding: "utf-8" });
    } catch (_) {}
    const { content } = await generateCompletionForLinks({ promptText: filled });
    try {
      const respOutPath = path.join(repoRootDir, "linker_response.txt");
      fs.writeFileSync(respOutPath, String(content != null ? content : ""), { encoding: "utf-8" });
    } catch (_) {}

    const data = safeJsonLoads(content);
    links = data.Links;
    try {
      const linksOutPath = path.join(repoRootDir, "links_processed.json");
      fs.writeFileSync(linksOutPath, JSON.stringify(links, null, 2), { encoding: "utf-8" });
    } catch (_) {}

  } catch (err) {
    console.error("[DEBUG] Links generation error:", err);
    console.log("[DEBUG] Links generation failed");
    links = [];
  }

  // Normalize links to ensure compatibility with prompt variations
  try {
    const toTitleSet = (arr) => new Set((arr || []).map((n) => String(n && n.title ? n.title : "").trim().toLowerCase()).filter(Boolean));
    const diagSet = toTitleSet(diagNodes);
    const labSet = toTitleSet(labNodes);
    const medSet = toTitleSet(medNodes);
    const normType = (raw, labelLc) => {
      const t = String(raw || "").trim().toLowerCase();
      if (t) return t; // already provided by the model per prompt
      if (diagSet.has(labelLc)) return "diagnosis";
      if (labSet.has(labelLc)) return "lab";
      if (medSet.has(labelLc)) return "medication";
      return "";
    };
    const clamp01 = (x) => {
      const n = Number(x);
      if (!isFinite(n)) return null;
      if (n < 0) return 0;
      if (n > 1) return 1;
      return n;
    };
    links = (links || []).filter((l) => l && typeof l === "object").map((l) => {
      const srcLabel = String(l.source || "").trim();
      const tgtLabel = String(l.target || "").trim();
      const srcLabelLc = srcLabel.toLowerCase();
      const tgtLabelLc = tgtLabel.toLowerCase();
      const srcType = normType(l.source_type || l.sourceType, srcLabelLc);
      const tgtType = normType(l.target_type || l.targetType, tgtLabelLc);
      const valueNum = clamp01(l.value != null ? l.value : l.confidence);
      const desc = String(l.description || "").trim();
      const out = {
        source: srcLabel,
        source_type: srcType,
        target: tgtLabel,
        target_type: tgtType,
        description: desc,
      };
      if (valueNum != null) out.value = valueNum;
      return out;
    });
  } catch (_) {}

  const allNodes = [...diagNodes, ...labNodes, ...medNodes];
  const graphObj = { Nodes: allNodes, Links: links };
  const graphPath = path.join(repoRootDir, "graph.json");
  fs.writeFileSync(graphPath, JSON.stringify(graphObj, null, 2), { encoding: "utf-8" });
  return graphObj;
}

// ---------------- Graph endpoint ----------------
app.get("/graph", async (req, res) => {
  try {
    const thisDir = __dirname;
    const repoRoot = path.resolve(thisDir, "..", "..");
    const graphPath = path.join(repoRoot, "graph.json");

    let data = null;
    if (!fs.existsSync(graphPath)) {
      console.log("[DEBUG] Graph file does not exist, building graph");
      try {
        data = await autobuildGraph(repoRoot);
      } catch (e) {
        console.log("[DEBUG] Graph build failed", e);
        return res.status(200).json({ nodes: [], edges: [], error: `graph build failed: ${e && e.message ? e.message : e}` });
      }
    }
    if (data == null) {
      data = JSON.parse(fs.readFileSync(graphPath, { encoding: "utf-8" }));
    }
    console.log("[DEBUG] Graph links:", data.Links);
    const links = data.Links;
    const rawNodes = Array.isArray(data.Nodes) ? data.Nodes : [];
    const labelToNode = new Map();
    try {
      rawNodes.forEach((n) => {
        if (!n || typeof n !== "object") return;
        const titleLc = String(n.title || "").trim().toLowerCase();
        if (titleLc) labelToNode.set(titleLc, n);
      });
    } catch (_) {}
    const nodesMap = new Map();
    // Pre-populate with all nodes so every node includes its body/tags in the response
    try {
      rawNodes.forEach((n) => {
        if (!n || typeof n !== "object") return;
        const label = String(n.title || "").trim();
        if (!label) return;
        const tags = String(n.tags || "").trim();
        const type = nodeTypeFrom(tags || "");
        const id = `${type.toLowerCase()}:${slugify(label)}`;
        if (nodesMap.has(id)) return;
        const nodeObj = { id, type, label };
        if (n.body != null) nodeObj.body = String(n.body);
        if (tags) nodeObj.tags = String(tags);
        nodesMap.set(id, nodeObj);
      });
    } catch (_) {}
    const edges = [];

    links.forEach((link, idx) => {
      const srcLabel = String(link.source || "").trim();
      const tgtLabel = String(link.target || "").trim();
      if (!srcLabel || !tgtLabel) return;
      const srcTypeRaw = String(link.source_type || link.sourceType || "").trim();
      const tgtTypeRaw = String(link.target_type || link.targetType || "").trim();
      const srcType = nodeTypeFrom(srcTypeRaw);
      const tgtType = nodeTypeFrom(tgtTypeRaw);
      const srcId = `${srcType.toLowerCase()}:${slugify(srcLabel)}`;
      const tgtId = `${tgtType.toLowerCase()}:${slugify(tgtLabel)}`;
      if (!nodesMap.has(srcId)) {
        const info = labelToNode.get(srcLabel.toLowerCase());
        const nodeObj = { id: srcId, type: srcType, label: srcLabel };
        if (info && info.body) nodeObj.body = String(info.body);
        if (info && info.tags) nodeObj.tags = String(info.tags);
        nodesMap.set(srcId, nodeObj);
      }
      if (!nodesMap.has(tgtId)) {
        const info = labelToNode.get(tgtLabel.toLowerCase());
        const nodeObj = { id: tgtId, type: tgtType, label: tgtLabel };
        if (info && info.body) nodeObj.body = String(info.body);
        if (info && info.tags) nodeObj.tags = String(info.tags);
        nodesMap.set(tgtId, nodeObj);
      }
      const edgeType = edgeTypeFrom(srcTypeRaw, tgtTypeRaw);
      const rawVal = link.value != null ? link.value : link.confidence;
      let confidence = Number(rawVal);
      if (!isFinite(confidence)) confidence = 0.8;
      if (confidence < 0) confidence = 0;
      if (confidence > 1) confidence = 1;
      const description = String(link.description || "").trim();
      const edgeObj = { id: `edge-${idx}`, source: srcId, target: tgtId, type: edgeType, confidence };
      if (description) edgeObj.description = description;
      edges.push(edgeObj);
    });

    return res.status(200).json({ nodes: Array.from(nodesMap.values()), edges });
  } catch (err) {
    return res.status(500).json({ nodes: [], edges: [], error: String(err && err.message ? err.message : err) });
  }
});

// ---------------- Build graph from provided nodes (Supabase-powered flow) ----------------
function normalizeNodeArray(maybeNodes) {
  const out = [];
  const seen = new Set();
  (Array.isArray(maybeNodes) ? maybeNodes : []).forEach((n) => {
    if (!n || typeof n !== "object") return;
    const title = String(n.title || n.label || "").trim();
    if (!title) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const body = String(n.body || n.description || "").trim();
    const tags = String(n.tags || n.type || "").trim();
    out.push({ title, body, tags });
  });
  return out;
}

async function generateLinksFromNodes({ repoRootDir, diagNodes, labNodes, medNodes }) {
  const thisDir = __dirname;
  const promptsDir = path.join(thisDir, "prompts");
  const linkerPrompt = tryResolvePrompt(promptsDir, repoRootDir, "linker_prompt.txt");

  let links = [];
  try {
    const tmpl = readText(linkerPrompt);
    const reasoningPreamble = [
      "You are an expert clinical knowledge graph builder.",
      "Think step-by-step. Infer clinically plausible relationships, but avoid hallucination.",
      "Prefer high-recall edges that are still clinically reasonable.",
      "Return strictly valid JSON with a top-level object containing 'Links'.",
      "Do not include any free text outside the JSON.",
    ].join("\n");
    const filled = `${reasoningPreamble}\n\n${tmpl}`
      .replace("<PATIENT_DIAGNOSES>", JSON.stringify(diagNodes, null, 2))
      .replace("<PATIENT_LABS>", JSON.stringify(labNodes, null, 2))
      .replace("<PATIENT_MEDICATIONS>", JSON.stringify(medNodes, null, 2));
    try {
      const promptOutPath = path.join(repoRootDir, "linker.txt");
      fs.writeFileSync(promptOutPath, filled, { encoding: "utf-8" });
    } catch (_) {}
    const { content } = await generateCompletionForLinks({ promptText: filled });
    try {
      const respOutPath = path.join(repoRootDir, "linker_response.txt");
      fs.writeFileSync(respOutPath, String(content != null ? content : ""), { encoding: "utf-8" });
    } catch (_) {}
    const data = safeJsonLoads(content);
    links = data && data.Links ? data.Links : [];
  } catch (err) {
    console.error("[DEBUG] Links generation error:", err);
    links = [];
  }

  // Normalize links
  try {
    const toTitleSet = (arr) => new Set((arr || []).map((n) => String(n && n.title ? n.title : "").trim().toLowerCase()).filter(Boolean));
    const diagSet = toTitleSet(diagNodes);
    const labSet = toTitleSet(labNodes);
    const medSet = toTitleSet(medNodes);
    const normType = (raw, labelLc) => {
      const t = String(raw || "").trim().toLowerCase();
      if (t) return t;
      if (diagSet.has(labelLc)) return "diagnosis";
      if (labSet.has(labelLc)) return "lab";
      if (medSet.has(labelLc)) return "medication";
      return "";
    };
    const clamp01 = (x) => {
      const n = Number(x);
      if (!isFinite(n)) return null;
      if (n < 0) return 0;
      if (n > 1) return 1;
      return n;
    };
    links = (links || []).filter((l) => l && typeof l === "object").map((l) => {
      const srcLabel = String(l.source || "").trim();
      const tgtLabel = String(l.target || "").trim();
      const srcLabelLc = srcLabel.toLowerCase();
      const tgtLabelLc = tgtLabel.toLowerCase();
      const srcType = normType(l.source_type || l.sourceType, srcLabelLc);
      const tgtType = normType(l.target_type || l.targetType, tgtLabelLc);
      const valueNum = clamp01(l.value != null ? l.value : l.confidence);
      const desc = String(l.description || "").trim();
      const out = {
        source: srcLabel,
        source_type: srcType,
        target: tgtLabel,
        target_type: tgtType,
        description: desc,
      };
      if (valueNum != null) out.value = valueNum;
      return out;
    });
  } catch (_) {}

  return links;
}

app.post("/graph/build", async (req, res) => {
  try {
    const body = req.body || {};
    const repoRoot = path.resolve(__dirname, "..", "..");

    const diagNodes = normalizeNodeArray(body.diagnoses || body.diag || body.conditions);
    const labNodes = normalizeNodeArray(body.labs || body.lab_tests || body.labTests);
    const medNodes = normalizeNodeArray(body.medications || body.meds || body.drugs);

    if (diagNodes.length === 0 && labNodes.length === 0 && medNodes.length === 0) {
      return res.status(400).json({ error: "No nodes provided. Include 'diagnoses', 'labs', or 'medications'." });
    }

    const links = await generateLinksFromNodes({ repoRootDir: repoRoot, diagNodes, labNodes, medNodes });
    const graphObj = { Nodes: [...diagNodes, ...labNodes, ...medNodes], Links: links };

    if (body.save === true || body.save_graph === true) {
      try {
        const graphPath = path.join(repoRoot, "graph.json");
        fs.writeFileSync(graphPath, JSON.stringify(graphObj, null, 2), { encoding: "utf-8" });
      } catch (_) {}
    }

    return res.status(200).json(graphObj);
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

// ---------------- Graph RAG (Neo4j + LLM) endpoint ----------------
function resolveNeo4jCreds() {
  const uriEnv = process.env.NEO4J_URI || "bolt://localhost:7687";
  let user = process.env.NEO4J_USER || "neo4j";
  let password = process.env.NEO4J_PASSWORD || "";
  if (!password && process.env.NEO4J_AUTH) {
    const auth = String(process.env.NEO4J_AUTH);
    const sep = auth.includes(":") ? ":" : "/";
    const parts = auth.split(sep);
    if (parts.length >= 2) {
      if (!user) user = parts[0];
      password = parts.slice(1).join(sep);
    }
  }
  if (!password) {
    const m = uriEnv.match(/^bolt:\/\/([^:@]+):([^@]+)@(.+)$/);
    if (m) {
      user = m[1];
      password = m[2];
    }
  }
  // Strip credentials from URI if present
  const sanitizedUri = uriEnv.replace(/^bolt:\/\/[^@]+@/, "bolt://");
  return { uri: sanitizedUri, user, password };
}

app.post("/graph-rag", async (req, res) => {
  try {
    const body = req.body || {};
    const question = String(body.question || body.query || "").trim();
    if (!question) return res.status(400).json({ error: "Missing 'question' in request body." });
    const topK = Number(body.top_k != null ? body.top_k : 6);
    const neighborK = Number(body.neighbor_k != null ? body.neighbor_k : 4);
    const includeTypes = Array.isArray(body.include_types) ? body.include_types : null;

    const { uri, user, password } = resolveNeo4jCreds();
    if (!user || !password) return res.status(400).json({ error: "Neo4j credentials not provided. Set NEO4J_USER/NEO4J_PASSWORD or NEO4J_AUTH." });

    const { topNodes, neighborRows, context } = await queryGraphContext({
      uri,
      user,
      password,
      question,
      topK,
      neighborK,
      includeTypes,
    });

    const systemPrompt = "You are a clinical assistant. Use the provided graph context consisting of relevant nodes and their relationships to answer the question accurately. Cite node titles when applicable.";
    const userContent = `Question:\n${question}\n\nGraph Context:\n${context}\n\nAnswer concisely.`;
    const { content, modelUsed } = await generateCompletionLM({ promptText: [systemPrompt, userContent].join("\n\n") });

    return res.status(200).json({
      question,
      answer: content,
      model: modelUsed,
      context,
      top_nodes: topNodes,
      neighbors: neighborRows,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[JS] server.cjs listening on http://${HOST}:${PORT}`);
});


