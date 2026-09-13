const rows = [...document.querySelectorAll(".work-row")];
const controls = {
  pickZone: document.getElementById("pickZoneFilter"),
  direction: document.getElementById("relocationDirectionFilter"),
  ergonomic: document.getElementById("relocationErgonomicFilter"),
  classification: document.getElementById("relocationClassificationFilter"),
  currentZone: document.getElementById("currentZoneFilter"),
  recommendedZone: document.getElementById("recommendedZoneFilter"),
  minimumGap: document.getElementById("minimumGapFilter"),
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

function statusFor(articleNumber) {
  return localStorage.getItem(`trendtornado:relocation:${articleNumber}`) ?? "NEW";
}

function statusLabel(status) {
  return { NEW: "Ny", PLANNED: "Planerad", MOVED: "Flyttad", REJECTED: "Avvisad" }[status] ?? "Ny";
}

function updateStatus(articleNumber, status) {
  localStorage.setItem(`trendtornado:relocation:${articleNumber}`, status);
  document.querySelectorAll(`[data-status-for="${CSS.escape(String(articleNumber))}"]`)
    .forEach((badge) => {
      badge.textContent = statusLabel(status);
      badge.dataset.status = status;
    });
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
    (search === "" || row.dataset.search.includes(search))
  ));
}

function render() {
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

function openDrawer(articleNumber, sourceRow) {
  const item = recommendationByArticle.get(String(articleNumber));
  if (!item) return;
  previouslyFocusedRow = sourceRow;
  const earlier = item.direction === "EARLIER";
  const status = statusFor(item.articleNumber);
  drawerContent.innerHTML = `
    <div class="drawer-eyebrow">Flyttkandidat</div>
    <h2 id="drawerTitle">${escapeHtml(item.articleNumber)}</h2>
    <p class="drawer-name">${escapeHtml(item.name)}</p>
    <div class="drawer-route">
      <section><span>Nu</span><strong>${escapeHtml(item.currentZone)} · ${escapeHtml(item.currentSection)}</strong><small>Position ${number.format(item.currentPosition * 100)} %</small></section>
      <div class="drawer-direction ${earlier ? "earlier" : "later"}">${earlier ? "↑" : "↓"}<small>flytta ${earlier ? "tidigare" : "senare"}</small></div>
      <section class="recommended"><span>Rekommenderat</span><strong>${escapeHtml(item.recommendedZone)} · ${escapeHtml(item.recommendedSection)}</strong><small>Position ${number.format(item.desiredPosition * 100)} %</small></section>
    </div>
    <div class="drawer-metrics">
      <div><span>Gap</span><strong>${earlier ? "+" : "−"}${number.format(Math.abs(item.placementGap * 100))} %</strong></div>
      <div><span>Plockfrekvens</span><strong>${number.format(item.pickFrequency)}</strong></div>
      <div><span>ABC/XYZ</span><strong>${escapeHtml(item.classification?.classification ?? "—")}</strong></div>
      <div><span>Snitt/plock</span><strong>${number.format(item.averageQuantityPerPick)}</strong></div>
      <div><span>Hanterad vikt</span><strong>${number.format(item.averageHandledWeightPerPick)} kg</strong></div>
    </div>
    <div class="drawer-ergonomics"><span>Ergonomi</span><strong>${ergonomicLabel(item.ergonomicRecommendation)}</strong><p>${escapeHtml(item.ergonomicReason)}</p></div>
    <div class="drawer-action"><button id="planRelocation" type="button" ${status === "PLANNED" ? "disabled" : ""}>${status === "PLANNED" ? "✓ Flytt planerad" : "Planera flytt"}</button><small>Status sparas lokalt i den här webbläsaren.</small></div>
  `;
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerBackdrop.hidden = false;
  requestAnimationFrame(() => drawerBackdrop.classList.add("is-visible"));
  document.body.classList.add("drawer-open");
  document.getElementById("planRelocation").addEventListener("click", (event) => {
    updateStatus(item.articleNumber, "PLANNED");
    event.currentTarget.textContent = "✓ Flytt planerad";
    event.currentTarget.disabled = true;
  });
  closeDrawerButton.focus();
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
    control.value = control === controls.minimumGap ? "20" : "";
  });
  resetAndRender();
});
previousPageButton.addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; render(); } });
nextPageButton.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(filteredRows().length / pageSize));
  if (currentPage < totalPages) { currentPage += 1; render(); }
});
rows.forEach((row) => {
  updateStatus(row.dataset.articleNumber, statusFor(row.dataset.articleNumber));
  row.addEventListener("click", () => openDrawer(row.dataset.articleNumber, row));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(row.dataset.articleNumber, row); }
  });
});
closeDrawerButton.addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer(); });

render();
