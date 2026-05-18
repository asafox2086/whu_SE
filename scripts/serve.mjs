import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("public");
const srcRoot = resolve("src");
const port = Number(process.env.PORT ?? 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8"
};

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const filePath = resolvePath(decodeURIComponent(url.pathname));

  if (!filePath) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`星轨平台 MVP running at http://localhost:${port}`);
});

function resolvePath(pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalized = normalize(relativePath);
  if (normalized.startsWith("..") || normalize(relativePath).startsWith("/")) {
    return null;
  }

  if (relativePath.startsWith("src/")) {
    const candidate = resolve(join(srcRoot, relativePath.slice("src/".length)));
    return candidate.startsWith(srcRoot) ? candidate : null;
  }

  const candidate = resolve(join(root, normalized));
  return candidate.startsWith(root) ? candidate : null;
}
