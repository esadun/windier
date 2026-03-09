const LOCATIONS = [
  { name: "Roscomare Rd", lat: 34.1196, lon: -118.4635 },
  { name: "E. Greystone Ave", lat: 34.1573, lon: -118.0006 },
];

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function degreesToCompass(deg) {
  const idx = Math.round(deg / 22.5) % 16;
  return COMPASS[idx];
}

function buildUrl(loc) {
  const params = new URLSearchParams({
    latitude: loc.lat,
    longitude: loc.lon,
    current: "wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    hourly: "wind_speed_10m,wind_gusts_10m",
    wind_speed_unit: "mph",
    temperature_unit: "fahrenheit",
    timezone: "America/Los_Angeles",
    past_hours: 24,
    forecast_hours: 0,
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

async function fetchAll() {
  const responses = await Promise.all(LOCATIONS.map((loc) => fetch(buildUrl(loc))));
  const data = await Promise.all(responses.map((r) => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  }));
  return data;
}

function renderCurrent(data) {
  const winds = data.map((d) => d.current.wind_speed_10m);
  const gusts = data.map((d) => d.current.wind_gusts_10m);
  const dirs = data.map((d) => d.current.wind_direction_10m);

  data.forEach((d, i) => {
    document.getElementById(`wind-${i}`).textContent = winds[i].toFixed(1);
    document.getElementById(`gust-${i}`).textContent = gusts[i].toFixed(1);
    document.getElementById(`dir-${i}`).textContent = degreesToCompass(dirs[i]);
  });

  // Determine winner by sustained wind, break ties with gusts
  let winnerIdx = null;
  if (winds[0] !== winds[1]) {
    winnerIdx = winds[0] > winds[1] ? 0 : 1;
  } else if (gusts[0] !== gusts[1]) {
    winnerIdx = gusts[0] > gusts[1] ? 0 : 1;
  }

  document.getElementById("card-0").classList.toggle("winner", winnerIdx === 0);
  document.getElementById("card-1").classList.toggle("winner", winnerIdx === 1);

  document.getElementById("last-updated").textContent =
    `Updated ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function renderHistory(data) {
  const times = data[0].hourly.time;
  const winds = data.map((d) => d.hourly.wind_speed_10m);
  const gusts = data.map((d) => d.hourly.wind_gusts_10m);

  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "";

  let wins = [0, 0];

  // Show most recent first
  for (let i = times.length - 1; i >= 0; i--) {
    const time = new Date(times[i]);
    const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    const w0 = winds[0][i];
    const w1 = winds[1][i];
    const g0 = gusts[0][i];
    const g1 = gusts[1][i];

    let hourWinner = null;
    if (w0 !== w1) {
      hourWinner = w0 > w1 ? 0 : 1;
    } else if (g0 !== g1) {
      hourWinner = g0 > g1 ? 0 : 1;
    }
    if (hourWinner !== null) wins[hourWinner]++;

    const tr = document.createElement("tr");

    const tdTime = document.createElement("td");
    tdTime.textContent = timeStr;
    tr.appendChild(tdTime);

    const tdLoc0 = document.createElement("td");
    tdLoc0.textContent = `${w0.toFixed(1)} / ${g0.toFixed(1)}`;
    if (hourWinner === 0) tdLoc0.classList.add("cell-winner-0");
    tr.appendChild(tdLoc0);

    const tdLoc1 = document.createElement("td");
    tdLoc1.textContent = `${w1.toFixed(1)} / ${g1.toFixed(1)}`;
    if (hourWinner === 1) tdLoc1.classList.add("cell-winner-1");
    tr.appendChild(tdLoc1);

    tbody.appendChild(tr);
  }

  const summary = document.getElementById("history-summary");
  summary.textContent =
    `Past 24h: ${LOCATIONS[0].name} windier ${wins[0]}h \u2014 ${LOCATIONS[1].name} windier ${wins[1]}h`;
}

const COLORS = ["#e67e22", "#2980b9"];

function renderChart(data) {
  const canvas = document.getElementById("wind-chart");
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = container.clientWidth * dpr;
  canvas.height = container.clientHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const w = container.clientWidth;
  const h = container.clientHeight;
  const barH = 6;
  const barGap = 6;
  const pad = { top: barH + barGap + 4, right: 10, bottom: 20, left: 44 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const times = data[0].hourly.time;
  const winds = data.map((d) => d.hourly.wind_speed_10m);
  const allVals = winds.flat();
  const maxVal = Math.ceil(Math.max(...allVals) / 5) * 5 || 10;

  ctx.clearRect(0, 0, w, h);

  // Winner bar above chart — each segment centered on its data point
  const step = plotW / (times.length - 1);
  for (let i = 0; i < times.length; i++) {
    const w0 = winds[0][i];
    const w1 = winds[1][i];
    let color = null;
    if (w0 > w1) color = COLORS[0];
    else if (w1 > w0) color = COLORS[1];
    if (color) {
      const cx = pad.left + (i / (times.length - 1)) * plotW;
      const x1 = i === 0 ? cx : cx - step / 2;
      const x2 = i === times.length - 1 ? cx : cx + step / 2;
      const rLeft = i === 0 ? 3 : 0;
      const rRight = i === times.length - 1 ? 3 : 0;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x1, 0, x2 - x1 + 0.5, barH, [rLeft, rRight, rRight, rLeft]);
      ctx.fill();
    }
  }

  // Y-axis label (rotated)
  ctx.save();
  ctx.translate(10, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "9px -apple-system, sans-serif";
  ctx.fillStyle = "#bbb";
  ctx.fillText("sustained wind (mph)", 0, 0);
  ctx.restore();

  // Y-axis gridlines and labels
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = "10px -apple-system, sans-serif";
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (maxVal / ySteps) * i;
    const y = pad.top + plotH - (i / ySteps) * plotH;
    ctx.fillStyle = "#ccc";
    ctx.fillText(Math.round(val), pad.left - 6, y);
    if (i > 0) {
      ctx.strokeStyle = "#f0f0f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }
  }

  // X-axis time labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ccc";
  const labelCount = Math.min(6, times.length);
  const labelStep = Math.floor((times.length - 1) / (labelCount - 1));
  for (let i = 0; i < times.length; i += labelStep) {
    const x = pad.left + (i / (times.length - 1)) * plotW;
    const t = new Date(times[i]);
    const label = t.toLocaleTimeString("en-US", { hour: "numeric" });
    ctx.fillText(label, x, pad.top + plotH + 4);
  }

  // Draw lines
  winds.forEach((series, si) => {
    ctx.strokeStyle = COLORS[si];
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    series.forEach((val, i) => {
      const x = pad.left + (i / (series.length - 1)) * plotW;
      const y = pad.top + plotH - (val / maxVal) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

async function update() {
  try {
    const data = await fetchAll();
    renderCurrent(data);
    renderChart(data);
    renderHistory(data);
  } catch (err) {
    console.error("Failed to fetch wind data:", err);
    document.getElementById("last-updated").textContent = `Error: ${err.message}`;
  }
}

// History toggle
document.getElementById("toggle-history").addEventListener("click", () => {
  const el = document.getElementById("history");
  const arrow = document.getElementById("toggle-arrow");
  const isHidden = el.hidden;
  el.hidden = !isHidden;
  arrow.classList.toggle("open", isHidden);
});

// Initial load + auto-refresh
update();
setInterval(update, REFRESH_INTERVAL_MS);
