import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { loadEnv, openWaitlist, root } from "./db.js";

loadEnv();

const landing = join(root, "landing");
const port = Number(process.env.PORT) || 8787;
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const hits = new Map();
const trustProxy = process.env.TRUST_PROXY === "1";

// Behind a hosting proxy every request shares the proxy's IP; the proxy appends the real client last.
function clientIp(req) {
  const forwarded = trustProxy && String(req.headers["x-forwarded-for"] || "").split(",").pop().trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 8) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024) throw new Error("too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function serveFile(res, urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const file = normalize(join(landing, requested));
  if (file !== landing && !file.startsWith(landing + sep)) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const waitlist = openWaitlist();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/waitlist" && req.method === "POST") {
    const ip = clientIp(req);
    if (limited(ip)) {
      send(res, 429, { ok: false });
      return;
    }
    let email;
    try {
      const body = await readJson(req);
      email = String(body.email || "").trim().toLowerCase();
    } catch {
      send(res, 400, { ok: false });
      return;
    }
    if (!isEmail(email)) {
      send(res, 400, { ok: false });
      return;
    }
    try {
      await waitlist.add(email);
      send(res, 200, { ok: true });
    } catch (error) {
      console.error(error.message);
      send(res, 502, { ok: false });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveFile(res, decodeURIComponent(url.pathname));
    return;
  }

  send(res, 405, { ok: false });
});

server.listen(port, () => {
  console.log(`Millow is running at http://localhost:${port}`);
});
