import path from "node:path";

function normalizeOfficeId(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("Kontors-ID saknas eller är ogiltigt.");
  return normalized;
}

const officeId = normalizeOfficeId(process.env.TRENDTORNADO_OFFICE_ID ?? "KALMAR");

export const OfficeContext = Object.freeze({
  id: officeId,
  dataRoot: path.resolve("data", "offices", officeId),
});
