export class PlacementEvaluation {
  constructor({
    articleNumber,
    frequencyScore,
    weightScore,
    priorityScore,
    currentPosition,
    desiredPosition,
    placementGap,
  }) {
    this.articleNumber = articleNumber;
    this.frequencyScore = frequencyScore;
    this.weightScore = weightScore;
    this.priorityScore = priorityScore;
    this.currentPosition = currentPosition;
    this.desiredPosition = desiredPosition;
    this.placementGap = placementGap;

    Object.freeze(this);
  }
}