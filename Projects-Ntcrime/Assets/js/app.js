// =============================
  // CONFIG (GitHub Pages friendly)
  // =============================
  // Put these files in SAME folder as dashboard.html
  const CSV_PATH     = "nt_crime_statistics_dec_2025_FACT_OFFENCES.csv";
  const SA2_GEOJSON  = "nt_sa2.geojson";      // exported by your region.py (sa2_nt)
  const REG_GEOJSON  = "nt_regions.geojson";  // exported by your region.py (regions dissolve)

  const LOCATIONS = [
    "All NT","SA2 View",
    "Darwin","Palmerston","Alice Springs","Katherine","Tennant Creek","Nhulunbuy","NT Balance"
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

  let sa2Geo = null;       // full SA2 GeoJSON loaded
  let regGeo = null;       // region GeoJSON loaded

  let sa2Layer = null;     // current SA2 layer (filtered)
  let outlineLayer = null; // region outline (border)

  let chart2;
  let chart3;

  const policeStations = [
    {"name":"Darwin Police Station","lat":-12.4634,"lon":130.8456},
    {"name":"Palmerston Police Station","lat":-12.4860,"lon":130.9833},
    {"name":"Alice Springs Police Station","lat":-23.6980,"lon":133.8807},
    {"name":"Katherine Police Station","lat":-14.4650,"lon":132.2635},
    {"name":"Tennant Creek Police Station","lat":-19.6490,"lon":134.1910},
    {"name":"Nhulunbuy Police Station","lat":-12.1800,"lon":136.7800}
  ];

  const BLUE_SHADES = ["#dbeafe","#bfdbfe","#93c5fd","#60a5fa","#3b82f6","#2563eb","#1d4ed8","#1e40af","#172554","#94a3b8"];

  // =============================
  // HELPERS
  // =============================
  function setInfo(html) {
    document.getElementById("info").innerHTML = html || "Hover over an area";
  }
  function toNum(x, d=0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : d;
  }
  function ymToIndex(ym) {
    const y = Number(String(ym).slice(0,4));
    const m = Number(String(ym).slice(5,7));
    return y * 12 + (m - 1);
  }
  function indexToYM(idx) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    return `${y}-${String(m).padStart(2,"0")}`;
  }
  function inRange(r, startYM, endYM) {
    const ym = String(r.year_month || "");
    if (!ym || ym.length < 7) return false;
    const idx = ymToIndex(ym);
    return idx >= ymToIndex(startYM) && idx <= ymToIndex(endYM);
  }

  function normalize(v){ return String(v||"").trim().toLowerCase(); }

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
    if (up) { el.style.background = "#ffe5e5"; el.style.color = "#b00020"; }
    else { el.style.background = "#e6f7ea"; el.style.color = "#1b5e20"; }
  }

  // =============================
  // LOAD DATA
  // =============================
  async function loadCSV() {
    const res = await fetch(CSV_PATH);
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header:true, dynamicTyping:true, skipEmptyLines:true });

    DATA_ROWS = parsed.data
      .filter(r => String(r.year_month || "").match(/^\d{4}-\d{2}$/))
      .map(r => ({
        reporting_region: String(r.reporting_region || "").trim(),
        offence_type: String(r.offence_type || "").trim(),
        year_month: String(r.year_month || "").trim(),
        offence_count: toNum(r.offence_count, 0),
        alcohol_flag: toNum(r.alcohol_flag, 0)
      }));

    OFFENCES = ["All offences"].concat(
      [...new Set(DATA_ROWS.map(r => r.offence_type).filter(x => x))].sort((a,b)=>a.localeCompare(b))
    );

    YM_LIST = [...new Set(DATA_ROWS.map(r => r.year_month))].sort();

    const maxYM = YM_LIST[YM_LIST.length - 1];
    document.getElementById("asAt").textContent = "As at: " + maxYM;
  }

  async function loadGeo() {
    const [sa2Res, regRes] = await Promise.all([fetch(SA2_GEOJSON), fetch(REG_GEOJSON)]);
    sa2Geo = await sa2Res.json();
    regGeo = await regRes.json();
  }

  // =============================
  // CONTROLS
  // =============================
  function initControls() {
    const locationSelect = document.getElementById("locationSelect");
    const offenceSelect  = document.getElementById("offenceSelect");
    const startSelect    = document.getElementById("startSelect");
    const endSelect      = document.getElementById("endSelect");

    locationSelect.innerHTML = "";
    offenceSelect.innerHTML = "";
    startSelect.innerHTML = "";
    endSelect.innerHTML = "";

    LOCATIONS.forEach(x => {
      const opt = document.createElement("option");
      opt.value = x; opt.textContent = x;
      locationSelect.appendChild(opt);
    });

    OFFENCES.forEach(x => {
      const opt = document.createElement("option");
      opt.value = x; opt.textContent = x;
      offenceSelect.appendChild(opt);
    });

    YM_LIST.forEach(ym => {
      const a = document.createElement("option"); a.value = ym; a.textContent = ym; startSelect.appendChild(a);
      const b = document.createElement("option"); b.value = ym; b.textContent = ym; endSelect.appendChild(b);
    });

    const maxYM = YM_LIST[YM_LIST.length - 1];
    const latestYear = String(maxYM).slice(0,4);
    const defaultStart = `${latestYear}-01`;
    startSelect.value = YM_LIST.includes(defaultStart) ? defaultStart : YM_LIST[0];
    endSelect.value = maxYM;

    function clamp() {
      const sIdx = ymToIndex(startSelect.value);
      const eIdx = ymToIndex(endSelect.value);
      if (eIdx < sIdx) endSelect.value = startSelect.value;
    }
    startSelect.addEventListener("change", clamp);
    endSelect.addEventListener("change", clamp);

    locationSelect.value = "SA2 View";
    offenceSelect.value = "All offences";
  }

  // =============================
  // MAP
  // =============================
  function initMap() {
    map = L.map("map").setView([-19,133], 6);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap & CartoDB"
    }).addTo(map);

    policeLayer = L.layerGroup();
    policeStations.forEach(st => {
      L.marker([st.lat, st.lon]).bindTooltip(st.name).addTo(policeLayer);
    });
    policeLayer.addTo(map);
  }

  function togglePolice() {
    if (policeVisible) map.removeLayer(policeLayer);
    else policeLayer.addTo(map);
    policeVisible = !policeVisible;
  }

  // Build SA2 layer filtered by region (and keep SA2 boundaries visible)
  function drawSA2(filters) {
    if (sa2Layer) map.removeLayer(sa2Layer);

    // IMPORTANT: your exported nt_sa2.geojson likely has property "Region" (from your script)
    // and also "SA2_NAME21"
    const isRegion = (filters.location !== "All NT" && filters.location !== "SA2 View");
    const selected = filters.location;

    const filteredFeatures = (sa2Geo.features || []).filter(ft => {
      const reg = ft.properties?.Region || ft.properties?.RegionGroup || "";
      if (!isRegion) return true;
      return normalize(reg) === normalize(selected);
    });

    const sa2Filtered = { type:"FeatureCollection", features: filteredFeatures };

    sa2Layer = L.geoJSON(sa2Filtered, {
      style: (feature) => ({
        color: "#111827",
        weight: 0.8,           // SA2 borders visible
        fillColor: feature.properties?.base_color || "#93c5fd",
        fillOpacity: 0.45
      }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.SA2_NAME21 || feature.properties?.SA2_NAME_2021 || "SA2";
        layer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 2, fillOpacity: 0.7 });
            setInfo(`<b>SA2:</b> ${name}`);
          },
          mouseout: (e) => {
            sa2Layer.resetStyle(e.target);
            setInfo();
          }
        });
      }
    }).addTo(map);

    // zoom
    if (filteredFeatures.length) {
      map.fitBounds(sa2Layer.getBounds());
    }
  }

  // Draw outline border for selected region (ONLY when user picks a region)
  function drawRegionOutline(filters) {
    if (outlineLayer) map.removeLayer(outlineLayer);

    const isRegion = (filters.location !== "All NT" && filters.location !== "SA2 View");
    if (!isRegion) return; // no outline in All NT / SA2 View

    const selected = filters.location;

    const ft = (regGeo.features || []).find(f => normalize(f.properties?.Region || f.properties?.RegionGroup) === normalize(selected));
    if (!ft) return;

    outlineLayer = L.geoJSON(ft, {
      style: () => ({
        color: "#0b2f6b",
        weight: 4,        // thick outline
        fillOpacity: 0     // outline only
      })
    }).addTo(map);
  }

  // =============================
  // KPI + CHARTS
  // =============================
  function sumMonth(rows, f, monthYM, alcoholOnly=false) {
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
    const totSubEl   = document.getElementById("totSub");

    const alcCountEl = document.getElementById("alcCount");
    const alcBadgeEl = document.getElementById("alcBadge");
    const alcSubEl   = document.getElementById("alcSub");

    const startYM = filters.startYM;
    const endYM   = filters.endYM;

    const totStart = sumMonth(DATA_ROWS, filters, startYM, false);
    const totEnd   = sumMonth(DATA_ROWS, filters, endYM, false);
    totCountEl.textContent = totEnd.toLocaleString();

    if (totStart <= 0 && totEnd <= 0) {
      totBadgeEl.textContent = "No data";
      totBadgeEl.style.background = "#f0f0f0"; totBadgeEl.style.color = "#333";
      totSubEl.textContent = `No offences found in ${startYM} and ${endYM}.`;
    } else if (totStart <= 0 && totEnd > 0) {
      totBadgeEl.textContent = "▲ increase";
      totBadgeEl.style.background = "#ffe5e5"; totBadgeEl.style.color = "#b00020";
      totSubEl.textContent = `Start (${startYM}) = 0, End (${endYM}) = ${totEnd.toLocaleString()}`;
    } else {
      const pct = ((totEnd - totStart) / totStart) * 100;
      setBadge(totBadgeEl, Math.abs(pct), pct >= 0);
      totBadgeEl.textContent = (pct < 0 ? "▼ " : "▲ ") + Math.abs(pct).toFixed(2) + "%";
      totSubEl.textContent = `Start (${startYM}) = ${totStart.toLocaleString()} vs End (${endYM}) = ${totEnd.toLocaleString()}`;
    }

    const alcStart = sumMonth(DATA_ROWS, filters, startYM, true);
    const alcEnd   = sumMonth(DATA_ROWS, filters, endYM, true);
    alcCountEl.textContent = alcEnd.toLocaleString();

    if (alcStart <= 0 && alcEnd <= 0) {
      alcBadgeEl.textContent = "No data";
      alcBadgeEl.style.background = "#f0f0f0"; alcBadgeEl.style.color = "#333";
      alcSubEl.textContent = `No alcohol-involved offences in ${startYM} and ${endYM}.`;
    } else if (alcStart <= 0 && alcEnd > 0) {
      alcBadgeEl.textContent = "▲ increase";
      alcBadgeEl.style.background = "#ffe5e5"; alcBadgeEl.style.color = "#b00020";
      alcSubEl.textContent = `Start (${startYM}) = 0, End (${endYM}) = ${alcEnd.toLocaleString()}`;
    } else {
      const pct = ((alcEnd - alcStart) / alcStart) * 100;
      setBadge(alcBadgeEl, Math.abs(pct), pct >= 0);
      alcBadgeEl.textContent = (pct < 0 ? "▼ " : "▲ ") + Math.abs(pct).toFixed(2) + "%";
      alcSubEl.textContent = `Start (${startYM}) = ${alcStart.toLocaleString()} vs End (${endYM}) = ${alcEnd.toLocaleString()}`;
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
    const pos = new Map(labels.map((x,i)=>[x,i]));

    for (const r of DATA_ROWS) {
      if (!passFilters(r, filters)) continue;
      const ym = String(r.year_month || "");
      const i = pos.get(ym);
      if (i !== undefined) values[i] += toNum(r.offence_count);
    }
    return { labels, values };
  }

  function buildDonut(filters, topN=8) {
    const bucket = new Map();
    for (const r of DATA_ROWS) {
      // ignore offence filter for donut
      const f3 = { ...filters, offence: "All offences" };
      if (!passFilters(r, f3)) continue;
      const k = r.offence_type || "(Unknown)";
      bucket.set(k, (bucket.get(k) || 0) + toNum(r.offence_count));
    }

    const sorted = Array.from(bucket.entries()).sort((a,b)=>b[1]-a[1]);
    const top = sorted.slice(0, topN);
    const other = sorted.slice(topN).reduce((s,x)=>s+x[1],0);

    const labels = top.map(x=>x[0]);
    const values = top.map(x=>x[1]);
    if (other > 0) { labels.push("Other"); values.push(other); }

    return { labels, values };
  }

  function initCharts() {
    const ctx2 = document.getElementById("chart2").getContext("2d");
    const ctx3 = document.getElementById("chart3").getContext("2d");

    chart2 = new Chart(ctx2, {
      type: "line",
      data: { labels: [], datasets: [{ label:"Total offences", data: [], borderColor:"#1f77b4", tension:0.2 }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
    });

    chart3 = new Chart(ctx3, {
      type: "doughnut",
      data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
      options: {
        responsive:true,
        maintainAspectRatio:false,
        cutout:"62%",
        plugins:{ legend:{ position:"bottom" } },
        onClick: (evt, els) => {
          if (!els || !els.length) return;
          const idx = els[0].index;
          const label = chart3.data.labels[idx];
          const offenceSelect = document.getElementById("offenceSelect");
          offenceSelect.value = (label === "Other") ? "All offences" : label;
          applyFilters();
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
    chart3.data.datasets[0].backgroundColor = donut.labels.map((_,i)=>BLUE_SHADES[i % BLUE_SHADES.length]);
    chart3.update();
  }

  // =============================
  // APPLY FILTERS (NEW LOGIC)
  // =============================
  function applyFilters() {
    const loc = document.getElementById("locationSelect").value;
    const off = document.getElementById("offenceSelect").value;
    const startYM = document.getElementById("startSelect").value;
    const endYM = document.getElementById("endSelect").value;

    const sIdx = ymToIndex(startYM), eIdx = ymToIndex(endYM);
    const s = (eIdx < sIdx) ? endYM : startYM;
    const e = (eIdx < sIdx) ? startYM : endYM;

    if (s !== startYM) document.getElementById("startSelect").value = s;
    if (e !== endYM) document.getElementById("endSelect").value = e;

    const filters = { location: loc, offence: off, startYM: s, endYM: e };

    // ✅ Always draw SA2 (full or filtered)
    drawSA2(filters);

    // ✅ Draw outline border ONLY when a region is selected
    drawRegionOutline(filters);

    // update info label
    const isRegion = (loc !== "All NT" && loc !== "SA2 View");
    if (isRegion) setInfo(`<b>Mode:</b> SA2 filtered<br/><span class="pill">${loc} outline</span>`);
    else setInfo(`<b>Mode:</b> SA2 View<br/><span class="pill">All NT</span>`);

    updateCharts(filters);
  }

  // =============================
  // INIT
  // =============================
  async function initDashboard() {
    await Promise.all([loadCSV(), loadGeo()]);
    initControls();
    initMap();
    initCharts();
    applyFilters();
  }

  window.addEventListener("load", initDashboard);