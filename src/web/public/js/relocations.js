let rows = [...document.querySelectorAll(".work-row")];
const controls = {
  pickZone: document.getElementById("pickZoneFilter"),
  direction: document.getElementById("relocationDirectionFilter"),
  ergonomic: document.getElementById("relocationErgonomicFilter"),
  classification: document.getElementById("relocationClassificationFilter"),
  currentZone: document.getElementById("currentZoneFilter"),
  recommendedZone: document.getElementById("recommendedZoneFilter"),
  minimumGap: document.getElementById("minimumGapFilter"),
  minimumUtility: document.getElementById("minimumUtilityFilter"),
  sort: document.getElementById("relocationSort"),
  search: document.getElementById("relocationSearch"),
};
const minimumGapValue = document.getElementById("minimumGapValue");
const clearFiltersButton = document.getElementById("clearFilters");
const resultSummary = document.getElementById("relocationResultSummary");
const pageSummary = document.getElementById("workPageSummary");
const pageIndicator = document.getElementById("workPageIndicator");
const previousPageButton = document.getElementById("workPreviousPage");
const nextPageButton = document.getElementById("workNextPage");
const drawer = document.getElementById("relocationDrawer");
const drawerContent = document.getElementById("drawerContent");
const drawerBackdrop = document.getElementById("drawerBackdrop");
const closeDrawerButton = document.getElementById("closeDrawer");
const exportButton = document.getElementById("exportRelocations");
const exportForm = document.getElementById("relocationExportForm");
const exportArticleNumbers = document.getElementById("exportArticleNumbers");

const recommendations = JSON.parse(
  document.getElementById("relocationData")?.textContent ?? "[]",
);
const recommendationByArticle = new Map(
  recommendations.map((item) => [String(item.articleNumber), item]),
);
const number = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });
const pageSize = 25;
let currentPage = 1;
let previouslyFocusedRow = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filteredRows() {
  const search = controls.search.value.trim().toLowerCase();
  return rows.filter((row) => (
    (controls.pickZone.value === "" || row.dataset.pickZone === controls.pickZone.value) &&
    (controls.direction.value === "" || row.dataset.direction === controls.direction.value) &&
    (controls.ergonomic.value === "" || row.dataset.ergonomic === controls.ergonomic.value) &&
    (controls.classification.value === "" || row.dataset.classification === controls.classification.value) &&
    (controls.currentZone.value === "" || row.dataset.currentZone === controls.currentZone.value) &&
    (controls.recommendedZone.value === "" || row.dataset.recommendedZone === controls.recommendedZone.value) &&
    Number(row.dataset.gap) >= Number(controls.minimumGap.value) &&
    Number(row.dataset.utility) >= Number(controls.minimumUtility.value) &&
    (search === "" || row.dataset.search.includes(search))
  ));
}

function render() {
  const comparator = {
    utility: (a, b) => Number(b.dataset.utility) - Number(a.dataset.utility),
    gap: (a, b) => Number(b.dataset.gap) - Number(a.dataset.gap),
    quantity: (a, b) => Number(b.dataset.quantity) - Number(a.dataset.quantity),
    article: (a, b) => a.dataset.articleNumber.localeCompare(b.dataset.articleNumber, "sv", { numeric: true }),
  }[controls.sort.value];
  rows = rows.toSorted(comparator);
  const body = document.querySelector(".work-table tbody");
  rows.forEach((row) => body.appendChild(row));
  const matches = filteredRows();
  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, matches.length);
  rows.forEach((row) => { row.hidden = true; });
  matches.slice(start, end).forEach((row) => { row.hidden = false; });
  resultSummary.textContent = `${number.format(matches.length)} flyttare matchar urvalet`;
  pageSummary.textContent = matches.length === 0
    ? "Inga resultat"
    : `Visar ${start + 1}–${end} av ${number.format(matches.length)}`;
  pageIndicator.textContent = `${currentPage} / ${totalPages}`;
  previousPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
}

function resetAndRender() {
  currentPage = 1;
  minimumGapValue.textContent = `${controls.minimumGap.value} %`;
  render();
}

