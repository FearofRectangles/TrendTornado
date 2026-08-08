export class PickHistoryRecord {
  constructor({
    postingDate,
    documentNumber,
    articleNumber,
    pickedQuantity,
  }) {
    this.#assertPostingDate(postingDate);
    this.#assertDocumentNumber(documentNumber);
    this.#assertArticleNumber(articleNumber);
    this.#assertQuantity(pickedQuantity);

    this.postingDate = postingDate;
    this.documentNumber = documentNumber;
    this.articleNumber = articleNumber;
    this.pickedQuantity = pickedQuantity;
  }

  #assertPostingDate(date) {
    if (!(date instanceof Date)) {
      throw new Error("Posting date must be a Date.");
    }
  }

  #assertDocumentNumber(documentNumber) {
    if (!documentNumber) {
      throw new Error("Document number is required.");
    }
  }

  #assertArticleNumber(articleNumber) {
    if (!articleNumber) {
      throw new Error("Article number is required.");
    }
  }

  #assertQuantity(quantity) {
    if (quantity <= 0) {
      throw new Error("Picked quantity must be greater than zero.");
    }
  }
}