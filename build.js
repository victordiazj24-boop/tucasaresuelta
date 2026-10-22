#!/usr/bin/env node
// Genera la web estática de Casa Resuelta a partir de data/*.json.
// Uso: node build.js   →  crea la carpeta dist/ lista para subir.
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));

const cfg = read("config.json");
const cats = read("categorias.json");
const probs = read("problemas.json");
const guias = read("guias.json");
const prods = read("productos.json").sort((a, b) => a.numero - b.numero);

// ---------- comprobaciones para evitar errores al añadir productos ----------
const errors = [];
const seenNum = new Set(), seenSlug = new Set();
for (const p of prods) {
  for (const k of ["numero", "slug", "nombre", "categoria", "resumen", "enlace"]) if (!p[k]) errors.push(`Producto ${p.nombre || p.slug || "?"}: falta "${k}"`);
  if (seenNum.has(p.numero)) errors.push(`Número repetido: ${p.numero}`);
  if (seenSlug.has(p.slug)) errors.push(`Slug repetido: ${p.slug}`);
  seenNum.add(p.numero); seenSlug.add(p.slug);
  if (!cats.find((c) => c.slug === p.categoria)) errors.push(`${p.nombre}: categoría desconocida "${p.categoria}"`);
  for (const pr of p.problemas || []) if (!probs.find((x) => x.slug === pr)) errors.push(`${p.nombre}: problema desconocido "${pr}"`);
}
if (errors.length) { console.error("No se ha generado la web:\n - " + errors.join("\n - ")); process.exit(1); }

// ---------- utilidades ----------
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num2 = (n) => String(n).padStart(2, "0");
const catOf = (slug) => cats.find((c) => c.slug === slug);
const probName = (slug) => (probs.find((x) => x.slug === slug) || {}).nombre || slug;
const byNum = (n) => prods.find((p) => p.numero === n);
const year = new Date().getFullYear();

// Añade el tag de afiliado a enlaces de amazon.es/.com. Los enlaces cortos (link.amazon, amzn.to) ya lo llevan.
function amazonUrl(p) {
  let url = p.enlace;
  if (!url && p.asin) url = `https://${cfg.amazonDominio}/dp/${p.asin}`;
  try {
    const u = new URL(url);
    if (/(^|\.)amazon\./.test(u.hostname) && cfg.amazonTag && !u.searchParams.get("tag")) u.searchParams.set("tag", cfg.amazonTag);
    return u.toString();
  } catch { return url; }
}

