const pairKey = (left, right) => [String(left), String(right)].sort().join("\u0000");
const clamp = (value) => Math.max(0, Math.min(1, value));

function observedWeeks(records) {
  if (!records.length) return 1;
  let first = Infinity;
  let last = -Infinity;
  for (const record of records) {
    const value = record.occurredAt.getTime();
    first = Math.min(first, value);
    last = Math.max(last, value);
  }
  return Math.max(1, (last - first) / (7 * 86400000) + 1 / 7);
}

export class RelocationBundleEngine {
  static analyze({ movementRecords = [], positionedArticles = [], evaluations = [], movementThreshold = 0.2, secondsPerFullSpan = 0 }) {
    const positions = new Map();
    for (const article of positionedArticles) {
      const positioned = article.positionedPickLocations?.[0];
      if (!positioned || !Number.isFinite(positioned.relativePickPosition)) continue;
      positions.set(String(article.articleNumber), {
        current: positioned.relativePickPosition,
        pickZone: positioned.location.pickZoneType,
      });
    }

    const candidates = new Map(evaluations
      .filter((evaluation) => Math.abs(evaluation.placementGap) >= movementThreshold && positions.has(String(evaluation.articleNumber)))
      .map((evaluation) => [String(evaluation.articleNumber), evaluation]));
    const groups = new Map();
    for (const record of movementRecords) {
      const key = `${record.orderNumber}\u0000${record.worker}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }

    const edges = new Map();
    const incident = new Map();
    const edgeKeysByArticle = new Map();
    for (const records of groups.values()) {
      const ordered = records.toSorted((left, right) => left.occurredAt - right.occurredAt);
      for (let index = 1; index < ordered.length; index += 1) {
        const from = ordered[index - 1];
        const to = ordered[index];
        const seconds = (to.occurredAt - from.occurredAt) / 1000;
        const fromPosition = positions.get(String(from.articleNumber));
        const toPosition = positions.get(String(to.articleNumber));
        if (seconds < 2 || seconds > 300 || !fromPosition || !toPosition || fromPosition.pickZone !== toPosition.pickZone || from.articleNumber === to.articleNumber) continue;
        const key = pairKey(from.articleNumber, to.articleNumber);
        edges.set(key, (edges.get(key) ?? 0) + 1);
        for (const articleNumber of [String(from.articleNumber), String(to.articleNumber)]) {
          if (!edgeKeysByArticle.has(articleNumber)) edgeKeysByArticle.set(articleNumber, new Set());
          edgeKeysByArticle.get(articleNumber).add(key);
        }
        incident.set(String(from.articleNumber), (incident.get(String(from.articleNumber)) ?? 0) + 1);
        incident.set(String(to.articleNumber), (incident.get(String(to.articleNumber)) ?? 0) + 1);
      }
    }

    const routeDelta = (moved) => {
      let delta = 0;
      const relevantEdges = new Set();
      for (const articleNumber of moved.keys()) {
        for (const key of edgeKeysByArticle.get(articleNumber) ?? []) relevantEdges.add(key);
      }
      for (const key of relevantEdges) {
        const count = edges.get(key);
        const [left, right] = key.split("\u0000");
        if (!moved.has(left) && !moved.has(right)) continue;
        const leftPosition = positions.get(left).current;
        const rightPosition = positions.get(right).current;
        const nextLeft = moved.get(left) ?? leftPosition;
        const nextRight = moved.get(right) ?? rightPosition;
        delta += count * (Math.abs(nextLeft - nextRight) - Math.abs(leftPosition - rightPosition));
      }
      return delta;
    };

    const weeks = observedWeeks(movementRecords);
    const proposals = [];
    for (const [key, sharedTransitions] of edges) {
      const [left, right] = key.split("\u0000");
      const leftEvaluation = candidates.get(left);
      const rightEvaluation = candidates.get(right);
      const leftPosition = positions.get(left);
      const rightPosition = positions.get(right);
      if (!leftEvaluation || !rightEvaluation || leftPosition.pickZone !== rightPosition.pickZone || sharedTransitions < 5) continue;
      const soloLeftDelta = routeDelta(new Map([[left, leftEvaluation.desiredPosition]]));
      const soloRightDelta = routeDelta(new Map([[right, rightEvaluation.desiredPosition]]));
      const jointDelta = routeDelta(new Map([
        [left, leftEvaluation.desiredPosition],
        [right, rightEvaluation.desiredPosition],
      ]));
      if (jointDelta >= -0.01 || (soloLeftDelta <= 0 && soloRightDelta <= 0)) continue;
      const affinity = sharedTransitions / Math.max(1, Math.min(incident.get(left) ?? 0, incident.get(right) ?? 0));
      const minutesSavedPerWeek = secondsPerFullSpan > 0 ? (-jointDelta * secondsPerFullSpan) / (60 * weeks) : null;
      const routeGain = clamp(-jointDelta / Math.max(1, sharedTransitions));
      const activity = clamp((leftEvaluation.frequencyScore + rightEvaluation.frequencyScore) / 2);
      const gap = clamp((Math.abs(leftEvaluation.placementGap) + Math.abs(rightEvaluation.placementGap)) / 2);
      const score = Math.round(100 * (0.4 * routeGain + 0.25 * affinity + 0.2 * activity + 0.15 * gap));
      proposals.push({
        id: `${left}-${right}`,
        articleNumbers: [left, right],
        pickZone: leftPosition.pickZone,
        sharedTransitions,
        transitionsPerWeek: sharedTransitions / weeks,
        affinity,
        currentSeparation: Math.abs(leftPosition.current - rightPosition.current),
        proposedSeparation: Math.abs(leftEvaluation.desiredPosition - rightEvaluation.desiredPosition),
        jointSpanDelta: jointDelta,
        soloSpanDelta: { [left]: soloLeftDelta, [right]: soloRightDelta },
        minutesSavedPerWeek,
        score,
        label: score >= 70 ? "HÖG" : score >= 45 ? "MEDEL" : "LÅG",
        reason: "Flytta båda tillsammans. Minst en av flyttarna försämrar rutten om den genomförs ensam.",
      });
    }

    const used = new Set();
    return proposals
      .toSorted((left, right) => (right.minutesSavedPerWeek ?? -right.jointSpanDelta) - (left.minutesSavedPerWeek ?? -left.jointSpanDelta) || right.score - left.score)
      .filter((proposal) => {
        if (proposal.articleNumbers.some((articleNumber) => used.has(articleNumber))) return false;
        proposal.articleNumbers.forEach((articleNumber) => used.add(articleNumber));
        return true;
      });
  }
}
