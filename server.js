const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 10000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  });
  res.end(body);
}

function safeFilePath(requestPath) {
  const clean = decodeURIComponent(requestPath.split("?")[0]);
  const relative = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const full = path.resolve(ROOT, relative);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  try {
    const pathname = url.parse(req.url).pathname || "/";

    if (req.method !== "GET" && req.method !== "HEAD") {
      return send(res, 405, "Method Not Allowed");
    }

    const file = safeFilePath(pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return send(res, 404, "Not Found");
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const data = fs.readFileSync(file);

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": data.length,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
    });
    if (req.method === "HEAD") return res.end();
    res.end(data);
  } catch (err) {
    console.error(err);
    send(res, 500, "Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`UDC stable server running on port ${PORT}`);
});
