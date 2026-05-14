// =============================
// CONFIG (GitHub Pages friendly)
// =============================
const CSV_PATH = "data/nt_crime_statistics_dec_2025_FACT_OFFENCES.csv";
const SA2_GEOJSON = "data/nt_sa2.geojson";
const REG_GEOJSON = "data/nt_regions.geojson";

const LOCATIONS = [
  "All NT",
  "SA2 View",
  "Darwin",
  "Palmerston",
  "Alice Springs",
  "Katherine",
  "Tennant Creek",
  "Nhulunbuy",
  "NT Balance"
];

// =============================
// GLOBALS
// =============================
let DATA_ROWS = [];
let YM_LIST = [];
let OFFENCES = ["All offences"];

let map;
let policeLayer;
let policeVisible = true;

let sa2Geo = null;
let regGeo = null;

let sa2Layer = null;
let outlineLayer = null;

let chart2;
let chart3;
let chart4;
let hasPopulation = false;

const policeStations = [
  { name: "Darwin Police Station", lat: -12.4634, lon: 130.8456 },
  { name: "Palmerston Police Station", lat: -12.4860, lon: 130.9833 },
  { name: "Alice Springs Police Station", lat: -23.6980, lon: 133.8807 },
  { name: "Katherine Police Station", lat: -14.4650, lon: 132.2635 },
  { name: "Tennant Creek Police Station", lat: -19.6490, lon: 134.1910 },
  { name: "Nhulunbuy Police Station", lat: -12.1800, lon: 136.7800 }
];

const BLUE_SHADES = [
  "#1f3b73",
  "#3b82f6",
  "#06b6d4",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#6366f1",
  "#14b8a6",
  "#0ea5e9",
  "#8b5cf6"
];

// =============================
// HELPERS
// =============================
function setInfo(html) {
  document.getElementById("info").innerHTML = html || "Hover over an area";
}

function toNum(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}

function ymToIndex(ym) {
  const y = Number(String(ym).slice(0, 4));
  const m = Number(String(ym).slice(5, 7));
  return y * 12 + (m - 1);
}

function indexToYM(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function inRange(r, startYM, endYM) {
  const ym = String(r.year_month || "");
  if (!ym || ym.length < 7) return false;

  const idx = ymToIndex(ym);
  return idx >= ymToIndex(startYM) && idx <= ymToIndex(endYM);
}

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

function matchRegion(reportingRegion, selectedLocation) {
  const rr = normalize(reportingRegion);
  const loc = normalize(selectedLocation);

  if (loc === "all nt" || loc === "sa2 view") return true;
  if (rr === loc) return true;
  if (rr.includes(loc)) return true;
  if (loc === "alice springs" && rr.includes("alice")) return true;
  if (loc === "nt balance" && (rr.includes("balance") || rr.includes("other"))) return true;

  return false;
}

function passFilters(r, f) {
  if (!matchRegion(r.reporting_region, f.location)) return false;
  if (f.offence !== "All offences" && r.offence_type !== f.offence) return false;
  if (!inRange(r, f.startYM, f.endYM)) return false;

  return true;
}

function setBadge(el, pct, up) {
  el.textContent = (up ? "▲ " : "▼ ") + pct.toFixed(2) + "%";

  if (up) {
    el.style.background = "#ffe5e5";
    el.style.color = "#b00020";
  } else {
    el.style.background = "#e6f7ea";
    el.style.color = "#1b5e20";
  }
}

// =============================
// LOAD DATA
// =============================
async function loadCSV() {
  const res = await fetch(CSV_PATH);
  const csvText = await res.text();

  const parsed = Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  });

  const popKey = parsed.meta.fields?.find(f => normalize(f) === "population") || null;
  hasPopulation = !!popKey;

  DATA_ROWS = parsed.data
    .filter(r => String(r.year_month || "").match(/^\d{4}-\d{2}$/))
    .map(r => ({
      reporting_region: String(r.reporting_region || "").trim(),
      offence_type: String(r.offence_type || "").trim(),
      year_month: String(r.year_month || "").trim(),
      offence_count: toNum(r.offence_count, 0),
      alcohol_flag: toNum(r.alcohol_flag, 0),
      population: popKey ? toNum(r[popKey], 0) : null
    }));

  OFFENCES = ["All offences"].concat(
    [...new Set(DATA_ROWS.map(r => r.offence_type).filter(x => x))]
      .sort((a, b) => a.localeCompare(b))
  );

  YM_LIST = [...new Set(DATA_ROWS.map(r => r.year_month))].sort();

  const maxYM = YM_LIST[YM_LIST.length - 1];
  document.getElementById("asAt").textContent = "As at: " + maxYM;
}