function ergonomicLabel(value) {
  if (value === "LOW_STRONGLY_RECOMMENDED") return "Låg rekommenderas";
  if (value === "LOW_PREFERRED") return "Låg föredras";
  return "Flexibel placering";
}

function utilityExplanation(utility) {
  if (!utility) return "";
  const labels = {
    activity: "Dokumenterad aktivitet",
    gap: "Placeringsavvikelse",
    flowImpact: utility.directionModel === "SPACE_RELEASE" ? "Frigöringsnytta" : "Flödesnytta",
    feasibility: "Genomförbarhet",
    confidence: "Datastöd",
    ergonomics: "Ergonomi",
  };
  return `<div class="utility-explanation"><div><span>Flyttprioritet</span><strong>${utility.score}/100</strong><b>${escapeHtml(utility.label)}</b></div>${Object.entries(utility.contributions).map(([key, value]) => `<p><span>${labels[key]}</span><strong>+${value}</strong></p>`).join("")}</div>`;
}

function placementOptionCard(option) {
  const action = option.type === "DIRECT"
    ? "Ledig plats"
    : option.type === "SWAP"
      ? `Byt med ${escapeHtml(option.displacedArticle.articleNumber)}`
      : `Höj balk ${number.format(option.adjustmentCm)} cm`;
  const capacity = option.capacity.estimatedDaysOfDemand === null
    ? "Kapacitet kan inte bedömas"
    : `≈ ${number.format(option.capacity.estimatedCapacity)} ${escapeHtml(option.capacity.baseUnit ?? "enheter")} · ${number.format(option.capacity.estimatedDaysOfDemand)} dagars åtgång`;
  return `<article class="placement-option"><div><strong>${escapeHtml(option.locationCode)}</strong><span>${action}</span></div><p>Position ${number.format(option.relativePosition * 100)} % · ${option.withinTargetInterval ? "inom målområdet" : "närmaste genomförbara"}</p><small>${capacity} · uppskattad geometrisk kapacitet</small></article>`;
}

function placementOptionsMarkup(options) {
  if (!options || options.dataQuality === "UNKNOWN") return `<div class="placement-options"><h3>Genomförbara alternativ</h3><p class="option-empty">Artikelmått saknas. TrendTornado kan därför inte kontrollera fysisk passform.</p></div>`;
  const groups = [
    ["Direkt tillgängliga", options.direct],
    ["Möjliga artikelbyten", options.swaps],
    ["Enkel balkjustering", options.adjustments],
  ];
  return `<div class="placement-options"><div class="placement-options-heading"><div><h3>Genomförbara alternativ</h3><p>Geometrisk kontroll inom samma plockområde.</p></div><span>Uppskattad</span></div>${groups.map(([title, items]) => `<section><h4>${title} <b>${items.length}</b></h4>${items.length ? items.map(placementOptionCard).join("") : `<p class="option-empty">Inga lämpliga alternativ hittades.</p>`}</section>`).join("")}<p class="capacity-disclaimer">Kapaciteten utgår från artikelmått och fri platsvolym. Staplings- och kolliregler ingår ännu inte.</p></div>`;
}

