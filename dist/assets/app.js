// Interactividad de Casa Resuelta: filtros, búsqueda, favoritos, comparador, buscador por número y herramienta.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const P = window.CR_PRODUCTS || [];
  const BASE = window.CR_BASE || "";
  const byNum = (n) => P.find((p) => p.n === n);
  const pad = (n) => String(n).padStart(2, "0");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("cr:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("cr:" + k, JSON.stringify(v)); } catch {} },
  };
  const track = (name, params) => { try { if (window.gtag) window.gtag("event", name, params); } catch {} };

  // ---- Favoritos ----
  let favs = new Set(store.get("favs", []));
  function paintFavs() {
    $$("[data-fav]").forEach((b) => b.setAttribute("aria-pressed", favs.has(+b.dataset.fav) ? "true" : "false"));
    const fc = $("#favcount"); if (fc) fc.textContent = favs.size ? `(${favs.size})` : "";
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fav]"); if (!b) return;
    const n = +b.dataset.fav;
    favs.has(n) ? favs.delete(n) : favs.add(n);
    store.set("favs", [...favs]); paintFavs(); if (grid) apply();
  });
  paintFavs();

  // Clics a Amazon (para Google Analytics si se instala)
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-buy]"); if (a) track("clic_amazon", { producto: +a.dataset.buy });
  });

  // ---- Catálogo de portada ----
  const grid = $("#grid");
  const state = { cat: "", probs: new Set(), q: "", sort: "dest", fav: false };
  function apply() {
    const cards = $$(".card", grid);
    const q = state.q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    let shown = 0;
    cards.forEach((c) => {
      const name = c.dataset.name.normalize("NFD").replace(/[̀-ͯ]/g, "");
      const probs = c.dataset.prob.split(" ");
      const ok = (!state.cat || c.dataset.cat === state.cat)
        && (!state.probs.size || probs.some((p) => state.probs.has(p)))
        && (!q || q.split(/\s+/).every((w) => name.includes(w) || probs.some((p) => p.includes(w))))
        && (!state.fav || favs.has(+c.dataset.num));
      c.hidden = !ok; if (ok) shown++;
    });
    const key = { dest: (c) => [-c.dataset.dest, +c.dataset.num], new: (c) => [-(c.dataset.date || "").replace(/-/g, ""), +c.dataset.num], num: (c) => [+c.dataset.num, 0], az: (c) => [c.querySelector("h3").textContent, 0] }[state.sort];
    cards.sort((a, b) => { const x = key(a), y = key(b); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]; }).forEach((c) => grid.appendChild(c));
    const filtered = state.cat || state.probs.size || q || state.fav;
    $("#resultline").innerHTML = filtered ? `${shown} de ${cards.length} productos <button type="button" data-reset>Quitar filtros</button>` : `${cards.length} productos`;
    $("#empty").hidden = shown > 0;
  }
  if (grid) {
    $$("#catchips [data-cat]").forEach((b) => b.addEventListener("click", () => {
      state.cat = b.dataset.cat;
      $$("#catchips [data-cat]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      apply();
    }));
    $$("#probchips [data-prob]").forEach((b) => b.addEventListener("click", () => {
      const p = b.dataset.prob;
      state.probs.has(p) ? state.probs.delete(p) : state.probs.add(p);
      b.setAttribute("aria-pressed", state.probs.has(p) ? "true" : "false");
      apply();
      if (state.probs.size) $("#catalogo").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      track("filtro_problema", { problema: p });
    }));
    $("#q").addEventListener("input", (e) => { state.q = e.target.value; apply(); });
    const sortSel = $("#sort");
    sortSel.value = store.get("sort", "dest"); state.sort = sortSel.value || "dest";
    sortSel.addEventListener("change", () => { state.sort = sortSel.value; store.set("sort", state.sort); apply(); });
    $("#onlyfav").addEventListener("click", (e) => { state.fav = !state.fav; e.currentTarget.setAttribute("aria-pressed", state.fav); apply(); });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("[data-reset]")) return;
      state.cat = ""; state.probs.clear(); state.q = ""; state.fav = false;
      $("#q").value = ""; $("#onlyfav").setAttribute("aria-pressed", "false");
      $$("#probchips [data-prob]").forEach((x) => x.setAttribute("aria-pressed", "false"));
      $$("#catchips [data-cat]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.cat === "" ? "true" : "false"));
      apply();
    });
    apply();
  }

  // ---- Comparador ----
  const tray = $("#tray");
  let cmp = store.get("cmp", []).filter(byNum);
  function paintCmp() {
    if (!tray) return;
    $$("[data-cmp]").forEach((i) => { i.checked = cmp.includes(+i.dataset.cmp); i.disabled = !i.checked && cmp.length >= 3; });
    $("#trayitems").innerHTML = cmp.map((n) => `<span>Nº ${pad(n)} ${byNum(n).t}</span>`).join("") + (cmp.length < 2 ? `<span>Elige ${2 - cmp.length} más</span>` : "");
    $("#cmpopen").disabled = cmp.length < 2;
    tray.classList.toggle("on", cmp.length > 0);
  }
  if (tray) {
    document.addEventListener("change", (e) => {
      const i = e.target.closest("[data-cmp]"); if (!i) return;
      const n = +i.dataset.cmp;
      cmp = i.checked ? [...cmp, n].slice(0, 3) : cmp.filter((x) => x !== n);
      store.set("cmp", cmp); paintCmp();
    });
    $("#cmpclear").addEventListener("click", () => { cmp = []; store.set("cmp", cmp); paintCmp(); });
    const dlg = $("#cmpdlg");
    $("#cmpopen").addEventListener("click", () => {
      const items = cmp.map(byNum);
      const li = (a) => `<ul>${(a || []).map((x) => `<li>${x}</li>`).join("")}</ul>`;
      const row = (label, f) => `<tr><th scope="row">${label}</th>${items.map((p) => `<td>${f(p)}</td>`).join("")}</tr>`;
      $("#cmpbody").innerHTML = `<table class="cmp-table"><thead><tr><th></th>${items.map((p) => `<th><span class="eyebrow">Nº ${pad(p.n)}</span><br><a href="${BASE}producto/${p.s}.html">${p.t}</a></th>`).join("")}</tr></thead><tbody>
        ${row("Categoría", (p) => p.c)}${row("Resuelve", (p) => p.pb.join(", "))}${row("Ideal para", (p) => p.i || "")}${row("Lo mejor", (p) => li(p.pr))}${row("A tener en cuenta", (p) => li(p.co))}
        ${row("", (p) => `<a class="btn btn-amazon" href="${p.u}" target="_blank" rel="sponsored nofollow noopener" data-buy="${p.n}">Ver precio</a>`)}</tbody></table>`;
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      track("comparar", { productos: cmp.join(",") });
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); });
    paintCmp();
  }

  // ---- Buscar por número (vídeos) ----
  const form = $("#numform");
  function findNum(raw) {
    const n = parseInt(String(raw).replace(/\D/g, ""), 10);
    const out = $("#numresult");
    $$(".vrow.hit").forEach((r) => r.classList.remove("hit"));
    if (!n) { out.textContent = "Escribe solo el número, por ejemplo 7."; return; }
    const p = byNum(n);
    if (!p) { out.textContent = `No encontramos el Nº ${pad(n)}. Mira la lista completa.`; return; }
    track("busqueda_numero", { numero: n });
    const row = $("#n" + n);
    if (row) {
      row.classList.add("hit"); row.scrollIntoView({ block: "center" });
      out.innerHTML = `Nº ${pad(n)}: <a href="${p.u}" target="_blank" rel="sponsored nofollow noopener" data-buy="${n}">${p.t}, ver en Amazon</a>`;
    } else {
      out.innerHTML = `Nº ${pad(n)}: <a href="${BASE}producto/${p.s}.html">${p.t}</a> · <a href="${p.u}" target="_blank" rel="sponsored nofollow noopener" data-buy="${n}">Ver en Amazon</a>`;
    }
  }
  if (form) {
    form.addEventListener("submit", (e) => { e.preventDefault(); findNum($("#numinput").value); });
    // Enlaces tipo videos.html#n7 o ?n=7 desde la bio
    const m = (location.hash.match(/^#n(\d+)$/) || [])[1] || new URLSearchParams(location.search).get("n");
    if (m) { $("#numinput").value = m; findNum(m); }
  }

  // ---- Herramienta para añadir productos ----
  const tool = $("#tool");
  if (tool) {
    const v = (id) => $("#" + id).value.trim();
    const lines = (id) => v(id).split("\n").map((s) => s.trim()).filter(Boolean);
    const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    function build() {
      let url = v("t-url");
      const asin = (url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/) || [])[1];
      if (asin && /amazon\./.test(url)) url = `https://www.amazon.es/dp/${asin}`; // URL limpia; el tag se añade al generar la web
      const obj = {
        numero: +v("t-numero"), slug: slugify(v("t-nombre")), nombre: v("t-nombre"), marca: v("t-marca"),
        categoria: v("t-cat"), problemas: $$("#t-prob option:checked").map((o) => o.value),
        resumen: v("t-resumen"), porQue: v("t-porque"), pros: lines("t-pros"), contras: lines("t-contras"),
        idealPara: v("t-ideal"), enlace: url, imagen: v("t-img"), videos: { tiktok: v("t-tt"), youtube: v("t-yt") },
        destacado: false, fecha: new Date().toISOString().slice(0, 10),
      };
      $("#t-out").textContent = "," + JSON.stringify(obj, null, 2);
    }
    tool.addEventListener("input", build); build();
    $("#t-copy").addEventListener("click", (e) => {
      const txt = $("#t-out").textContent;
      const done = () => { e.target.textContent = "Copiado"; setTimeout(() => (e.target.textContent = "Copiar bloque"), 1500); };
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(done, () => {
        const r = document.createRange(); r.selectNodeContents($("#t-out")); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      });
    });
  }
})();