async function loadGeo() {
  const [sa2Res, regRes] = await Promise.all([
    fetch(SA2_GEOJSON),
    fetch(REG_GEOJSON)
  ]);

  sa2Geo = await sa2Res.json();
  regGeo = await regRes.json();
}

// =============================
// CONTROLS
// =============================
function initControls() {
  const locationSelect = document.getElementById("locationSelect");
  const offenceSelect = document.getElementById("offenceSelect");
  const startSelect = document.getElementById("startSelect");
  const endSelect = document.getElementById("endSelect");

  locationSelect.innerHTML = "";
  offenceSelect.innerHTML = "";
  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  LOCATIONS.forEach(x => {
    const opt = document.createElement("option");
    opt.value = x;
    opt.textContent = x;
    locationSelect.appendChild(opt);
  });

  OFFENCES.forEach(x => {
    const opt = document.createElement("option");
    opt.value = x;
    opt.textContent = x;
    offenceSelect.appendChild(opt);
  });

  YM_LIST.forEach(ym => {
    const a = document.createElement("option");
    a.value = ym;
    a.textContent = ym;
    startSelect.appendChild(a);

    const b = document.createElement("option");
    b.value = ym;
    b.textContent = ym;
    endSelect.appendChild(b);
  });

  const maxYM = YM_LIST[YM_LIST.length - 1];
  const latestYear = String(maxYM).slice(0, 4);
  const defaultStart = `${latestYear}-01`;

  startSelect.value = YM_LIST.includes(defaultStart) ? defaultStart : YM_LIST[0];
  endSelect.value = maxYM;

  function clamp() {
    const sIdx = ymToIndex(startSelect.value);
    const eIdx = ymToIndex(endSelect.value);

    if (eIdx < sIdx) {
      endSelect.value = startSelect.value;
    }
  }

  startSelect.addEventListener("change", () => {
    clamp();
    applyFilters();
  });

  endSelect.addEventListener("change", () => {
    clamp();
    applyFilters();
  });

  locationSelect.addEventListener("change", applyFilters);
  offenceSelect.addEventListener("change", applyFilters);

  locationSelect.value = "SA2 View";
  offenceSelect.value = "All offences";

  document.getElementById("togglePopulationChart").addEventListener("click", () => {
    const popCard = document.getElementById("populationCard");
    const btn = document.getElementById("togglePopulationChart");
    const isCollapsed = popCard.classList.contains("collapsed");
    const targetY = popCard.getBoundingClientRect().top + window.scrollY - 20;

    if (isCollapsed) {
      popCard.classList.remove("collapsed");
      popCard.style.maxHeight = "0px";

      window.requestAnimationFrame(() => {
        popCard.style.maxHeight = `${popCard.scrollHeight}px`;
      });

      btn.classList.add("open");
      btn.textContent = "Hide population compare";
    } else {
      popCard.style.maxHeight = `${popCard.scrollHeight}px`;

      window.requestAnimationFrame(() => {
        popCard.classList.add("collapsed");
        popCard.style.maxHeight = "0px";
      });

      btn.classList.remove("open");
      btn.textContent = "Show population compare";
    }

    popCard.addEventListener("transitionend", function finish() {
      if (!popCard.classList.contains("collapsed")) {
        popCard.style.maxHeight = "";

        if (chart4) {
          chart4.resize();
          chart4.update();
        }

        window.setTimeout(() => {
          const startY = window.scrollY;
          const duration = 800;
          const startTime = performance.now();

          function scrollStep(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease =
              progress < 0.5
                ? 2 * progress * progress
                : -1 + (4 - 2 * progress) * progress;

            window.scrollTo(0, startY + (targetY - startY) * ease);

            if (elapsed < duration) {
              requestAnimationFrame(scrollStep);
            }
          }

          requestAnimationFrame(scrollStep);
        }, 50);
      }

      popCard.removeEventListener("transitionend", finish);
    });
  });
}

