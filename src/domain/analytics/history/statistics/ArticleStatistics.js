export class ArticleStatistics {
  constructor({
    articleNumber,
    periodStart,
    periodEnd,
    pickFrequency,
    pickedQuantity,
  }) {
    this.#assertArticleNumber(articleNumber);
    this.#assertPeriod(periodStart, periodEnd);
    this.#assertPickFrequency(pickFrequency);
    this.#assertPickedQuantity(pickedQuantity);

    this.articleNumber = articleNumber;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
    this.pickFrequency = pickFrequency;
    this.pickedQuantity = pickedQuantity;

    Object.freeze(this);
  }

  get averageQuantityPerPick() {
    if (this.pickFrequency === 0) {
      return 0;
    }

    return this.pickedQuantity / this.pickFrequency;
  }

  #assertArticleNumber(articleNumber) {
    if (
      typeof articleNumber !== "string" ||
      articleNumber.trim() === ""
    ) {
      throw new Error("Article number is required.");
    }
  }

  #assertPeriod(periodStart, periodEnd) {
    if (!(periodStart instanceof Date) || !(periodEnd instanceof Date)) {
      throw new Error("Statistics period must use valid Date objects.");
    }

    if (periodStart > periodEnd) {
      throw new Error("Period start cannot be after period end.");
    }
  }

  #assertPickFrequency(pickFrequency) {
    if (!Number.isInteger(pickFrequency) || pickFrequency < 0) {
      throw new Error(
        "Pick frequency must be a non-negative integer.",
      );
    }
  }

  #assertPickedQuantity(pickedQuantity) {
    if (!Number.isFinite(pickedQuantity) || pickedQuantity < 0) {
      throw new Error(
        "Picked quantity must be a non-negative number.",
      );
    }
  }
}