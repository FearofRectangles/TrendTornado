const rows = [...document.querySelectorAll(".article-row")];
const search = document.getElementById("articleSearch");
const pickZone = document.getElementById("articlePickZoneFilter");
const temperature = document.getElementById("articleTemperatureFilter");
const dataFilter = document.getElementById("articleDataFilter");
const resultSummary = document.getElementById("articleResultSummary");
const pageSummary = document.getElementById("articlePageSummary");
const pageIndicator = document.getElementById("articlePageIndicator");
const previous = document.getElementById("articlePreviousPage");
const next = document.getElementById("articleNextPage");
const formatter = new Intl.NumberFormat("sv-SE");
const pageSize = 30;
let currentPage = 1;

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
    (temperature.value === "" || row.dataset.temperature === temperature.value) &&
    matchesDataFilter(row)
  ));
}

function render() {
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
[pickZone, temperature, dataFilter].forEach((control) => control.addEventListener("change", reset));
previous.addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; render(); } });
next.addEventListener("click", () => {
  const pages = Math.max(1, Math.ceil(filteredRows().length / pageSize));
  if (currentPage < pages) { currentPage += 1; render(); }
});
rows.forEach((row) => {
  const open = () => { window.location.href = row.dataset.href; };
  row.addEventListener("click", open);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
  });
});
render();