// =============================
// MAP
// =============================
function initMap() {
  map = L.map("map").setView([-19, 133], 6);
  map.createPane("regionPane");
  map.getPane("regionPane").style.zIndex = 450;
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap & CartoDB"
  }).addTo(map);

  policeLayer = L.layerGroup();

  policeStations.forEach(st => {
    L.marker([st.lat, st.lon])
      .bindTooltip(st.name)
      .addTo(policeLayer);
  });

  policeLayer.addTo(map);
}

function togglePolice() {
  if (policeVisible) {
    map.removeLayer(policeLayer);
  } else {
    policeLayer.addTo(map);
  }

  policeVisible = !policeVisible;
}

function drawSA2(filters) {
  if (sa2Layer) {
    map.removeLayer(sa2Layer);
  }

  const isRegion = filters.location !== "All NT" && filters.location !== "SA2 View";
  const selected = filters.location;

  const filteredFeatures = (sa2Geo.features || []).filter(ft => {
    const reg = ft.properties?.Region || ft.properties?.RegionGroup || "";

    if (!isRegion) return true;

    return normalize(reg) === normalize(selected);
  });

  const sa2Filtered = {
    type: "FeatureCollection",
    features: filteredFeatures
  };

  sa2Layer = L.geoJSON(sa2Filtered, {
    style: feature => ({
      color: "#111827",
      weight: 0.8,
      fillColor: feature.properties?.base_color || "#93c5fd",
      fillOpacity: 0.45
    }),

    onEachFeature: (feature, layer) => {
      const name =
        feature.properties?.SA2_NAME21 ||
        feature.properties?.SA2_NAME_2021 ||
        "SA2";

      layer.on({
        mouseover: e => {
          e.target.setStyle({
            weight: 2,
            fillOpacity: 0.7
          });

          setInfo(`<b>SA2:</b> ${name}`);
        },

        mouseout: e => {
          sa2Layer.resetStyle(e.target);
          setInfo();
        }
      });
    }
  }).addTo(map);

  if (filteredFeatures.length) {
    if (normalize(filters.location) === "darwin") {
      map.setView([-12.420000, 130.94000], 11.7);
    } else {
      map.fitBounds(sa2Layer.getBounds());
    }
  }
}

function drawRegionOutline(filters) {
  if (outlineLayer) {
    map.removeLayer(outlineLayer);
  }

  const isRegion = filters.location !== "All NT" && filters.location !== "SA2 View";
  if (!isRegion) return;

  const selected = filters.location;

  const filteredRegions = (regGeo.features || []).filter(f => {
    const region = f.properties?.Region || f.properties?.RegionGroup || "";
    return normalize(region) === normalize(selected);
  });

  if (!filteredRegions.length) return;

  outlineLayer = L.geoJSON(
    {
      type: "FeatureCollection",
      features: filteredRegions
    },
    {
      pane: "regionPane",

      style: () => ({
        color: "#0b2f6b",
        weight: 4,
        fillColor: "#60a5fa",
        fillOpacity: 0.05
      }),

      onEachFeature: (feature, layer) => {
        const regionName =
          feature.properties?.Region ||
          feature.properties?.RegionGroup ||
          selected;

        layer.on({
          mouseover: e => {
            e.target.setStyle({
              weight: 6,
              fillOpacity: 0.12
            });

            setInfo(`<b>Region:</b> ${regionName}`);
          },

          mouseout: e => {
            outlineLayer.resetStyle(e.target);
            setInfo();
          },

          click: e => {
            map.fitBounds(e.target.getBounds());
          }
        });
      }
    }
  ).addTo(map);
}

