const rows = [...document.querySelectorAll(".recommendation-row")];
const zoneFilter = document.getElementById("zoneFilter");
const directionFilter = document.getElementById("directionFilter");
const ergonomicFilter = document.getElementById("ergonomicFilter");
const searchInput = document.getElementById("recommendationSearch");
const previousPageButton = document.getElementById("previousPage");
const nextPageButton = document.getElementById("nextPage");
const pageIndicator = document.getElementById("pageIndicator");
const resultSummary = document.getElementById("tableResultSummary");

const pageSize = 10;
let currentPage = 1;

function detailRowFor(row) {
  return document.getElementById(row.getAttribute("aria-controls"));
}

function closeDetails(row) {
  const detailRow = detailRowFor(row);
  row.classList.remove("is-expanded");
  row.setAttribute("aria-expanded", "false");
  detailRow?.classList.remove("is-open");
  detailRow?.setAttribute("aria-hidden", "true");
}

function toggleDetails(row) {
  const detailRow = detailRowFor(row);
  if (!detailRow) return;

  const shouldOpen = row.getAttribute("aria-expanded") !== "true";
  row.classList.toggle("is-expanded", shouldOpen);
  row.setAttribute("aria-expanded", String(shouldOpen));
  detailRow.classList.toggle("is-open", shouldOpen);
  detailRow.setAttribute("aria-hidden", String(!shouldOpen));
}

function getFilteredRows() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  return rows.filter((row) => (
    (zoneFilter.value === "" || row.dataset.zone === zoneFilter.value) &&
    (directionFilter.value === "" || row.dataset.direction === directionFilter.value) &&
    (ergonomicFilter.value === "" || row.dataset.ergonomic === ergonomicFilter.value) &&
    (searchTerm === "" || row.dataset.search.includes(searchTerm))
  ));
}

function renderTable() {
  const filteredRows = getFilteredRows();
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  rows.forEach((row) => {
    row.hidden = true;
    detailRowFor(row).hidden = true;
    closeDetails(row);
  });

  visibleRows.forEach((row, pageIndex) => {
    row.hidden = false;
    detailRowFor(row).hidden = false;
    const rowNumber = row.querySelector(".row-number");
    if (rowNumber) rowNumber.textContent = startIndex + pageIndex + 1;
  });

  const firstVisible = filteredRows.length === 0 ? 0 : startIndex + 1;
  const lastVisible = Math.min(endIndex, filteredRows.length);
  resultSummary.textContent = filteredRows.length === 0
    ? "Inga flyttkandidater matchar filtret."
    : `Visar ${firstVisible}–${lastVisible} av ${filteredRows.length} flyttkandidater`;
  pageIndicator.textContent = `${currentPage} / ${totalPages}`;
  previousPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;
}

function resetToFirstPage() {
  currentPage = 1;
  renderTable();
}

[zoneFilter, directionFilter, ergonomicFilter].forEach((filter) => {
  filter.addEventListener("change", resetToFirstPage);
});
searchInput.addEventListener("input", resetToFirstPage);

previousPageButton.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderTable();
  }
});

nextPageButton.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / pageSize));
  if (currentPage < totalPages) {
    currentPage += 1;
    renderTable();
  }
});

rows.forEach((row) => {
  row.addEventListener("click", () => toggleDetails(row));
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDetails(row);
    }
  });
});

renderTable();
