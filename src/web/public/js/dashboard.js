const rows =
  [
    ...document.querySelectorAll(
      ".recommendation-row",
    ),
  ];


const zoneFilter =
  document.getElementById(
    "zoneFilter",
  );


const directionFilter =
  document.getElementById(
    "directionFilter",
  );


const ergonomicFilter =
  document.getElementById(
    "ergonomicFilter",
  );


const searchInput =
  document.getElementById(
    "recommendationSearch",
  );


const previousPageButton =
  document.getElementById(
    "previousPage",
  );


const nextPageButton =
  document.getElementById(
    "nextPage",
  );


const pageIndicator =
  document.getElementById(
    "pageIndicator",
  );


const resultSummary =
  document.getElementById(
    "tableResultSummary",
  );


const pageSize =
  10;


let currentPage =
  1;


function getFilteredRows() {
  const selectedZone =
    zoneFilter.value;


  const selectedDirection =
    directionFilter.value;


  const selectedErgonomic =
    ergonomicFilter.value;


  const searchTerm =
    searchInput.value
      .trim()
      .toLowerCase();


  return rows.filter(
    (row) => {

      const matchesZone =
        selectedZone === "" ||
        row.dataset.zone ===
          selectedZone;


      const matchesDirection =
        selectedDirection === "" ||
        row.dataset.direction ===
          selectedDirection;


      const matchesErgonomic =
        selectedErgonomic === "" ||
        row.dataset.ergonomic ===
          selectedErgonomic;


      const matchesSearch =
        searchTerm === "" ||
        row.dataset.search
          .includes(
            searchTerm,
          );


      return (
        matchesZone &&
        matchesDirection &&
        matchesErgonomic &&
        matchesSearch
      );
    },
  );
}


function renderTable() {
  const filteredRows =
    getFilteredRows();


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRows.length /
        pageSize,
      ),
    );


  if (
    currentPage >
    totalPages
  ) {
    currentPage =
      totalPages;
  }


  const startIndex =
    (
      currentPage - 1
    ) *
    pageSize;


  const endIndex =
    startIndex +
    pageSize;


  const visibleRows =
    filteredRows.slice(
      startIndex,
      endIndex,
    );


  for (
    const row
    of rows
  ) {
    row.hidden =
      true;
  }


  visibleRows.forEach(
    (
      row,
      pageIndex,
    ) => {

      row.hidden =
        false;


      const rowNumber =
        row.querySelector(
          ".row-number",
        );


      if (
        rowNumber
      ) {
        rowNumber.textContent =
          startIndex +
          pageIndex +
          1;
      }
    },
  );


  const firstVisible =
    filteredRows.length === 0
      ? 0
      : startIndex + 1;


  const lastVisible =
    Math.min(
      endIndex,
      filteredRows.length,
    );


  resultSummary.textContent =
    filteredRows.length === 0
      ? "Inga flyttkandidater matchar filtret."
      : `Visar ${firstVisible}–${lastVisible} av ${filteredRows.length} flyttkandidater`;


  pageIndicator.textContent =
    `${currentPage} / ${totalPages}`;


  previousPageButton.disabled =
    currentPage === 1;


  nextPageButton.disabled =
    currentPage ===
    totalPages;
}


function resetToFirstPage() {
  currentPage =
    1;


  renderTable();
}


zoneFilter.addEventListener(
  "change",
  resetToFirstPage,
);


directionFilter.addEventListener(
  "change",
  resetToFirstPage,
);


ergonomicFilter.addEventListener(
  "change",
  resetToFirstPage,
);


searchInput.addEventListener(
  "input",
  resetToFirstPage,
);


previousPageButton.addEventListener(
  "click",
  () => {

    if (
      currentPage > 1
    ) {
      currentPage--;

      renderTable();
    }
  },
);


nextPageButton.addEventListener(
  "click",
  () => {

    const filteredRows =
      getFilteredRows();


    const totalPages =
      Math.max(
        1,
        Math.ceil(
          filteredRows.length /
          pageSize,
        ),
      );


    if (
      currentPage <
      totalPages
    ) {
      currentPage++;

      renderTable();
    }
  },
);


renderTable();