// =============================
// KPI + CHARTS
// =============================
function sumMonth(rows, f, monthYM, alcoholOnly = false) {
  let total = 0;

  for (const r of rows) {
    if (!matchRegion(r.reporting_region, f.location)) continue;
    if (f.offence !== "All offences" && r.offence_type !== f.offence) continue;
    if (String(r.year_month) !== String(monthYM)) continue;
    if (alcoholOnly && toNum(r.alcohol_flag) !== 1) continue;

    total += toNum(r.offence_count);
  }

  return total;
}

function updateKPI(filters) {
  const totCountEl = document.getElementById("totCount");
  const totBadgeEl = document.getElementById("totBadge");
  const totSubEl = document.getElementById("totSub");

  const alcCountEl = document.getElementById("alcCount");
  const alcBadgeEl = document.getElementById("alcBadge");
  const alcSubEl = document.getElementById("alcSub");

  const startYM = filters.startYM;
  const endYM = filters.endYM;

  const totStart = sumMonth(DATA_ROWS, filters, startYM, false);
  const totEnd = sumMonth(DATA_ROWS, filters, endYM, false);

  totCountEl.textContent = totEnd.toLocaleString();

  if (totStart <= 0 && totEnd <= 0) {
    totBadgeEl.textContent = "No data";
    totBadgeEl.style.background = "#f0f0f0";
    totBadgeEl.style.color = "#333";
    totSubEl.textContent = `No offences found in ${startYM} and ${endYM}.`;
  } else if (totStart <= 0 && totEnd > 0) {
    totBadgeEl.textContent = "▲ increase";
    totBadgeEl.style.background = "#ffe5e5";
    totBadgeEl.style.color = "#b00020";
    totSubEl.textContent = `Start (${startYM}) = 0, End (${endYM}) = ${totEnd.toLocaleString()}`;
  } else {
    const pct = ((totEnd - totStart) / totStart) * 100;

    setBadge(totBadgeEl, Math.abs(pct), pct >= 0);

    totBadgeEl.textContent =
      (pct < 0 ? "▼ " : "▲ ") + Math.abs(pct).toFixed(2) + "%";

    totSubEl.textContent =
      `Start (${startYM}) = ${totStart.toLocaleString()} vs End (${endYM}) = ${totEnd.toLocaleString()}`;
  }

  const alcStart = sumMonth(DATA_ROWS, filters, startYM, true);
  const alcEnd = sumMonth(DATA_ROWS, filters, endYM, true);

  alcCountEl.textContent = alcEnd.toLocaleString();

  if (alcStart <= 0 && alcEnd <= 0) {
    alcBadgeEl.textContent = "No data";
    alcBadgeEl.style.background = "#f0f0f0";
    alcBadgeEl.style.color = "#333";
    alcSubEl.textContent = `No alcohol-involved offences in ${startYM} and ${endYM}.`;
  } else if (alcStart <= 0 && alcEnd > 0) {
    alcBadgeEl.textContent = "▲ increase";
    alcBadgeEl.style.background = "#ffe5e5";
    alcBadgeEl.style.color = "#b00020";
    alcSubEl.textContent = `Start (${startYM}) = 0, End (${endYM}) = ${alcEnd.toLocaleString()}`;
  } else {
    const pct = ((alcEnd - alcStart) / alcStart) * 100;

    setBadge(alcBadgeEl, Math.abs(pct), pct >= 0);

    alcBadgeEl.textContent =
      (pct < 0 ? "▼ " : "▲ ") + Math.abs(pct).toFixed(2) + "%";

    alcSubEl.textContent =
      `Start (${startYM}) = ${alcStart.toLocaleString()} vs End (${endYM}) = ${alcEnd.toLocaleString()}`;
  }
}

function buildTrend(filters) {
  const startIdx = ymToIndex(filters.startYM);
  const endIdx = ymToIndex(filters.endYM);

  const labels = [];
  const values = [];

  for (let idx = startIdx; idx <= endIdx; idx++) {
    labels.push(indexToYM(idx));
    values.push(0);
  }

  const pos = new Map(labels.map((x, i) => [x, i]));

  for (const r of DATA_ROWS) {
    if (!passFilters(r, filters)) continue;

    const ym = String(r.year_month || "");
    const i = pos.get(ym);

    if (i !== undefined) {
      values[i] += toNum(r.offence_count);
    }
  }

  return { labels, values };
}

