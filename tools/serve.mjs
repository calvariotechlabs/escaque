// Servidor estático mínimo para probar la web en local, sin dependencias.
// Uso: npm run serve   (compila y sirve la carpeta del repositorio en http://127.0.0.1:8080)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? 8080);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = normalize(join(root, path));
    // Nunca servir nada fuera del repositorio ni la carpeta .git.
    if (!file.startsWith(root + sep) || file.includes(`${sep}.git${sep}`) || file.includes(`${sep}node_modules${sep}`)) {
      res.writeHead(403).end("Prohibido");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
}).listen(port, "127.0.0.1", () => console.log(`Escaque en http://127.0.0.1:${port}`));
