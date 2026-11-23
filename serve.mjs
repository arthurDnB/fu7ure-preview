import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 8772);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
const baseHeaders = { "Cache-Control": "no-cache", "Accept-Ranges": "bytes" };

function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const suffix = !match[1];
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = suffix || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]));
  return start <= end && start < size ? { start, end } : null;
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const { pathname } = new URL(request.url, "http://localhost");
    const file = resolve(root, "." + (pathname === "/" ? "/index.html" : decodeURIComponent(pathname)));
    const contentType = mimeTypes[extname(file).toLowerCase()];
    if (!file.startsWith(root + sep) || !contentType) {
      response.writeHead(404).end();
      return;
    }
    const metadata = await stat(file);
    if (!metadata.isFile()) {
      response.writeHead(404).end();
      return;
    }
    const range = request.headers.range ? byteRange(request.headers.range, metadata.size) : null;
    if (request.headers.range && !range) {
      response.writeHead(416, { ...baseHeaders, "Content-Range": "bytes */" + metadata.size }).end();
      return;
    }
    const headers = { ...baseHeaders, "Content-Type": contentType, "Content-Length": metadata.size };
    if (range) {
      headers["Content-Range"] = "bytes " + range.start + "-" + range.end + "/" + metadata.size;
      headers["Content-Length"] = range.end - range.start + 1;
    }
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    const stream = createReadStream(file, range ?? {});
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("FU7URE preview: http://localhost:" + port + "/");
});
