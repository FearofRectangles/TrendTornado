const frequencyWeight = document.getElementById("frequencyWeight");
const handlingWeight = document.getElementById("handlingWeight");
const weightTotal = document.getElementById("weightTotal");
const saveButton = document.getElementById("saveSettings");

function updateWeightTotal() {
  const total = Number(frequencyWeight.value) + Number(handlingWeight.value);
  const valid = Number.isFinite(total) && total === 100;
  weightTotal.textContent = `${total} %`;
  weightTotal.classList.toggle("invalid", !valid);
  saveButton.disabled = !valid;
  weightTotal.setAttribute("aria-label", valid ? "Vikterna summerar till 100 procent" : "Vikterna måste summera till 100 procent");
}

frequencyWeight.addEventListener("input", updateWeightTotal);
handlingWeight.addEventListener("input", updateWeightTotal);
updateWeightTotal();

const pickAreaRows = document.getElementById("pickAreaRows");
const addPickArea = document.getElementById("addPickArea");

addPickArea?.addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "pick-area-row";
  row.innerHTML = `
    <input type="hidden" name="originalName" value="">
    <input name="pickAreaName" type="text" maxlength="40" placeholder="NAMN" required>
    <input name="pickAreaColor" type="color" value="#4d9b5e" aria-label="Färg för nytt plockområde">
    <button class="remove-pick-area" type="button" aria-label="Ta bort plockområde">×</button>
  `;
  pickAreaRows.append(row);
  row.querySelector('[name="pickAreaName"]').focus();
});

pickAreaRows?.addEventListener("click", (event) => {
  const removeButton = event.target.closest(".remove-pick-area");
  if (!removeButton) return;
  if (pickAreaRows.children.length === 1) {
    window.alert("Minst ett plockområde måste finnas kvar.");
    return;
  }
  removeButton.closest(".pick-area-row").remove();
});

const articleRuleRows = document.getElementById("articleRuleRows");
document.getElementById("addArticleRule")?.addEventListener("click", () => {
  const row = document.createElement("div");
  row.className = "article-rule-row";
  row.innerHTML = `<input name="articleNumber" type="text" placeholder="Artikelnummer" required><select name="ruleMode"><option value="ANALYSIS">Exkludera från analys och statistik</option><option value="RELOCATION">Dölj endast som flyttkandidat</option><option value="BOTH">Båda</option></select><button class="remove-article-rule" type="button" aria-label="Ta bort artikelundantag">×</button>`;
  articleRuleRows.append(row);
  row.querySelector("input").focus();
});
articleRuleRows?.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-article-rule");
  if (button) button.closest(".article-rule-row").remove();
});

document.querySelectorAll(".source-upload").forEach((upload) => {
  const fileInput = upload.querySelector(".source-file");
  const dateInput = upload.querySelector(".source-effective-date");
  const button = upload.querySelector(".source-upload-button");
  const status = upload.querySelector(".source-upload-status");
  button.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      status.textContent = "Välj en CSV-fil först.";
      return;
    }
    button.disabled = true;
    status.textContent = "Validerar och importerar…";
    try {
      const response = await fetch("/settings/data-sources/import", {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          "X-Source-Type": upload.dataset.sourceType,
          "X-File-Name": encodeURIComponent(file.name),
          "X-Effective-At": dateInput?.value ?? "",
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Importen misslyckades.");
      window.location.assign(result.redirect);
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
    }
  });
});