function buildPopulationTrend(filters) {
  const startIdx = ymToIndex(filters.startYM);
  const endIdx = ymToIndex(filters.endYM);

  const labels = [];
  const values = [];

  for (let idx = startIdx; idx <= endIdx; idx++) {
    labels.push(indexToYM(idx));
    values.push(0);
  }

  const pos = new Map(labels.map((x, i) => [x, i]));

  for (const r of DATA_ROWS) {
    if (!passFilters(r, filters)) continue;

    const ym = String(r.year_month || "");
    const i = pos.get(ym);

    if (i !== undefined) {
      values[i] += toNum(r.population, 0);
    }
  }

  return { labels, values };
}

function buildDonut(filters, topN = 8) {
  const bucket = new Map();

  for (const r of DATA_ROWS) {
    const f3 = {
      ...filters,
      offence: "All offences"
    };

    if (!passFilters(r, f3)) continue;

    const k = r.offence_type || "(Unknown)";
    bucket.set(k, (bucket.get(k) || 0) + toNum(r.offence_count));
  }

  const sorted = Array.from(bucket.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const other = sorted.slice(topN).reduce((s, x) => s + x[1], 0);

  const labels = top.map(x => x[0]);
  const values = top.map(x => x[1]);

  if (other > 0) {
    labels.push("Other");
    values.push(other);
  }

  return { labels, values };
}

function initCharts() {
  const ctx2 = document.getElementById("chart2").getContext("2d");
  const ctx3 = document.getElementById("chart3").getContext("2d");

  chart2 = new Chart(ctx2, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Total offences",
          data: [],
          borderColor: "#1f77b4",
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  let chart3SelectedIndex = null;
  let chart3AnimProgress = 0;
  const FLOAT_OFFSET = 28;

  chart3 = new Chart(ctx3, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [],
          borderColor: "#fff",
          borderWidth: 2,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 500
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 18,
            font: {
              size: 13,
              weight: "500",
              family: "'Inter', system-ui, -apple-system, sans-serif"
            },
            usePointStyle: true,
            pointStyle: "circle",
            color: "#1f3b73",
            boxHeight: 10,
            boxWidth: 10,
            generateLabels: function(chart) {
              const data = chart.data;
              return data.labels.map((label, i) => ({
                text: label,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: data.datasets[0].borderColor,
                lineWidth: 1,
                hidden: false,
                index: i
              }));
            }
          }
        },
        tooltip: {
          backgroundColor: "rgba(31, 59, 115, 0.95)",
          padding: 14,
          titleFont: { size: 14, weight: "bold", color: "#fff" },
          bodyFont: { size: 13, color: "#fff" },
          borderColor: "#3b82f6",
          borderWidth: 2,
          displayColors: true,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const sum = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((context.parsed / sum) * 100).toFixed(1);
              return " " + context.label + ": " + context.parsed + " (" + pct + "%)";
            }
          }
        }
      },
      onClick: (evt, els) => {
        if (!els || !els.length) {
          chart3SelectedIndex = null;
          chart3AnimProgress = 0;
          chart3.update();
          return;
        }

        const idx = els[0].index;
        chart3SelectedIndex = chart3SelectedIndex === idx ? null : idx;
        chart3AnimProgress = 0;
        
        if (chart3SelectedIndex !== null) {
          const label = chart3.data.labels[idx];
          const offenceSelect = document.getElementById("offenceSelect");
          offenceSelect.value = label === "Other" ? "All offences" : label;
          applyFilters();
          animateChart3Floating();
        } else {
          chart3.update();
        }
      }
    },
    plugins: [{
      id: "chart3FloatingPlugin",
      afterDatasetsDraw(chart) {
        if (chart3SelectedIndex === null) return;

        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data || !meta.data.length) return;

        const canvasWidth = chart.canvas.offsetWidth;
        const canvasHeight = chart.canvas.offsetHeight;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // Calculate offset for selected slice
        let startAngle = 0;
        for (let i = 0; i < chart3SelectedIndex; i++) {
          const dataValue = chart.data.datasets[0].data[i];
          const totalValue = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
          startAngle += (dataValue / totalValue) * (Math.PI * 2);
        }
        const dataValue = chart.data.datasets[0].data[chart3SelectedIndex];
        const totalValue = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
        const sliceAngle = (dataValue / totalValue) * (Math.PI * 2);
        const midAngle = startAngle + sliceAngle / 2 - Math.PI / 2;

        const offsetDist = FLOAT_OFFSET * chart3AnimProgress;
        const offsetX = Math.cos(midAngle) * offsetDist;
        const offsetY = Math.sin(midAngle) * offsetDist;

        // Draw glow shadow
        ctx.save();
        ctx.fillStyle = `rgba(59, 130, 246, ${0.2 * chart3AnimProgress})`;
        ctx.beginPath();
        ctx.arc(centerX + offsetX, centerY + offsetY, 95, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }]
  });

  function animateChart3Floating() {
    let startTime = null;
    const duration = 600;

    function frame(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      chart3AnimProgress = Math.min(elapsed / duration, 1);
      chart3.update('none');

      if (chart3AnimProgress < 1) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  }


  const ctx4 = document.getElementById("chart4").getContext("2d");

  chart4 = new Chart(ctx4, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Total offences",
          data: [],
          borderColor: "#1f77b4",
          tension: 0.2,
          yAxisID: "y"
        },
        {
          label: "Population",
          data: [],
          borderColor: "#22c55e",
          tension: 0.2,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Offences"
          }
        },
        y1: {
          position: "right",
          beginAtZero: true,
          grid: {
            drawOnChartArea: false
          },
          title: {
            display: true,
            text: "Population"
          }
        }
      }
    }
  });
}

