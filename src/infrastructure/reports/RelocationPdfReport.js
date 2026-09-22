function pdfText(value, maximum = 40) {
  return String(value ?? "—")
    .replace(/[–—]/g, "-")
    .replace(/→/g, ">")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
    .slice(0, maximum)
    .replace(/([\\()])/g, "\\$1");
}

function text(x, y, value, size = 8, bold = false) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET\n`;
}

function destination(recommendation) {
  const options = recommendation.placementOptions;
  const direct = options?.direct?.[0];
  if (direct) return direct.locationCode;
  const swap = options?.swaps?.[0];
  if (swap) return `${swap.locationCode} (byte)`;
  const adjustment = options?.adjustments?.[0];
  if (adjustment) return `${adjustment.locationCode} (balk)`;
  return `${recommendation.recommendedZone} ${recommendation.recommendedSection}`;
}

function pageContent({ rows, pageNumber, pageCount, analysis }) {
  let content = "0.25 w\n";
  content += text(34, 560, "TrendTornado - Flyttlista", 16, true);
  content += text(34, 543, `${analysis.name} | ${analysis.periodStart} - ${analysis.periodEnd}`, 8);
  content += text(725, 560, `Sida ${pageNumber}/${pageCount}`, 8);
  content += "0.92 0.96 0.93 rg 30 510 782 22 re f 0 0 0 rg\n";
  const columns = [36, 70, 120, 270, 375, 475, 535, 600, 680, 765];
  ["Prio", "Artikel", "Namn", "Från plats", "Till plats/mål", "Gap", "Åtg./v", "Klass", "Riktning", "Klar"].forEach((heading, index) => {
    content += text(columns[index], 518, heading, 7, true);
  });
  rows.forEach((row, index) => {
    const y = 493 - index * 20;
    if (index % 2 === 1) content += `0.97 0.98 0.97 rg 30 ${y - 5} 782 19 re f 0 0 0 rg\n`;
    const values = [
      row.utility.score,
      row.articleNumber,
      pdfText(row.name, 25),
      row.currentLocation,
      destination(row),
      `${row.placementGap >= 0 ? "+" : "-"}${Math.abs(row.placementGap * 100).toFixed(1)}%`,
      row.pickedQuantityPerWeek.toFixed(1),
      row.classification?.classification ?? "—",
      row.direction === "EARLIER" ? "Tidigare" : "Senare",
      "[ ]",
    ];
    values.forEach((value, column) => { content += text(columns[column], y, value, 7, column === 0); });
    content += `0.86 0.88 0.86 RG 30 ${y - 7} m 812 ${y - 7} l S 0 0 0 RG\n`;
  });
  content += text(34, 24, `Skapad ${new Date().toLocaleString("sv-SE")} | ${rows.length} flyttar på denna sida`, 7);
  return Buffer.from(content, "latin1");
}

function buildPdf(contents) {
  const objects = [null, null, null];
  objects[0] = Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii");
  objects[2] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "ascii");
  objects[3] = Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "ascii");
  const pageRefs = [];
  for (const content of contents) {
    const pageObject = objects.length + 1;
    const contentObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`, "ascii"));
    objects.push(Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "ascii"),
      content,
      Buffer.from("\nendstream", "ascii"),
    ]));
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`, "ascii");

  const chunks = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, index) => {
    offsets[index + 1] = offset;
    const wrapped = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "ascii"), object, Buffer.from("\nendobj\n", "ascii")]);
    chunks.push(wrapped);
    offset += wrapped.length;
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

export class RelocationPdfReport {
  static create({ recommendations, analysis }) {
    const rowsPerPage = 23;
    const pages = [];
    for (let index = 0; index < recommendations.length; index += rowsPerPage) pages.push(recommendations.slice(index, index + rowsPerPage));
    if (pages.length === 0) pages.push([]);
    const contents = pages.map((rows, index) => pageContent({ rows, pageNumber: index + 1, pageCount: pages.length, analysis }));
    return buildPdf(contents);
  }
}
