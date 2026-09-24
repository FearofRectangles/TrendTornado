let rows = [...document.querySelectorAll(".article-row")];
const search = document.getElementById("articleSearch");
const pickZone = document.getElementById("articlePickZoneFilter");
const physicalZone = document.getElementById("articlePhysicalZoneFilter");
const temperature = document.getElementById("articleTemperatureFilter");
const dataFilter = document.getElementById("articleDataFilter");
const classification = document.getElementById("articleClassificationFilter");
const resultSummary = document.getElementById("articleResultSummary");
const pageSummary = document.getElementById("articlePageSummary");
const pageIndicator = document.getElementById("articlePageIndicator");
const previous = document.getElementById("articlePreviousPage");
const next = document.getElementById("articleNextPage");
const drawer = document.getElementById("articleDrawer");
const drawerContent = document.getElementById("articleDrawerContent");
const drawerBackdrop = document.getElementById("articleDrawerBackdrop");
const drawerClose = document.getElementById("closeArticleDrawer");
const sortableHeaders = [...document.querySelectorAll(".article-table th[data-sort]")];
const tableBody = document.querySelector(".article-table tbody");
const exportButton = document.getElementById("exportArticles");
const exportForm = document.getElementById("articleExportForm");
const exportNumbers = document.getElementById("articleExportNumbers");
const formatter = new Intl.NumberFormat("sv-SE");
const decimalFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });
const pageSize = 30;
let currentPage = 1;
let drawerRequest = null;
let drawerTrigger = null;
let sortKey = "picks";
let sortDirection = "desc";

const sortValue = (row, key) => ({ article: row.dataset.articleNumber, name: row.dataset.name, classification: row.dataset.classification, weight: Number(row.dataset.weight), pickZone: row.dataset.pickZone, location: row.dataset.location, picks: Number(row.dataset.picks), priority: Number(row.dataset.priority) }[key]);

function sortRows() {
  rows = rows.toSorted((left, right) => {
    const a = sortValue(left, sortKey); const b = sortValue(right, sortKey);
    const comparison = typeof a === "number" ? a - b : String(a ?? "").localeCompare(String(b ?? ""), "sv", { numeric: true });
    return sortDirection === "asc" ? comparison : -comparison;
  });
  rows.forEach((row) => tableBody.appendChild(row));
  sortableHeaders.forEach((header) => header.setAttribute("aria-sort", header.dataset.sort === sortKey ? (sortDirection === "asc" ? "ascending" : "descending") : "none"));
}

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const value = (input, suffix = "") => input === null || input === undefined
  ? "Saknas"
  : `${decimalFormatter.format(input)}${suffix}`;
const percent = (input) => input === null || input === undefined
  ? "Ej beräknad"
  : `${decimalFormatter.format(input * 100)} %`;
const classificationDescription = (classification) => {
  if (!classification) return "Artikeln saknar plockhistorik och kan inte klassificeras.";
  const activity = classification.abcClass === "A" ? "Hög aktivitet" : classification.abcClass === "B" ? "Medelaktivitet" : "Låg aktivitet";
  const stability = classification.xyzClass === "X" ? "Stabil efterfrågan" : classification.xyzClass === "Y" ? "Varierande efterfrågan" : classification.xyzClass === "Z" ? "Sporadisk efterfrågan" : "Otillräcklig historik";
  return `${activity} · ${stability}`;
};

