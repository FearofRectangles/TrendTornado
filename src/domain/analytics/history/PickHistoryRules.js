let excludedArticleNumbers = new Set([
  "7629",   // Rullbur kolonial
  "7628",   // Rullbur Fryst
  "134194", // Rullbur Grönsaker
  "134193", // Retur SRS Back
  "99134",  // Retur SRS back
]);

export function configureExcludedArticles(articleNumbers = []) {
  excludedArticleNumbers = new Set(articleNumbers.map((value) => String(value).trim()).filter(Boolean));
}

export function isExcludedArticle(articleNumber) {
  return excludedArticleNumbers.has(articleNumber);
}
