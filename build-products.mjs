import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = dirname(fileURLToPath(import.meta.url));
const siteUrl = new URL((process.env.FU7URE_SITE_URL || "https://arthurdnb.github.io/fu7ure-preview/").replace(/\/?$/, "/"));
const format = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const plainText = (text) => text.replaceAll("&amp;", "&");
const read = (name) => readFile(join(root, name), "utf8");
const [index, template, content] = await Promise.all([
  read("index.html"), read("product.html"), read("catalog-content.js"),
]);
const context = { window: {} };
runInNewContext(content, context, { filename: "catalog-content.js" });
const { details, products: concepts } = context.window.fu7ureCatalog;

const collections = index.split(/<section class="collection" id="([^"]+)"[^>]*>/g);
const groups = new Map();
const items = [];
for (let i = 1; i < collections.length; i += 2) {
  const [id, html] = collections.slice(i, i + 2);
  const style = plainText(html.match(/class="collection-name">([^<]+)<\/span>/)[1]);
  const [, mark, maker] = html.match(/<img src="(media\/marks\/[^"]+)" alt="([^"]+)"/);
  groups.set(id, { style, maker, mark });
  for (const [, image, key, name, price] of html.matchAll(/<img src="(media\/merch\/([\w-]+)\.webp)" alt="([^"]+)"[^>]*>\s*<div class="product-caption">\s*<h[45]>[^<]+<\/h[45]>\s*<data class="product-price" value="([\d.]+)">/g)) {
    items.push({ key, collection: id, image, name: plainText(name), price: Number(price), ...details[key] });
  }
}
items.push(...concepts);
if (items.length !== Object.keys(details).length + concepts.length || new Set(items.map(({ key }) => key)).size !== items.length) {
  throw new Error("The catalog and its product keys are out of sync.");
}

const absolute = (path) => new URL(path, siteUrl).href;
const pages = new Map();
for (const item of items) {
  const group = groups.get(item.collection);
  if (!group || !item.description || !item.materials || !item.care || !item.fit || !/^[a-z0-9-]+$/.test(item.key)) {
    throw new Error("Missing catalog data for " + item.key);
  }
  for (const asset of [item.image, group.mark]) {
    await access(resolve(root, asset));
  }
  const path = "products/" + item.key + ".html";
  const url = absolute(path);
  const imageUrl = absolute(item.image);
  const title = item.name + " · FU7URE";
  const description = item.description;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description,
    image: imageUrl,
    url,
    brand: { "@type": "Brand", name: group.maker, logo: absolute(group.mark) },
    category: group.style,
  }).replaceAll("<", "\\u003c");
  const meta = [
    '<base href="../">',
    '<title>' + escapeHtml(title) + '</title>',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<link rel="canonical" href="' + escapeHtml(url) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:url" content="' + escapeHtml(url) + '">',
    '<meta property="og:image" content="' + escapeHtml(imageUrl) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<script type="application/ld+json">' + structuredData + '</script>',
  ].join("\n  ");
  const fallback = [
    '<div class="product-static" id="product-static">',
    '  <img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '" width="512" height="512">',
    '  <div>',
    '    <p>' + escapeHtml(group.style) + ' by ' + escapeHtml(group.maker) + '</p>',
    '    <h1>' + escapeHtml(item.name) + '</h1>',
    '    <p>A$' + format.format(item.price) + ' · Sample price</p>',
    '    <p>' + escapeHtml(description) + '</p>',
    '    <a class="editorial-link" href="./#' + escapeHtml(item.collection) + '">Browse collection</a>',
    '  </div>',
    '</div>',
  ].join("\n    ");
  const page = template
    .replace("<title>Product · FU7URE</title>", () => meta)
    .replace('href="#product-page"', 'href="' + path + '#product-page"')
    .replace('id="product-page" tabindex="-1"', 'id="product-page" data-product-key="' + item.key + '" tabindex="-1"')
    .replace('id="product-back" href="./#merchandise"', 'id="product-back" href="./#' + item.collection + '"')
    .replace('id="product-back-label">Shop', 'id="product-back-label">' + escapeHtml(group.style))
    .replace('<p id="product-message" role="status">Loading product…</p>', '<p id="product-message" role="status" hidden></p>\n    ' + fallback);
  pages.set(path, page);
}

const urls = ["", "preview-policy.html", ...pages.keys()].map((path) =>
  "  <url><loc>" + escapeHtml(absolute(path)) + "</loc></url>");
pages.set("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join("\n") + "\n</urlset>\n");
pages.set("robots.txt", "User-agent: *\nAllow: /\nSitemap: " + absolute("sitemap.xml") + "\n");

if (process.argv.includes("--check")) {
  for (const [path, expected] of pages) {
    if (await read(path) !== expected) throw new Error("Stale generated page or sitemap: " + path);
  }
  console.log("Verified " + items.length + " product pages and the sitemap.");
} else {
  await mkdir(join(root, "products"), { recursive: true });
  await Promise.all([...pages].map(([path, page]) => writeFile(join(root, path), page)));
  console.log("Generated " + items.length + " product pages and the sitemap.");
}
