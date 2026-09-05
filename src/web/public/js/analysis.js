const canvas = document.getElementById("priorityScatter");
const tooltip = document.getElementById("scatterTooltip");
const points = JSON.parse(document.getElementById("scatterData")?.textContent ?? "[]");
const context = canvas.getContext("2d");
const padding = { top: 22, right: 20, bottom: 34, left: 42 };
let renderedPoints = [];

function colorFor(point) {
  if (!point.candidate) return "rgba(118, 132, 122, .38)";
  return point.placementGap >= 0 ? "rgba(22, 130, 74, .72)" : "rgba(223, 113, 22, .72)";
}

function draw() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * ratio);
  canvas.height = Math.round(bounds.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  const width = bounds.width - padding.left - padding.right;
  const height = bounds.height - padding.top - padding.bottom;

  context.strokeStyle = "#e8eee9";
  context.lineWidth = 1;
  context.fillStyle = "#7b867e";
  context.font = "9px system-ui";
  context.textAlign = "right";
  for (let step = 0; step <= 4; step += 1) {
    const y = padding.top + height - (height * step / 4);
    context.beginPath(); context.moveTo(padding.left, y); context.lineTo(padding.left + width, y); context.stroke();
    context.fillText(`${step * 25} %`, padding.left - 8, y + 3);
  }
  context.textAlign = "center";
  for (let step = 0; step <= 4; step += 1) {
    const x = padding.left + width * step / 4;
    context.fillText(`${step * 25} %`, x, padding.top + height + 20);
  }

  renderedPoints = points.map((point) => {
    const x = padding.left + point.currentPosition * width;
    const y = padding.top + (1 - point.priorityScore) * height;
    context.beginPath();
    context.arc(x, y, point.candidate ? 3.1 : 2.1, 0, Math.PI * 2);
    context.fillStyle = colorFor(point);
    context.fill();
    return { ...point, x, y };
  });
}

function nearestPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  let nearest = null;
  let distance = 10;
  for (const point of renderedPoints) {
    const candidateDistance = Math.hypot(point.x - x, point.y - y);
    if (candidateDistance < distance) { nearest = point; distance = candidateDistance; }
  }
  return { nearest, x, y };
}

canvas.addEventListener("mousemove", (event) => {
  const { nearest, x, y } = nearestPoint(event);
  if (!nearest) { tooltip.hidden = true; return; }
  tooltip.textContent = `${nearest.articleNumber} · ${nearest.name} — position ${(nearest.currentPosition * 100).toFixed(1)} %, prioritet ${nearest.priorityScore.toFixed(2)}`;
  tooltip.style.left = `${Math.min(x + 12, canvas.clientWidth - 230)}px`;
  tooltip.style.top = `${Math.max(5, y - 38)}px`;
  tooltip.hidden = false;
});
canvas.addEventListener("mouseleave", () => { tooltip.hidden = true; });
new ResizeObserver(draw).observe(canvas);
draw();