const ICONS = {
  cocina: '<path d="M6 13h36v6a14 14 0 0 1-14 14h-8A14 14 0 0 1 6 19v-6z"/><path d="M42 16h4M14 7v2M24 5v4M34 7v2"/><path d="M14 37h20"/>',
  limpieza: '<path d="M30 4 18 30"/><path d="M12 30h14l4 14H8l4-14z"/><path d="M14 36v8M20 36v8M26 36v8"/><path d="M38 12l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/>',
  aire: '<path d="M6 16h22a6 6 0 1 0-6-6"/><path d="M6 26h32a6 6 0 1 1-6 6"/><path d="M6 36h14"/>',
  orden: '<rect x="6" y="8" width="36" height="12" rx="2"/><rect x="6" y="28" width="16" height="12" rx="2"/><rect x="26" y="28" width="16" height="12" rx="2"/><path d="M20 14h8"/>',
  inteligente: '<rect x="12" y="6" width="24" height="36" rx="6"/><circle cx="20" cy="20" r="2"/><circle cx="28" cy="20" r="2"/><path d="M24 30v6"/><path d="M4 18a20 20 0 0 1 0 12M44 18a20 20 0 0 1 0 12"/>',
  seguridad: '<path d="M24 4 8 10v12c0 10 7 18 16 22 9-4 16-12 16-22V10L24 4z"/><path d="m17 24 5 5 9-10"/>',
};
const icon = (name) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.orden}</svg>`;
const SVG = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="m9 15 2 2 4-4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5C19 15.6 12 20 12 20z"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
};

function visual(p, base, eager) {
  const c = catOf(p.categoria);
  // "imagen" acepta una URL, una ruta en assets/img/ o el código HTML completo que da SiteStripe
  const src = p.imagen ? ((p.imagen.match(/src=["']([^"']+)["']/) || [])[1] || p.imagen) : "";
  const img = src
    ? `<img src="${esc(/^https?:/.test(src) ? src : base + src)}" alt="${esc(p.nombre)}" ${eager ? "" : 'loading="lazy"'}>${p.imagenIlustrativa ? '<span class="ilus">Imagen ilustrativa</span>' : ""}`
    : icon(c.icono);
  return `<div class="card-visual">${img}<span class="tag" title="Número del producto en los vídeos">Nº ${num2(p.numero)}</span></div>`;
}
const buyBtn = (p, cls = "", label = "Ver precio en Amazon") =>
  `<a class="btn btn-amazon ${cls}" href="${esc(amazonUrl(p))}" target="_blank" rel="sponsored nofollow noopener" data-buy="${p.numero}">${label} ${SVG.out}</a>`;

function card(p, base) {
  const c = catOf(p.categoria);
  const url = `${base}producto/${p.slug}.html`;
  return `<article class="card" data-num="${p.numero}" data-cat="${p.categoria}" data-prob="${(p.problemas || []).join(" ")}" data-name="${esc((p.nombre + " " + p.marca + " " + p.resumen).toLowerCase())}" data-date="${p.fecha || ""}" data-dest="${p.destacado ? 1 : 0}">
  ${visual(p, base)}
  <button class="fav" type="button" aria-pressed="false" aria-label="Guardar ${esc(p.nombre)} en favoritos" data-fav="${p.numero}">${SVG.heart}</button>
  <div class="card-body">
    <span class="card-cat">${esc(c.nombre)}</span>
    <h3><a href="${url}">${esc(p.nombre)}</a></h3>
    <p class="card-sum">${esc(p.resumen)}</p>
    <div class="solves">${(p.problemas || []).map((x) => `<span>${esc(probName(x))}</span>`).join("")}</div>
  </div>
  <div class="card-actions">${buyBtn(p, "", "Ver en Amazon")}<a class="btn btn-ghost" href="${url}">Ficha</a></div>
  <label class="cmp"><input type="checkbox" data-cmp="${p.numero}"> Comparar</label>