async function openDrawer(articleNumber, sourceRow) {
  const item = recommendationByArticle.get(String(articleNumber));
  if (!item) return;
  previouslyFocusedRow = sourceRow;
  const earlier = item.direction === "EARLIER";
  drawerContent.innerHTML = `
    <div class="drawer-eyebrow">Flyttkandidat</div>
    <h2 id="drawerTitle">${escapeHtml(item.articleNumber)}</h2>
    <p class="drawer-name">${escapeHtml(item.name)}</p>
    <div class="drawer-route">
      <section><span>Nu</span><strong>${escapeHtml(item.currentZone)} · ${escapeHtml(item.currentSection)}</strong><small>Position ${number.format(item.currentPosition * 100)} %</small></section>
      <div class="drawer-direction ${earlier ? "earlier" : "later"}">${earlier ? "↑" : "↓"}<small>flytta ${earlier ? "tidigare" : "senare"}</small></div>
      <section class="recommended"><span>Analytiskt målområde</span><strong>${escapeHtml(item.recommendedZone)} · ${escapeHtml(item.recommendedSection)}</strong><small id="targetInterval">Position ${number.format(item.desiredPosition * 100)} %</small></section>
    </div>
    <div class="drawer-metrics">
      <div><span>Gap</span><strong>${earlier ? "+" : "−"}${number.format(Math.abs(item.placementGap * 100))} %</strong></div>
      <div><span>Plockfrekvens</span><strong>${number.format(item.pickFrequency)}</strong></div>
      <div><span>Åtgång/vecka</span><strong>${number.format(item.pickedQuantityPerWeek)} enheter</strong><small>Snitt över ${number.format(item.observedWeekCount)} veckor</small></div>
      <div><span>ABC/XYZ</span><strong>${escapeHtml(item.classification?.classification ?? "—")}</strong></div>
      <div><span>Snitt/plock</span><strong>${number.format(item.averageQuantityPerPick)}</strong></div>
      <div><span>Hanterad vikt</span><strong>${number.format(item.averageHandledWeightPerPick)} kg</strong></div>
      <div><span>Höjd över golv</span><strong>${item.currentFloorHeightCm === null ? "Saknas" : `${number.format(item.currentFloorHeightCm)} cm`}</strong></div>
    </div>
    <div class="drawer-ergonomics"><span>Ergonomi</span><strong>${ergonomicLabel(item.ergonomicRecommendation)}</strong><p>${escapeHtml(item.ergonomicReason)}</p></div>
    ${utilityExplanation(item.utility)}
    <div id="placementOptions"><div class="placement-options"><h3>Genomförbara alternativ</h3><p class="option-empty">Beräknade alternativ hämtas…</p></div></div>
  `;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => drawerBackdrop.classList.add("is-visible"));
  document.body.classList.add("drawer-open");
  closeDrawerButton.focus();
  try {
    const response = await fetch(`/api/relocations/${encodeURIComponent(item.articleNumber)}/options`);
    if (!response.ok) throw new Error("Alternativen kunde inte hämtas");
    const result = await response.json();
    item.placementOptions = result.placementOptions;
    const optionContainer = document.getElementById("placementOptions");
    if (optionContainer) optionContainer.innerHTML = placementOptionsMarkup(item.placementOptions);
    const interval = item.placementOptions?.targetInterval;
    const intervalElement = document.getElementById("targetInterval");
    if (interval && intervalElement) intervalElement.textContent = `${number.format(interval.start * 100)}–${number.format(interval.end * 100)} % av plockflödet`;
  } catch {
    const optionContainer = document.getElementById("placementOptions");
    if (optionContainer) optionContainer.innerHTML = `<div class="placement-options"><h3>Genomförbara alternativ</h3><p class="option-empty">Alternativen kunde inte hämtas just nu.</p></div>`;
  }
}

function closeDrawer() {
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerBackdrop.classList.remove("is-visible");
  document.body.classList.remove("drawer-open");
  window.setTimeout(() => { drawerBackdrop.hidden = true; }, 180);
  previouslyFocusedRow?.focus();
}

Object.values(controls).forEach((control) => {
  control.addEventListener(control === controls.search ? "input" : "change", resetAndRender);
});
controls.minimumGap.addEventListener("input", resetAndRender);
clearFiltersButton.addEventListener("click", () => {
  Object.values(controls).forEach((control) => {
    control.value = control === controls.minimumGap ? "20" : control === controls.sort ? "utility" : "";
  });
  resetAndRender();
});
exportButton.addEventListener("click", () => {
  const matches = filteredRows();
  if (matches.length === 0) return;
  exportArticleNumbers.value = matches.map((row) => row.dataset.articleNumber).join(",");
  exportForm.submit();
});
previousPageButton.addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; render(); } });
nextPageButton.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(filteredRows().length / pageSize));
  if (currentPage < totalPages) { currentPage += 1; render(); }
});
rows.forEach((row) => {
  row.addEventListener("click", () => openDrawer(row.dataset.articleNumber, row));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(row.dataset.articleNumber, row); }
  });
});
closeDrawerButton.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer(); });

render();
