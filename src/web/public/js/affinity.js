const clusters = JSON.parse(document.getElementById("affinityData")?.textContent ?? "[]");
const byId = new Map(clusters.map((item) => [item.id, item]));
let rows = [...document.querySelectorAll(".cluster-row")];
const tabs = [...document.querySelectorAll("[data-zone]")];
const search = document.getElementById("affinitySearch");
const opportunity = document.getElementById("opportunityFilter");
const spread = document.getElementById("spreadFilter");
const clusterSize = document.getElementById("clusterSizeFilter");
const summary = document.getElementById("clusterResultSummary");
const drawer = document.getElementById("affinityDrawer");
const content = document.getElementById("affinityDrawerContent");
const backdrop = document.getElementById("affinityBackdrop");
const close = document.getElementById("closeAffinityDrawer");
let zone = "";
let sortKey = "opportunity";
let sortDirection = "desc";
const sortableHeaders = [...document.querySelectorAll(".cluster-table-wrap th[data-sort]")];
const tableBody = document.querySelector(".cluster-table-wrap tbody");
const format = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });
const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const zoneName = (value) => ({ KOLONIAL: "Kolonial", KYLT: "Kylt", GRÖNSAKER: "Grönsaker", FRYS: "Frys" }[value] ?? value);
const zoneClass = (value) => value.toLowerCase().replace("ö", "o");
const locationLabel = (article) => `Zon ${article.physicalZone ?? "—"} · ${article.flowSection ?? "Okänd"}`;

function render() {
  const getValue = (row) => { const item = byId.get(row.dataset.id); return ({ zone: item?.pickZone, name: item?.name, size: item?.articles.length, class: item?.classProfile, occurrence: item?.occurrenceCount, spread: item?.estimatedSpreadMeters, opportunity: item?.opportunityScore })[sortKey]; };
  rows = rows.toSorted((left, right) => { const a = getValue(left); const b = getValue(right); const comparison = typeof a === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""), "sv", { numeric: true }); return sortDirection === "asc" ? comparison : -comparison; });
  rows.forEach((row) => tableBody.appendChild(row));
  sortableHeaders.forEach((header) => header.setAttribute("aria-sort", header.dataset.sort === sortKey ? (sortDirection === "asc" ? "ascending" : "descending") : "none"));
  const term = search.value.trim().toLowerCase();
  let count = 0;
  rows.forEach((row) => {
    const item = byId.get(row.dataset.id);
    const visible = (!zone || row.dataset.zone === zone) && (item?.articles.length ?? 0) >= Number(clusterSize.value) && Number(row.dataset.score) >= Number(opportunity.value) && Number(row.dataset.spread) >= Number(spread.value || 0) && (!term || row.dataset.search.includes(term));
    row.hidden = !visible;
    if (visible) count += 1;
  });
  summary.textContent = `${format.format(count)} kluster matchar urvalet`;
}

function openDrawer(id) {
  const item = byId.get(id);
  if (!item) return;
  content.innerHTML = `
    <div class="drawer-eyebrow">Avdelningsbundet affinity-kluster</div><h2>${escape(item.name)}</h2>
    <span class="drawer-zone zone-badge zone-${zoneClass(item.pickZone)}">${escape(zoneName(item.pickZone))}</span>
    <div class="drawer-kpis"><div><span>Förekomst</span><strong>${format.format(item.occurrenceCount)} order</strong></div><div><span>Opportunity</span><strong>${format.format(item.opportunityScore)}</strong></div><div><span>Intern täthet</span><strong>${format.format(item.internalDensity * 100)} %</strong></div><div><span>Uppskattad spridning</span><strong>${format.format(item.estimatedSpreadMeters)} m</strong></div></div>
    <div class="priority-explanation"><strong>Varför prioriteras klustret?</strong><p>${escape(item.priorityReason)}</p><span>Opportunity kombinerar samplockningsstyrka, artikelaktivitet, fysisk spridning och hur starkt historiskt underlaget är.</span></div>
    <div class="flow-heading"><strong>Position i plockflödet</strong><span>Punkterna visar artikelns relativa position inom ${escape(zoneName(item.pickZone))}.</span></div>
    <div class="flow-map"><div class="flow-segments"><span>Början</span><span>Mitten</span><span>Slutet</span></div>${item.articles.map((article) => `<div class="flow-point" style="left:${Math.max(2, Math.min(98, article.currentPosition * 100))}%" title="${escape(locationLabel(article))} · ${format.format(article.currentPosition * 100)} %"><i></i><strong>${escape(article.articleNumber)}</strong><small>${escape(locationLabel(article))}</small></div>`).join("")}</div>
    <h3 class="member-heading">Kärnartiklar <span>${item.articles.length}</span></h3>
    <div class="drawer-article-head"><span>Artikel</span><span>Namn</span><span>ABC/XYZ</span><span>Position i flödet</span></div>
    <div class="drawer-articles core-articles">${item.articles.map((article) => `<a class="drawer-article" href="/articles/${encodeURIComponent(article.articleNumber)}"><strong>${escape(article.articleNumber)}</strong><span>${escape(article.name)}</span><b>${escape(article.classification?.classification ?? "—")}</b><small><strong>${escape(locationLabel(article))}</strong><span>${format.format(article.currentPosition * 100)} % genom området</span></small></a>`).join("")}</div>
    ${item.associatedArticles.length > 0 ? `<h3 class="member-heading associated-heading">Associerade artiklar <span>${item.associatedArticles.length}</span></h3><div class="drawer-article-head"><span>Artikel</span><span>Namn</span><span>ABC/XYZ</span><span>Position i flödet</span></div><div class="drawer-articles associated-articles">${item.associatedArticles.map((article) => `<a class="drawer-article" href="/articles/${encodeURIComponent(article.articleNumber)}"><strong>${escape(article.articleNumber)}</strong><span>${escape(article.name)}</span><b>${escape(article.classification?.classification ?? "—")}</b><small><strong>${escape(locationLabel(article))}</strong><span>${format.format(article.currentPosition * 100)} % genom området</span></small></a>`).join("")}</div>` : ""}
    <div class="drawer-method"><strong>Starkaste relation:</strong> ${escape(item.strongestRelation.leftArticleNumber)} ↔ ${escape(item.strongestRelation.rightArticleNumber)} · ${format.format(item.strongestRelation.affinity * 100)} % affinity · ${format.format(item.strongestRelation.commonOrderCount)} gemensamma order. Förekomst betyder unika order där minst två artiklar i klustret samplockades.</div>`;
  drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); backdrop.hidden = false;
  requestAnimationFrame(() => backdrop.classList.add("is-visible"));
}

function closeDrawer() { drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); backdrop.classList.remove("is-visible"); setTimeout(() => { backdrop.hidden = true; }, 180); }
tabs.forEach((tab) => tab.addEventListener("click", () => { tabs.forEach((item) => item.classList.remove("active")); tab.classList.add("active"); zone = tab.dataset.zone; render(); }));
sortableHeaders.forEach((header) => header.addEventListener("click", () => { sortDirection = sortKey === header.dataset.sort && sortDirection === "asc" ? "desc" : "asc"; sortKey = header.dataset.sort; render(); }));
[opportunity, clusterSize, spread].forEach((control) => control.addEventListener("change", render)); search.addEventListener("input", render);
rows.forEach((row) => { row.addEventListener("click", () => openDrawer(row.dataset.id)); row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(row.dataset.id); } }); });
close.addEventListener("click", closeDrawer); backdrop.addEventListener("click", closeDrawer); document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); }); render();