function updateCharts(filters) {
  updateKPI(filters);

  const trend = buildTrend(filters);

  chart2.data.labels = trend.labels;
  chart2.data.datasets[0].data = trend.values;
  chart2.update();

  const donut = buildDonut(filters, 8);

  chart3.data.labels = donut.labels;
  chart3.data.datasets[0].data = donut.values;
  chart3.data.datasets[0].backgroundColor =
    donut.labels.map((_, i) => BLUE_SHADES[i % BLUE_SHADES.length]);
  chart3.update();

  const popTrend = buildPopulationTrend(filters);

  chart4.data.labels = trend.labels;
  chart4.data.datasets[0].data = trend.values;
  chart4.data.datasets[1].data = popTrend.values;
  chart4.update();

  const popNotice = document.getElementById("popNotice");

  if (hasPopulation) {
    popNotice.textContent = "Showing population comparison over selected months.";
  } else {
    popNotice.textContent =
      "Population column not found yet. Add a population field to enable this chart.";
  }
}

// =============================
// APPLY FILTERS
// =============================
function applyFilters() {
  const loc = document.getElementById("locationSelect").value;
  const off = document.getElementById("offenceSelect").value;
  const startYM = document.getElementById("startSelect").value;
  const endYM = document.getElementById("endSelect").value;

  const sIdx = ymToIndex(startYM);
  const eIdx = ymToIndex(endYM);

  const s = eIdx < sIdx ? endYM : startYM;
  const e = eIdx < sIdx ? startYM : endYM;

  if (s !== startYM) {
    document.getElementById("startSelect").value = s;
  }

  if (e !== endYM) {
    document.getElementById("endSelect").value = e;
  }

  const filters = {
    location: loc,
    offence: off,
    startYM: s,
    endYM: e
  };

  drawSA2(filters);
  drawRegionOutline(filters);

  const isRegion = loc !== "All NT" && loc !== "SA2 View";

  if (isRegion) {
    setInfo(`<b>Mode:</b> SA2 filtered<br/><span class="pill">${loc} outline</span>`);
  } else {
    setInfo(`<b>Mode:</b> SA2 View<br/><span class="pill">All NT</span>`);
  }

  updateCharts(filters);
}

// =============================
// INIT
// =============================
async function initDashboard() {
  await Promise.all([
    loadCSV(),
    loadGeo()
  ]);

  initControls();
  initMap();
  initCharts();
  applyFilters();
}

window.addEventListener("load", initDashboard);