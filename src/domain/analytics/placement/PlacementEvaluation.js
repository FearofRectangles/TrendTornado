export class PlacementEvaluation {
  constructor({
    articleNumber,
    frequencyScore,
    handlingScore,
    averageHandledWeightPerPick,
    priorityScore,
    currentPosition,
    desiredPosition,
    placementGap,
  }) {
    this.articleNumber = articleNumber;

    this.frequencyScore =
      frequencyScore;

    this.handlingScore =
      handlingScore;

    this.averageHandledWeightPerPick =
      averageHandledWeightPerPick;

    this.priorityScore =
      priorityScore;

    this.currentPosition =
      currentPosition;

    this.desiredPosition =
      desiredPosition;

    this.placementGap =
      placementGap;

    Object.freeze(this);
  }
}