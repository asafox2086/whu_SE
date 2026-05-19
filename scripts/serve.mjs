import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { createInitialState } from "../src/domain.mjs";
import {
  createLocalDatabase,
  localStateExists,
  readLocalState,
  writeLocalState
} from "../src/local-database.mjs";

const root = resolve("public");
const srcRoot = resolve("src");
const port = Number(process.env.PORT ?? 4173);
const database = createLocalDatabase({ seedState: createInitialState() });

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    sendJson(response, 500, { error: "本地服务处理失败" });
  });
}).listen(port, () => {
  console.log(`星轨平台 MVP running at http://localhost:${port}`);
  console.log(`本地数据库文件: ${database.filePath}`);
});

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/state") {
    await handleStateApi(request, response);
    return;
  }

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
}

async function handleStateApi(request, response) {
  if (request.method === "GET") {
    const hasLocalState = await localStateExists(database);
    const state = await readLocalState(database);
    sendJson(response, 200, {
      state,
      source: hasLocalState ? "file" : "seed",
      filePath: database.filePath
    });
    return;
  }

  if (request.method === "PUT") {
    const state = await readJsonBody(request);
    await writeLocalState(database, state);
    sendJson(response, 200, {
      ok: true,
      filePath: database.filePath
    });
    return;
  }

  response.writeHead(405, { Allow: "GET, PUT" });
  response.end("Method not allowed");
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        request.destroy(new Error("请求数据过大"));
      }
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(body || "{}"));
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on("error", rejectBody);
  });
}

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