function detailRows(rowsToRender) {
  return `<dl>${rowsToRender.map(([label, detail]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(detail)}</dd></div>`).join("")}</dl>`;
}

function renderArticleDetail({ article, affinity }) {
  const classification = article.classification;
  const recommendation = article.priorityScore === null ? "UNDERLAG SAKNAS" : !article.isRelocationCandidate ? "BEHÅLL PLACERING" : article.direction === "EARLIER" ? "FLYTTA TIDIGARE" : "FLYTTA SENARE";
  const ergonomic = article.ergonomicRecommendation === "LOW_STRONGLY_RECOMMENDED" ? "LÅG STARKT REKOMMENDERAD" : article.ergonomicRecommendation === "LOW_PREFERRED" ? "LÅG FÖREDRAS" : article.ergonomicRecommendation ? "FLEXIBEL PLACERING" : "EJ BERÄKNAD";
  const articleDimensions = [article.articleHeightCm, article.articleWidthCm, article.articleDepthCm].every((item) => item !== null)
    ? `${value(article.articleHeightCm)} × ${value(article.articleWidthCm)} × ${value(article.articleDepthCm)} cm`
    : "Saknas";
  const locationDimensions = [article.locationHeightCm, article.locationWidthCm, article.locationDepthCm].every((item) => item !== null)
    ? `${value(article.locationHeightCm)} × ${value(article.locationWidthCm)} × ${value(article.locationDepthCm)} cm`
    : "Saknas";
  const affinityRows = affinity.partners.length > 0
    ? `<div class="affinity-list">${affinity.partners.map((partner, index) => `<button class="affinity-row drawer-affinity-link ${partner.available ? "" : "unavailable"}" type="button" data-article-number="${escapeHtml(partner.articleNumber)}" ${partner.available ? "" : "disabled"}><span class="affinity-rank">${index + 1}</span><div class="affinity-article"><strong>${escapeHtml(partner.articleNumber)}</strong><span>${escapeHtml(partner.name)}</span><small>${escapeHtml(partner.pickZone ?? "")}</small></div><div class="affinity-bar"><i style="width:${partner.affinity * 100}%"></i></div><strong class="affinity-value">${decimalFormatter.format(partner.affinity * 100)} %</strong><small class="affinity-orders">${formatter.format(partner.commonOrderCount)} gemensamma</small><span class="affinity-open">${partner.available ? "›" : "—"}</span></button>`).join("")}</div>`
    : `<div class="affinity-empty">Det finns inte tillräckligt många gemensamma order för att visa ett stabilt samband.</div>`;

  return `
    <header class="drawer-article-identity">
      <div class="article-number-label">Artikel ${escapeHtml(article.articleNumber)}</div>
      <h2 id="articleDrawerTitle">${escapeHtml(article.name)}</h2>
      <span class="article-category">${escapeHtml(article.category ?? article.pickZone ?? "OKATEGORISERAD")}</span>
      <a class="drawer-full-page" href="/articles/${encodeURIComponent(article.articleNumber)}">Öppna egen sida ↗</a>
    </header>
    <div class="article-drawer-grid">
      <section class="detail-card card classification-card"><div class="detail-card-heading"><span>ABC/XYZ-klassificering</span><i>◆</i></div>${classification ? `<div class="classification-hero"><strong class="classification-badge class-${classification.abcClass.toLowerCase()}">${escapeHtml(classification.classification)}</strong><div><b>${escapeHtml(classificationDescription(classification).split(" · ")[0])}</b><span>${escapeHtml(classificationDescription(classification).split(" · ")[1])}</span></div></div>${detailRows([["Aktiva veckor", `${classification.xyz.activeWeeks} av ${classification.xyz.observedWeeks}`], ["Snitt per vecka", `${decimalFormatter.format(classification.xyz.meanWeeklyPickStops)} stopp`], ["Variationskoefficient", classification.xyz.coefficientOfVariation === null ? "—" : decimalFormatter.format(classification.xyz.coefficientOfVariation)], ["Underlag", classification.quality === "STRONG" ? "Starkt" : classification.quality === "RELIABLE" ? "Tillförlitligt" : classification.quality === "PRELIMINARY" ? "Preliminärt" : "Otillräckligt"]])}` : `<div class="affinity-empty">${classificationDescription(null)}</div>`}</section>
      <section class="detail-card card"><div class="detail-card-heading"><span>Masterdata</span><i>▣</i></div>${detailRows([["Vikt", value(article.weightKg, " kg")], ["Temperatur", article.temperatureZone ?? "Saknas"], ["Produktgrupp", article.category ?? "Saknas i källdatan"], ["Basenhet", article.baseUnit ?? "Saknas"], ["Artikelmått H × B × D", articleDimensions]])}</section>
      <section class="detail-card card"><div class="detail-card-heading"><span>Placering</span><i>⌖</i></div>${detailRows([["Nuvarande plats", article.currentLocation ?? "Ingen plockplats"], ["Plockzon", article.pickZone ?? "Saknas"], ["Position", percent(article.currentPosition)], ["Sektion", article.currentSection ?? "Saknas"], ["Höjd över golv", article.currentFloorHeightCm === null ? "Saknas" : value(article.currentFloorHeightCm, " cm")], ["Platsmått H × B × D", locationDimensions], ["Platsvolym", article.locationVolumeM3 === null ? "Saknas" : value(article.locationVolumeM3, " m³")]])}</section>
      <section class="detail-card card"><div class="detail-card-heading"><span>Plockhistorik</span><i>◷</i></div>${detailRows([["Plock", formatter.format(article.pickFrequency)], ["Plockad kvantitet", formatter.format(article.pickedQuantity)], ["Åtgång per vecka", decimalFormatter.format(article.pickedQuantityPerWeek)], ["Snitt/plock", value(article.averageQuantityPerPick)], ["Hanterad vikt/plock", value(article.averageHandledWeightPerPick, " kg")]])}<p class="history-period-note">Genomsnitt över ${article.observedWeekCount} observerade veckor, inklusive veckor utan plock.</p></section>
      <section class="detail-card card drawer-tornado-card"><div class="detail-card-heading"><span>Trend Tornado</span><i>◉</i></div><div class="tornado-score"><span>Prioritet</span><strong>${article.priorityScore === null ? "—" : decimalFormatter.format(article.priorityScore)}</strong><div><i style="width:${(article.priorityScore ?? 0) * 100}%"></i></div></div>${detailRows([["Önskad position", percent(article.desiredPosition)], ["Placement gap", article.placementGap === null ? "Ej beräknad" : `${article.placementGap >= 0 ? "+" : "−"}${percent(Math.abs(article.placementGap))}`]])}<div class="recommendation-block"><span>Rekommendation</span><strong class="${article.direction === "EARLIER" ? "earlier" : "later"}">${recommendation}</strong>${article.recommendedZone ? `<small>Målområde: ${escapeHtml(article.recommendedZone)} · ${escapeHtml(article.recommendedSection)}</small>` : ""}</div><div class="ergonomic-block"><span>Ergonomi</span><strong>${ergonomic}</strong>${article.ergonomicReason ? `<small>${escapeHtml(article.ergonomicReason)}</small>` : ""}</div></section>
      <section class="detail-card card drawer-affinity-card"><div class="detail-card-heading"><span>Pick affinity</span><i>⌁</i></div><div class="affinity-intro"><div><h2>Ofta plockad tillsammans med</h2><p>Andel av artikelns <strong>${formatter.format(affinity.selectedOrderCount)}</strong> order där partnerartikeln också förekommer.</p></div><span>Minst ${affinity.minimumCommonOrders} gemensamma order</span></div>${affinityRows}<div class="affinity-method"><strong>Så läses måttet:</strong> 42 % betyder att partnerartikeln förekommer på 42 av 100 order som innehåller ${escapeHtml(article.articleNumber)}.</div></section>
    </div>`;
}

async function openDrawer(articleNumber, trigger = null) {
  drawerTrigger = trigger ?? drawerTrigger;
  drawerRequest?.abort();
  drawerRequest = new AbortController();
  drawerContent.innerHTML = `<div class="article-drawer-loading">Laddar artikelinformation…</div>`;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  document.body.classList.add("drawer-open");
  requestAnimationFrame(() => drawerBackdrop.classList.add("is-visible"));
  try {
    const response = await fetch(`/api/articles/${encodeURIComponent(articleNumber)}`, { signal: drawerRequest.signal });
    const detail = await response.json();
    if (!response.ok) throw new Error(detail.error ?? "Artikelinformationen kunde inte laddas.");
    drawerContent.innerHTML = renderArticleDetail(detail);
  } catch (error) {
    if (error.name !== "AbortError") drawerContent.innerHTML = `<div class="article-drawer-error">${escapeHtml(error.message)}</div>`;
  }
}

function closeDrawer() {
  drawerRequest?.abort();
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.classList.remove("is-visible");
  document.body.classList.remove("drawer-open");
  setTimeout(() => { drawerBackdrop.hidden = true; }, 180);
  drawerTrigger?.focus();
}

const requestedClassification = new URLSearchParams(window.location.search).get("classification");
if (requestedClassification && [...classification.options].some((option) => option.value === requestedClassification)) {
  classification.value = requestedClassification;
}

function matchesDataFilter(row) {
  if (dataFilter.value === "ANALYZED") return row.dataset.analyzed === "true";
  if (dataFilter.value === "NO_HISTORY") return row.dataset.hasHistory === "false";
  if (dataFilter.value === "NO_LOCATION") return row.dataset.hasLocation === "false";
  return true;
}

function filteredRows() {
  const term = search.value.trim().toLowerCase();
  return rows.filter((row) => (
    (term === "" || row.dataset.search.includes(term)) &&
    (pickZone.value === "" || row.dataset.pickZone === pickZone.value) &&
    (physicalZone.value === "" || row.dataset.physicalZone === physicalZone.value) &&
    (temperature.value === "" || row.dataset.temperature === temperature.value) &&
    (classification.value === "" || row.dataset.classification === classification.value) &&
    matchesDataFilter(row)
  ));
}

function render() {
  sortRows();
  const matches = filteredRows();
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  currentPage = Math.min(currentPage, pages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, matches.length);
  rows.forEach((row) => { row.hidden = true; });
  matches.slice(start, end).forEach((row) => { row.hidden = false; });
  resultSummary.textContent = `${formatter.format(matches.length)} artiklar matchar urvalet`;
  pageSummary.textContent = matches.length === 0 ? "Inga resultat" : `Visar ${start + 1}–${end} av ${formatter.format(matches.length)}`;
  pageIndicator.textContent = `${currentPage} / ${pages}`;
  previous.disabled = currentPage === 1;
  next.disabled = currentPage === pages;
}

function reset() { currentPage = 1; render(); }
search.addEventListener("input", reset);
[pickZone, physicalZone, temperature, classification, dataFilter].forEach((control) => control.addEventListener("change", reset));
previous.addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; render(); } });
next.addEventListener("click", () => {
  const pages = Math.max(1, Math.ceil(filteredRows().length / pageSize));
  if (currentPage < pages) { currentPage += 1; render(); }
});
sortableHeaders.forEach((header) => header.addEventListener("click", () => {
  sortDirection = sortKey === header.dataset.sort && sortDirection === "asc" ? "desc" : "asc";
  sortKey = header.dataset.sort;
  reset();
}));
exportButton.addEventListener("click", () => {
  const matches = filteredRows();
  if (!matches.length) return;
  exportNumbers.value = matches.map((row) => row.dataset.articleNumber).join(",");
  exportForm.submit();
});
rows.forEach((row) => {
  const open = () => { openDrawer(row.dataset.articleNumber, row); };
  row.addEventListener("click", open);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
  });
});
drawerClose.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
drawerContent.addEventListener("click", (event) => {
  const affinityLink = event.target.closest(".drawer-affinity-link[data-article-number]");
  if (affinityLink && !affinityLink.disabled) openDrawer(affinityLink.dataset.articleNumber);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer();
});
render();