</article>`;
}

function layout({ title, description, base, canonical, body, current = "", jsonld, noindex, preview, image, type = "website", fullTitle: ft }) {
  const fullTitle = ft || (title === cfg.nombre ? `${cfg.nombre} · ${cfg.eslogan}` : `${title} · ${cfg.nombre}`);
  const ogImage = image ? (/^https?:/.test(image) ? image : `${cfg.dominio}/${image}`) : `${cfg.dominio}/assets/img/compartir.jpg`;
  const navItem = (href, label, key, cls = "") => `<a class="${cls}" href="${base}${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const head = `<title>${esc(preview ? cfg.nombre : fullTitle)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${cfg.dominio}/${canonical}">`}
<meta property="og:type" content="${type}">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="${esc(cfg.nombre)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${cfg.dominio}/${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#c2410c">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap">
<link rel="stylesheet" href="${base}assets/style.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}`;
  const content = `<a class="skip" href="#main">Saltar al contenido</a>
<header class="top"><div class="wrap">
  <a class="logo" href="${base}index.html"><span class="logo-mark">${SVG.home}</span>${esc(cfg.nombre)}</a>
  <nav class="nav" aria-label="Principal">
    ${navItem("index.html#catalogo", "Productos", "home")}
    ${cats.map((c) => navItem(`categoria/${c.slug}.html`, c.nombre, "cat-" + c.slug)).join("")}
    ${navItem("guias.html", "Guías", "guias")}
    ${navItem("videos.html", "Vistos en vídeo", "videos", "nav-video")}
  </nav>
</div></header>
<main id="main">
${body}
</main>
<footer class="foot"><div class="wrap">
  <p class="disclosure">${esc(cfg.aviso)} Los precios y la disponibilidad pueden cambiar; el precio válido es el que ves en Amazon en el momento de la compra.</p>
  <nav aria-label="Pie">
    <a href="${base}index.html">Inicio</a><a href="${base}guias.html">Guías</a><a href="${base}videos.html">Vistos en vídeo</a><a href="${base}aviso-legal.html">Aviso legal y privacidad</a>
    ${cfg.redes.tiktok ? `<a href="${esc(cfg.redes.tiktok)}" rel="noopener" target="_blank">TikTok</a>` : ""}
    ${cfg.redes.youtube ? `<a href="${esc(cfg.redes.youtube)}" rel="noopener" target="_blank">YouTube</a>` : ""}
    ${cfg.redes.instagram ? `<a href="${esc(cfg.redes.instagram)}" rel="noopener" target="_blank">Instagram</a>` : ""}
  </nav>
  <p>© ${year} ${esc(cfg.nombre)} · tucasaresuelta.com</p>
</div></footer>
<script>window.CR_PRODUCTS=${JSON.stringify(prods.map((p) => ({ n: p.numero, s: p.slug, t: p.nombre, c: catOf(p.categoria).nombre, r: p.resumen, i: p.idealPara, pr: p.pros, co: p.contras, pb: (p.problemas || []).map(probName), u: amazonUrl(p) })))};window.CR_BASE=${JSON.stringify(base)};</script>
<script src="${base}assets/app.js" defer></script>`;
  if (preview) return head + "\n" + content; // la vista previa la envuelve el visor
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
${head}
</head>
<body>
${content}
</body>
</html>`;
}

// ---------- páginas ----------
const pages = [];
const redirects = []; // direcciones antiguas de productos que se renombraron
const add = (file, html) => pages.push([file, html]);

function homeBody(base) {
  const featured = prods.filter((p) => p.destacado);
  return `<section class="hero"><div class="wrap hero-grid">
  <div>
    <p class="eyebrow">${prods.length} productos · ${cats.length} categorías · actualizado ${new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>
    <h1>Lo que de verdad te <em>resuelve</em> la casa</h1>
    <p class="hero-lead">${esc(cfg.descripcion)} Elige tu problema y te enseñamos qué funciona.</p>
  </div>
  <form class="numcard" id="numform" action="videos.html">
    <label for="numinput">¿Lo has visto en un vídeo?</label>
    <p class="numhint">Escribe el número que sale en el TikTok o el Short.</p>
    <div class="numrow"><input id="numinput" name="n" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="Nº 07" autocomplete="off"><button type="submit">Ir</button></div>
    <p class="numresult" id="numresult" aria-live="polite"></p>
  </form>
</div></section>

<section class="problems"><div class="wrap">
  <h2>¿Qué quieres resolver?</h2>
  <div class="chips" id="probchips" role="group" aria-label="Filtrar por problema">
    ${probs.filter((x) => prods.some((p) => p.problemas.includes(x.slug))).map((x) => `<button class="chip" type="button" aria-pressed="false" data-prob="${x.slug}">${esc(x.nombre)}<span class="count">${prods.filter((p) => p.problemas.includes(x.slug)).length}</span></button>`).join("\n    ")}
  </div>
</div></section>

<section class="catalog" id="catalogo"><div class="wrap">
  <div class="toolbar">
    <label class="search">${SVG.search}<span class="skip">Buscar</span><input id="q" type="search" placeholder="Busca: freidora, moho, cristales…" autocomplete="off"></label>
    <select class="select" id="sort" aria-label="Ordenar">
      <option value="dest">Destacados primero</option>
      <option value="new">Más nuevos</option>
      <option value="num">Por número</option>
      <option value="az">A–Z</option>
    </select>
    <button class="toggle" type="button" id="onlyfav" aria-pressed="false">♥ Mis favoritos <span id="favcount"></span></button>
  </div>
  <div class="chips catchips" id="catchips" role="group" aria-label="Filtrar por categoría">
    <button class="chip" type="button" aria-pressed="true" data-cat="">Todo</button>
    ${cats.map((c) => `<button class="chip" type="button" aria-pressed="false" data-cat="${c.slug}">${esc(c.nombre)}</button>`).join("\n    ")}
  </div>
  <p class="result-line" id="resultline" aria-live="polite">${prods.length} productos</p>
  <div class="grid" id="grid">
${prods.map((p) => card(p, base)).join("\n")}
  </div>
  <p class="empty" id="empty" hidden>No hay productos con esos filtros. <button class="link" type="button" data-reset>Quitar filtros</button></p>
</div></section>

<section class="band"><div class="wrap">
  <div class="band-head"><div><p class="eyebrow">Guías</p><h2>Listas para decidir rápido</h2></div><a href="${base}guias.html">Ver todas las guías</a></div>
  <div class="guides">${guias.map((g) => guideCard(g, base)).join("")}</div>
</div></section>

<section class="band video-band"><div class="wrap">
  <p class="eyebrow">Shorts y TikTok</p>
  <h2>¿Vienes de un vídeo? Así encuentras el producto</h2>
  <ol class="steps">
    <li>En cada vídeo sale un número, por ejemplo <strong>Nº ${num2(featured[0]?.numero || 1)}</strong>.</li>
    <li>Pulsa el enlace del perfil o entra en tucasaresuelta.com.</li>
    <li>Escribe el número arriba o búscalo en la lista de vídeos y pulsa "Ver precio en Amazon".</li>
  </ol>
  <a class="btn btn-big" href="${base}videos.html">Ir a la lista de vídeos</a>
</div></section>

<div class="tray" id="tray" aria-live="polite">
  <strong>Comparar</strong><div class="tray-items" id="trayitems"></div>
  <button class="btn" type="button" id="cmpopen">Comparar ahora</button><button class="link" type="button" id="cmpclear">Vaciar</button>
</div>
<dialog id="cmpdlg" aria-labelledby="cmptitle"><div class="dlg-head"><h2 id="cmptitle">Comparativa</h2><button class="dlg-close" type="button" data-close aria-label="Cerrar">×</button></div><div class="dlg-body" id="cmpbody"></div></dialog>`;
}

function guideCard(g, base) {
  return `<a class="guide" href="${base}${g.ruta}"><span class="nums">${g.productos.length} productos · ${g.productos.map((n) => "Nº " + num2(n)).slice(0, 4).join(", ")}${g.productos.length > 4 ? "…" : ""}</span><h3>${esc(g.titulo)}</h3><p class="muted">${esc(g.descripcion)}</p></a>`;
}

const crumbsLd = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${cfg.dominio}/${url}` })) });
const itemList = (list, name) => ({
  "@context": "https://schema.org", "@type": "ItemList", name,
  itemListElement: list.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${cfg.dominio}/producto/${p.slug}.html`, name: p.nombre })),
});

add("index.html", layout({ title: cfg.nombre, fullTitle: `${cfg.nombre} · Los mejores productos de Amazon para casa, explicados`, description: cfg.descripcion, base: "", canonical: "", current: "home", body: homeBody(""), jsonld: [{ "@context": "https://schema.org", "@type": "WebSite", name: cfg.nombre, url: cfg.dominio }, itemList(prods, "Productos para el hogar")] }));
add("preview.html", layout({ title: cfg.nombre, description: cfg.descripcion, base: "", canonical: "", current: "home", body: homeBody(""), preview: true, noindex: true }));

// Texto extra (secciones y preguntas frecuentes) para guías y categorías
function extra(o) {
  const secs = o.secciones || [], faq = o.faq || [];
  if (!secs.length && !faq.length) return "";
  return `<section class="band"><div class="wrap prose">
${secs.map((x) => `<h2>${esc(x.titulo)}</h2>${x.texto.split("\n\n").map((t) => `<p>${esc(t)}</p>`).join("")}`).join("\n")}
${faq.length ? `<h2>Preguntas frecuentes</h2>${faq.map((x) => `<h3>${esc(x.q)}</h3><p>${esc(x.a)}</p>`).join("")}` : ""}
</div></section>`;
}
const faqLd = (o) => (o.faq && o.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: o.faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }] : []);

// Fichas de producto
for (const p of prods) {
  const base = "../";
  const c = catOf(p.categoria);
  const related = prods.filter((x) => x !== p && (x.categoria === p.categoria || x.problemas.some((y) => p.problemas.includes(y)))).slice(0, 3);
  const inGuides = guias.filter((g) => g.productos.includes(p.numero));
  const body = `<div class="wrap">
  <p class="crumbs"><a href="${base}index.html">Inicio</a> / <a href="${base}categoria/${c.slug}.html">${esc(c.nombre)}</a> / ${esc(p.nombre)}</p>
  <div class="pd">
    <div class="pd-visual">${visual(p, base, true)}</div>
    <div class="pd-info">
      <p class="eyebrow">${esc(c.nombre)} · ${esc(p.marca || "")}</p>
      <h1>${esc(p.nombre)}</h1>
      <p class="pd-lead">${esc(p.resumen)}</p>
      <div class="solves">${p.problemas.map((x) => `<span>Resuelve: ${esc(probName(x))}</span>`).join("")}</div>
      <div class="pd-cta">${buyBtn(p, "btn-big")}<button class="fav" style="position:static" type="button" aria-pressed="false" aria-label="Guardar en favoritos" data-fav="${p.numero}">${SVG.heart}</button></div>
      <p class="pd-note">Te lleva a Amazon. Allí ves el precio de hoy, las opiniones y el envío.</p>
      <div class="prose"><h2>Por qué lo recomendamos</h2><p>${esc(p.porQue)}</p></div>
      <div class="proscons">
        <div class="pc-pro"><h3>Lo mejor</h3><ul>${(p.pros || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div class="pc-con"><h3>A tener en cuenta</h3><ul>${(p.contras || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>
      ${p.idealPara ? `<p class="ideal"><strong>Ideal para:</strong> ${esc(p.idealPara)}</p>` : ""}
      ${p.videos && (p.videos.tiktok || p.videos.youtube) ? `<div class="pd-cta">${p.videos.tiktok ? `<a class="btn btn-ghost" href="${esc(p.videos.tiktok)}" target="_blank" rel="noopener">Ver en TikTok</a>` : ""}${p.videos.youtube ? `<a class="btn btn-ghost" href="${esc(p.videos.youtube)}" target="_blank" rel="noopener">Ver en YouTube</a>` : ""}</div>` : ""}
      ${inGuides.length ? `<p class="muted">Aparece en: ${inGuides.map((g) => `<a href="${base}${g.ruta}">${esc(g.titulo)}</a>`).join(" · ")}</p>` : ""}
    </div>
  </div>
</div>
${related.length ? `<section class="band"><div class="wrap"><div class="band-head"><h2>También te puede interesar</h2></div><div class="grid">${related.map((x) => card(x, base)).join("")}</div></div></section>` : ""}`;
  const jsonld = { "@context": "https://schema.org", "@type": "Product", name: p.nombre, description: p.resumen, brand: { "@type": "Brand", name: p.marca }, category: c.nombre };
  if (p.imagen) jsonld.image = /^https?:/.test(p.imagen) ? p.imagen : `${cfg.dominio}/${p.imagen}`;
  const img = p.imagen && !/</.test(p.imagen) ? p.imagen : "";
  add(`producto/${p.slug}.html`, layout({ title: p.nombre, fullTitle: `${p.nombre}: opinión, ventajas y desventajas`, description: `${p.resumen} Lo mejor, lo que hay que tener en cuenta y para quién es.`, base, canonical: `producto/${p.slug}.html`, body, image: img, type: "article", jsonld: [jsonld, crumbsLd([["Inicio", ""], [c.nombre, `categoria/${c.slug}.html`], [p.nombre, `producto/${p.slug}.html`]])] }));
  for (const old of p.slugsAnteriores || []) {
    const to = `${p.slug}.html`;
    redirects.push([`producto/${old}.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(p.nombre)}</title><link rel="canonical" href="${cfg.dominio}/producto/${to}"><meta http-equiv="refresh" content="0; url=${to}"></head><body><a href="${to}">${esc(p.nombre)}</a></body></html>`]);
  }
}

// Categorías
for (const c of cats) {
  const base = "../";
  const list = prods.filter((p) => p.categoria === c.slug);
  const body = `<section class="hero"><div class="wrap"><p class="eyebrow">Categoría · ${list.length} productos</p><h1>${esc(c.titulo || c.nombre)}</h1><p class="hero-lead">${esc(c.intro)}</p></div></section>
<section class="catalog"><div class="wrap"><div class="grid">${list.map((p) => card(p, base)).join("\n")}</div>${list.length ? "" : '<p class="empty">Pronto habrá productos aquí.</p>'}</div></section>
${extra(c)}`;
  add(`categoria/${c.slug}.html`, layout({ title: c.titulo || `${c.nombre}: productos recomendados`, description: c.intro, base, canonical: `categoria/${c.slug}.html`, current: "cat-" + c.slug, body, jsonld: [itemList(list, c.nombre), crumbsLd([["Inicio", ""], [c.nombre, `categoria/${c.slug}.html`]]), ...faqLd(c)] }));
}

// Guías (incluye la entrada antigua del blog con su misma URL)
for (const g of guias) {
  const depth = g.ruta.split("/").length - 1;
  const base = "../".repeat(depth);
  const list = g.productos.map(byNum).filter(Boolean);
  const body = `<div class="wrap"><p class="crumbs"><a href="${base}index.html">Inicio</a> / <a href="${base}guias.html">Guías</a></p></div>
<section class="hero"><div class="wrap"><p class="eyebrow">Guía · ${new Date(g.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p><h1>${esc(g.titulo)}</h1><p class="hero-lead">${esc(g.intro)}</p></div></section>
<section class="catalog"><div class="wrap"><ol class="rank">
${list.map((p, i) => `<li class="rank-item">${visual(p, base)}<div class="body"><p class="eyebrow">Puesto ${i + 1} · ${esc(catOf(p.categoria).nombre)}</p><h2><a href="${base}producto/${p.slug}.html">${esc(p.nombre)}</a></h2><p>${esc(p.porQue)}</p>${p.idealPara ? `<p class="muted"><strong>Ideal para:</strong> ${esc(p.idealPara)}</p>` : ""}<div class="pd-cta">${buyBtn(p)}<a class="btn btn-ghost" href="${base}producto/${p.slug}.html">Ficha completa</a></div></div></li>`).join("\n")}
</ol></div></section>
${extra(g)}`;
  const first = list.find((p) => p.imagen && !/</.test(p.imagen));
  const jsonld = [{ "@context": "https://schema.org", "@type": "Article", headline: g.titulo, description: g.descripcion, datePublished: g.fecha, dateModified: g.actualizada || g.fecha, author: { "@type": "Organization", name: cfg.nombre, url: cfg.dominio }, publisher: { "@type": "Organization", name: cfg.nombre, url: cfg.dominio } }, itemList(list, g.titulo), crumbsLd([["Inicio", ""], ["Guías", "guias.html"], [g.titulo, g.ruta]]), ...faqLd(g)];
  add(g.ruta, layout({ title: g.titulo, description: g.descripcion, base, canonical: g.ruta, current: "guias", body, jsonld, type: "article", image: first ? first.imagen : "" }));
}
add("guias.html", layout({ title: "Guías de compra para el hogar", description: "Listas y guías para elegir rápido productos de Amazon para casa.", base: "", canonical: "guias.html", current: "guias", body: `<section class="hero"><div class="wrap"><p class="eyebrow">${guias.length} guías</p><h1>Guías para elegir sin perder la tarde</h1><p class="hero-lead">Cada guía agrupa los productos que resuelven un mismo problema, ordenados por lo que más se nota en el día a día.</p></div></section><section class="catalog"><div class="wrap"><div class="guides">${guias.map((g) => guideCard(g, "")).join("")}</div></div></section>` }));

// Página para el enlace de la bio de TikTok/YouTube
add("videos.html", layout({ title: "Productos vistos en TikTok y YouTube Shorts", description: "Busca por número el producto que has visto en nuestros vídeos de TikTok y YouTube Shorts y ve directo a Amazon.", base: "", canonical: "videos.html", current: "videos", body: `<section class="hero"><div class="wrap hero-grid">
  <div><p class="eyebrow">Enlace de la bio</p><h1>¿Qué número salía en el vídeo?</h1><p class="hero-lead">Cada producto de nuestros TikToks y Shorts tiene un número. Escríbelo o búscalo en la lista; el más nuevo está arriba.</p></div>
  <form class="numcard" id="numform"><label for="numinput">Número del vídeo</label><div class="numrow"><input id="numinput" name="n" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="Nº 07" autocomplete="off"><button type="submit">Buscar</button></div><p class="numresult" id="numresult" aria-live="polite"></p></form>
</div></section>
<section class="catalog"><div class="wrap"><div class="vlist" id="vlist">
${[...prods].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b.numero - a.numero).map((p) => `<div class="vrow" id="n${p.numero}" data-num="${p.numero}"><span class="tag">Nº ${num2(p.numero)}</span><div><h3><a href="producto/${p.slug}.html">${esc(p.nombre)}</a></h3><p class="muted">${esc(p.resumen)}</p></div>${buyBtn(p, "", "Ver en Amazon")}</div>`).join("\n")}
</div></div></section>` }));

add("aviso-legal.html", layout({ title: "Aviso legal y privacidad", description: "Aviso legal, política de privacidad y de cookies de Casa Resuelta.", base: "", canonical: "aviso-legal.html", body: `<section class="hero"><div class="wrap prose">
<h1>Aviso legal y privacidad</h1>
<h2>Programa de Afiliados de Amazon</h2><p>${esc(cfg.aviso)} Casa Resuelta participa en el Programa de Afiliados de Amazon EU, un programa de publicidad para afiliados diseñado para ofrecer a sitios web un modo de obtener comisiones por publicidad, publicitando e incluyendo enlaces a Amazon.es.</p>
<h2>Precios</h2><p>Esta web no muestra precios. El precio y la disponibilidad son los que indique Amazon en el momento de la compra.</p>
<h2>Datos personales</h2><p>Esta web no tiene formularios de registro ni guarda datos personales. Tus favoritos y tu comparador se guardan solo en tu navegador.</p>
<h2>Cookies</h2><p>Esta web no instala cookies propias. Al hacer clic en un enlace de Amazon, Amazon puede instalar sus cookies según su propia política de privacidad.</p>
<h2>Titular</h2><p>Titular: Casa Resuelta (tucasaresuelta.com). Para cualquier consulta, escribe al correo de contacto del titular.</p>
</div></section>` }));

add("404.html", layout({ title: "Página no encontrada", description: "Esta página no existe.", base: "", canonical: "404.html", noindex: true, body: `<section class="hero"><div class="wrap"><p class="eyebrow">Error 404</p><h1>Esta página no existe</h1><p class="hero-lead">Puede que el producto ya no esté. <a href="index.html">Vuelve al catálogo</a> o busca por número en <a href="videos.html">Vistos en vídeo</a>.</p></div></section>` }));

// Herramienta para añadir productos (no se indexa)
add("herramienta.html", layout({ title: "Añadir un producto", description: "Herramienta interna para preparar productos.", base: "", canonical: "herramienta.html", noindex: true, body: `<div class="wrap tool" id="tool">
<p class="eyebrow">Uso interno · no aparece en Google</p>
<h1>Añadir un producto</h1>
<p class="muted">Rellena los campos, copia el bloque de abajo y pégalo al final de <code>data/productos.json</code> (antes del último <code>]</code>). El siguiente número libre es el <strong>${Math.max(...prods.map((p) => p.numero)) + 1}</strong>.</p>
<label>Enlace de Amazon (de SiteStripe o la URL del producto)<input id="t-url" placeholder="https://amzn.to/... o https://www.amazon.es/dp/B0..."></label>
<div class="two"><label>Nombre<input id="t-nombre" placeholder="Freidora de aire Cosori"></label><label>Marca<input id="t-marca"></label></div>
<div class="two"><label>Número<input id="t-numero" type="number" value="${Math.max(...prods.map((p) => p.numero)) + 1}"></label><label>Categoría<select id="t-cat">${cats.map((c) => `<option value="${c.slug}">${esc(c.nombre)}</option>`).join("")}</select></label></div>
<label>Qué problemas resuelve (Ctrl/Cmd para varios)<select id="t-prob" multiple size="5">${probs.map((x) => `<option value="${x.slug}">${esc(x.nombre)}</option>`).join("")}</select></label>
<label>Resumen en una frase<input id="t-resumen"></label>
<label>Por qué lo recomiendas<textarea id="t-porque"></textarea></label>
<div class="two"><label>Lo mejor (uno por línea)<textarea id="t-pros"></textarea></label><label>A tener en cuenta (uno por línea)<textarea id="t-contras"></textarea></label></div>
<label>Ideal para<input id="t-ideal"></label>
<div class="two"><label>Enlace del TikTok<input id="t-tt"></label><label>Enlace del Short<input id="t-yt"></label></div>
<label>Imagen (opcional, ruta en assets/img/ o URL de SiteStripe)<input id="t-img"></label>
<pre id="t-out"></pre>
<button class="btn btn-amazon" type="button" id="t-copy">Copiar bloque</button>
</div>` }));

// ---------- escritura ----------
fs.rmSync(OUT, { recursive: true, force: true });
for (const [file, html] of pages) {
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}
for (const [file, html] of redirects) if (!fs.existsSync(path.join(OUT, file))) fs.writeFileSync(path.join(OUT, file), html);
fs.mkdirSync(path.join(OUT, "assets"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "src/style.css"), path.join(OUT, "assets/style.css"));
fs.copyFileSync(path.join(ROOT, "src/app.js"), path.join(OUT, "assets/app.js"));
if (fs.existsSync(path.join(ROOT, "src/img"))) fs.cpSync(path.join(ROOT, "src/img"), path.join(OUT, "assets/img"), { recursive: true });
fs.writeFileSync(path.join(OUT, "favicon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#c2410c"/><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15 16 7l10 8"/><path d="M9 14v11h14V14"/><path d="m12.5 19.5 2.5 2.5 4.5-4.5" stroke="#ffd2b0"/></g></svg>`);
fs.writeFileSync(path.join(OUT, "CNAME"), new URL(cfg.dominio).hostname + "\n");
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /herramienta.html\nDisallow: /preview.html\nSitemap: ${cfg.dominio}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
const urls = pages.map(([f]) => f).filter((f) => !["preview.html", "404.html", "herramienta.html"].includes(f));
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((f) => `  <url><loc>${cfg.dominio}/${f === "index.html" ? "" : f}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log(`Web generada en dist/ — ${pages.length} páginas, ${prods.length} productos.`);
