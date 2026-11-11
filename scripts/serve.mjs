import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml", ".pdf":"application/pdf" };
const server = http.createServer((req,res) => {
  let decoded;
  try { decoded = decodeURIComponent(new URL(req.url, "http://localhost").pathname); } catch { res.writeHead(400).end(); return; }
  const relative = decoded === "/" ? "index.html" : decoded.slice(1);
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || relative.split(/[\\/]/).some(p=>p.startsWith(".")) || ![".html",".js",".css",".png",".svg",".pdf"].includes(path.extname(file))) { res.writeHead(404).end(); return; }
  fs.readFile(file, (err, bytes) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, {"Content-Type":types[path.extname(file)], "Cache-Control":"no-store"}); res.end(bytes); });
});
const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => console.log("Local: http://127.0.0.1:" + port));
