const model = JSON.parse(document.getElementById("warehouseData")?.textContent ?? "{}");
const map = document.getElementById("warehouseMap");
const tabs = [...document.querySelectorAll("[data-pick-zone]")];
const colorInputs = [...document.querySelectorAll('input[name="color"]')];
const zoneDrilldown = document.getElementById("zoneDrilldown");
const bayDrilldown = document.getElementById("bayDrilldown");
const bayGrid = document.getElementById("bayGrid");
const shelfStack = document.getElementById("shelfStack");
let activePickZone = model.pickZones[0]?.name ?? null;
let colorMode = "priority";
let activeZone = null;

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function selectedPickZone() {
  return model.pickZones.find((pickZone) => pickZone.name === activePickZone);
}

function heatColor(value, occupied) {
  if (!occupied) return "#eef1ef";
  const lightness = 92 - Math.max(0, Math.min(1, value)) * 48;
  const hue = colorMode === "weight" ? 263 : colorMode === "gap" ? 27 : colorMode === "frequency" ? 205 : 147;
  return `hsl(${hue} 54% ${lightness}%)`;
}

function renderMap() {
  const pickZone = selectedPickZone();
  if (!pickZone) { map.innerHTML = "<p>Ingen lagerstruktur hittades.</p>"; return; }
  map.innerHTML = pickZone.zones.map((zone) => `
    <article class="zone-map-row">
      <button class="zone-map-heading" type="button" data-open-zone="${escapeHtml(zone.zone)}">
        <span>Zon</span><strong>${escapeHtml(zone.zone)}</strong><small>${zone.bays.length} fack</small><b>Öppna zon ›</b>
      </button>
      <div class="zone-bay-strip">
        ${zone.bays.map((bay) => `<i style="background:${heatColor(bay.metrics[colorMode], bay.articleCount > 0)}" title="Fack ${escapeHtml(bay.bay)} · ${bay.articleCount} artiklar · ${colorMode} ${(bay.metrics[colorMode] * 100).toFixed(0)} %"></i>`).join("")}
      </div>
    </article>
  `).join("");
  map.querySelectorAll("[data-open-zone]").forEach((button) => button.addEventListener("click", () => openZone(button.dataset.openZone)));
}

function openZone(zoneCode) {
  activeZone = selectedPickZone()?.zones.find((zone) => zone.zone === zoneCode) ?? null;
  if (!activeZone) return;
  document.getElementById("selectedZoneTitle").textContent = `Zon ${activeZone.zone}`;
  document.getElementById("selectedZoneMeta").textContent = `${activePickZone} · ${activeZone.bays.length} fack · klicka på ett fack för hyllorna`;
  bayGrid.innerHTML = activeZone.bays.map((bay) => `
    <button class="bay-button" type="button" data-bay="${escapeHtml(bay.bay)}" style="--bay-color:${heatColor(bay.metrics[colorMode], bay.articleCount > 0)}">
      <i></i><strong>${escapeHtml(bay.bay)}</strong><span>${bay.articleCount} artiklar</span><small>${bay.occupiedLocations}/${bay.locations.length} platser används</small>
    </button>
  `).join("");
  bayGrid.querySelectorAll("[data-bay]").forEach((button) => button.addEventListener("click", () => openBay(button.dataset.bay)));
  zoneDrilldown.hidden = false;
  bayDrilldown.hidden = true;
  zoneDrilldown.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openBay(bayCode) {
  const bay = activeZone?.bays.find((item) => item.bay === bayCode);
  if (!bay) return;
  document.getElementById("selectedBayTitle").textContent = `${bay.zone}-${bay.bay}`;
  const measured = bay.locations.filter((location) => location.height && Object.values(location.dimensions).every(Number.isFinite)).length;
  document.getElementById("selectedBayMeta").textContent = `${bay.locations.length} plockplatser · ${bay.articleCount} placerade artiklar · ${measured} måttsatta`;
  const shelves = new Map();
  bay.locations.forEach((location) => {
    if (!shelves.has(location.shelf)) shelves.set(location.shelf, []);
    shelves.get(location.shelf).push(location);
  });
  shelfStack.innerHTML = [...shelves]
    .sort(([a], [b]) => b.localeCompare(a, "sv", { numeric: true }))
    .map(([shelf, locations]) => `
      <section class="shelf-row"><div class="shelf-label"><span>Hylla</span><strong>${escapeHtml(shelf)}</strong><small>${locations[0].height ? `${formatCentimeters(locations[0].height.floorHeightCm)} över golv` : "höjd saknas"}</small></div><div class="shelf-locations">
        ${locations.sort((a, b) => a.position.localeCompare(b.position, "sv", { numeric: true })).map((location) => `
          <article class="location-slot ${location.articles.length ? "occupied" : "empty"}"><div><span>${escapeHtml(location.locationCode)}</span><small>Position ${escapeHtml(location.position)}</small></div><div class="location-dimensions"><span>H ${dimension(location.dimensions.heightCm)}</span><span>B ${dimension(location.dimensions.widthCm)}</span><span>D ${dimension(location.dimensions.depthCm)}</span><span>${location.height?.volumeM3 == null ? "Volym —" : `${location.height.volumeM3.toLocaleString("sv-SE", { maximumFractionDigits: 3 })} m³`}</span></div><div class="location-height"><strong>${location.height ? `${formatCentimeters(location.height.floorHeightCm)}–${formatCentimeters(location.height.topHeightCm)}` : "Höjd över golv saknas"}</strong><small>över golv</small></div>
          ${location.articles.length ? location.articles.map((article) => `<a href="/articles/${encodeURIComponent(article.articleNumber)}"><strong>${escapeHtml(article.articleNumber)}</strong><span>${escapeHtml(article.name)}</span><small>${article.pickFrequency} plock · ${article.weightKg.toLocaleString("sv-SE")} kg</small></a>`).join("") : "<em>Tom plockplats</em>"}</article>
        `).join("")}
      </div></section>
    `).join("");
  bayDrilldown.hidden = false;
  bayDrilldown.scrollIntoView({ behavior: "smooth", block: "start" });
}

function dimension(value) { return Number.isFinite(value) ? `${value.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} cm` : "—"; }
function formatCentimeters(value) { return Number.isFinite(value) ? `${value.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} cm` : "—"; }

tabs.forEach((tab) => tab.addEventListener("click", () => {
  activePickZone = tab.dataset.pickZone;
  tabs.forEach((item) => item.setAttribute("aria-selected", String(item === tab)));
  zoneDrilldown.hidden = true;
  bayDrilldown.hidden = true;
  renderMap();
}));
colorInputs.forEach((input) => input.addEventListener("change", () => {
  colorMode = input.value;
  renderMap();
  if (!zoneDrilldown.hidden && activeZone) openZone(activeZone.zone);
}));
document.getElementById("closeZoneDrilldown").addEventListener("click", () => { zoneDrilldown.hidden = true; bayDrilldown.hidden = true; });
document.getElementById("closeBayDrilldown").addEventListener("click", () => { bayDrilldown.hidden = true; });
renderMap();
