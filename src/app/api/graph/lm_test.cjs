const express = require("express");
const { parse } = require("csv-parse/sync");
// Support both CJS and ESM default export shapes
const CerebrasImport = require("@cerebras/cerebras_cloud_sdk");
const Cerebras = CerebrasImport && CerebrasImport.default ? CerebrasImport.default : CerebrasImport;

// ---------------- Config (Cerebras) ----------------
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 5000);

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || process.env.OPENAI_API_KEY || "";
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || process.env.MODEL || "gpt-oss-120b";
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || 0.5);
const DEFAULT_MAX_TOKENS = Number(process.env.MAX_TOKENS || 4096);

const DEFAULT_CSV_DELIMITER = ",";
const DEFAULT_CSV_MAX_ROWS = 1000;
const DEFAULT_RAG_COLUMNS = "*";
const DEFAULT_RAG_MAX_CHARS = 4000;

if (!CEREBRAS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn("[lm_test.cjs] Warning: CEREBRAS_API_KEY not set; requests will fail.");
}

const client = new Cerebras({
  apiKey: CEREBRAS_API_KEY,
  // baseURL is optional for the SDK; it defaults to Cerebras cloud API
});

// ---------------- CSV helpers (ported from Python) ----------------
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

function buildCsvContextFromText(csvText, delimiter, csvMaxRows, ragColumns, ragMaxChars) {
  const { header, rows } = loadCsvHeadRowsFromText(csvText, delimiter, Math.max(1, csvMaxRows));
  return buildCsvContextFromComponents(header, rows, ragColumns, ragMaxChars);
}

async function generateCompletion({ promptText, model, temperature, maxTokens }) {
  if (!CEREBRAS_API_KEY) throw new Error("Missing CEREBRAS_API_KEY env var");
  const modelName = model || CEREBRAS_MODEL;
  const temp = typeof temperature === "number" ? temperature : DEFAULT_TEMPERATURE;
  const maxTok = typeof maxTokens === "number" ? maxTokens : DEFAULT_MAX_TOKENS;
  const promptStr = String(promptText || "");
  try {
    const prev = promptStr.slice(0, 200).replace(/\n/g, " ");
    console.log(`[LM][Cerebras SDK] Request model=${modelName} temp=${temp} max_tokens=${maxTok} prompt_chars=${promptStr.length} preview=${prev}`);
  } catch {}
  let content = null;
  let response = null;
  try {
    response = await client.chat.completions.create({
      messages: [{ role: "user", content: promptStr }],
      model: modelName,
      temperature: temp,
      max_tokens: maxTok,
    });
    content = response && response.choices && response.choices[0] && response.choices[0].message
      ? response.choices[0].message.content
      : null;
    if (content) return { content, modelUsed: response.model || modelName };
  } catch (err) {
    const status = err && err.status ? err.status : undefined;
    try { console.warn(`[LM][Cerebras SDK] chat.completions failed${status ? ` (status ${status})` : ""}:`, err && err.message ? err.message : err); } catch {}
    try {
      const resp = await client.responses.create({
        model: modelName,
        input: promptStr,
        temperature: temp,
        max_output_tokens: maxTok,
      });
      if (resp && typeof resp.output_text === "string" && resp.output_text.length > 0) {
        return { content: resp.output_text, modelUsed: resp.model || modelName };
      }
      if (resp && Array.isArray(resp.output) && resp.output[0] && Array.isArray(resp.output[0].content) && resp.output[0].content[0] && typeof resp.output[0].content[0].text === "string") {
        return { content: resp.output[0].content[0].text, modelUsed: resp.model || modelName };
      }
    } catch (err2) {
      const status2 = err2 && err2.status ? err2.status : undefined;
      try { console.warn(`[LM][Cerebras SDK] responses.create failed${status2 ? ` (status ${status2})` : ""}:`, err2 && err2.message ? err2.message : err2); } catch {}
    }
  }
  throw new Error("No content returned.");
}

// ---------------- Express app ----------------
const app = express();
app.use(express.json({ limit: "4mb" }));

// CORS to match Python server
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

app.post("/generate", async (req, res) => {
  try {
    const data = req.body || {};
    const promptText = data.prompt;
    if (!promptText) return res.status(400).json({ error: "Missing 'prompt' in JSON body." });

    const csvContent = data.csv_content;
    const csvDelimiter = data.csv_delimiter || DEFAULT_CSV_DELIMITER;
    const csvMaxRows = Number(data.csv_max_rows != null ? data.csv_max_rows : DEFAULT_CSV_MAX_ROWS);
    const ragColumns = data.rag_columns || DEFAULT_RAG_COLUMNS;
    const ragMaxChars = Number(data.rag_max_chars != null ? data.rag_max_chars : DEFAULT_RAG_MAX_CHARS);

    let csvContext = null;
    if (csvContent) {
      try {
        csvContext = buildCsvContextFromText(csvContent, csvDelimiter, csvMaxRows, ragColumns, ragMaxChars);
      } catch (e) {
        return res.status(400).json({ error: `Failed to process CSV content: ${e && e.message ? e.message : e}` });
      }
    }

    const userContent = csvContext ? `${csvContext}${promptText}` : promptText;
    const { content, modelUsed } = await generateCompletion({ promptText: userContent });
    return res.status(200).json({ content, model: modelUsed });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[lm_test.cjs] Listening on http://${HOST}:${PORT}`);
});


