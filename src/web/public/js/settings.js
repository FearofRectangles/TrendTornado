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
