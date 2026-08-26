export function attachPickSequence(
  analyzedArticles,
  pickSequence,
) {
  if (!Array.isArray(analyzedArticles)) {
    throw new TypeError(
      "Analyzed articles must be an array.",
    );
  }

  if (!Array.isArray(pickSequence)) {
    throw new TypeError(
      "Pick sequence must be an array.",
    );
  }

  const sequenceByLocationCode = new Map(
    pickSequence.map((item) => [
      item.location.locationCode,
      item,
    ]),
  );

  return analyzedArticles.map(
    (article) => {
      const positionedPickLocations =
        article.pickLocations.map(
          (location) => {
            const sequence =
              sequenceByLocationCode.get(
                location.locationCode,
              );

            if (!sequence) {
              return {
                location,
                pickSequence: null,
                totalPickLocations: null,
                relativePickPosition: null,
              };
            }

            return {
              location,

              pickSequence:
                sequence.pickSequence,

              totalPickLocations:
                sequence.totalPickLocations,

              relativePickPosition:
                sequence.relativePickPosition,
            };
          },
        );

      return {
        ...article,
        positionedPickLocations,
      };
    },
  );
}