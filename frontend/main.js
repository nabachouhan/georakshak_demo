import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import ImageStatic from 'ol/source/ImageStatic.js';
import VectorSource from 'ol/source/Vector.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { Fill, Stroke, Style } from 'ol/style.js';
import 'ol/ol.css';
import './style.css';

const FALLBACK_EXTENT_3857 = [10198000, 3010500, 10207000, 3017500];

const ZONE_STYLES = {
  INSIDE_WETLAND: new Style({
    stroke: new Stroke({ color: '#dc2626', width: 2.2 }),
    fill: new Fill({ color: 'rgba(220, 38, 38, 0.52)' })
  }),
  INSIDE_GOVT_LAND: new Style({
    stroke: new Stroke({ color: '#ea580c', width: 2.2 }),
    fill: new Fill({ color: 'rgba(249, 115, 22, 0.48)' })
  }),
  OUTSIDE_BOUNDARIES: new Style({
    stroke: new Stroke({ color: '#7c3aed', width: 1.8 }),
    fill: new Fill({ color: 'rgba(139, 92, 246, 0.40)' })
  })
};

document.querySelector('#app').innerHTML = `
<header>
  <div><b>GEORAKSHAK</b><small id="header-sub">Encroachment Screening · Sentinel-2 L2A Static Showcase</small></div>
  <span id="badge">SENTINEL-2 L2A</span>
</header>
<main>
  <section class="intro">
    <div>
      <small>MULTISPECTRAL ENCROACHMENT MONITORING</small>
      <h1 id="region-title">Deepor Beel, Guwahati</h1>
      <p id="scene-summary">Loading Sentinel-2 L2A metadata…</p>
    </div>
    <div class="actions">
      <button id="fit-btn" type="button">Reset Map View</button>
    </div>
  </section>

  <section class="stats">
    <article class="stat-wetland"><small>Inside Wetland</small><strong id="stat-wetland">—</strong></article>
    <article class="stat-govt"><small>Inside Govt Land</small><strong id="stat-govt">—</strong></article>
    <article class="stat-outside"><small>Outside Boundaries</small><strong id="stat-outside">—</strong></article>
    <article><small>Total Candidate Area</small><strong id="area">—</strong></article>
  </section>

  <section class="panel">
    <div class="toolbar">
      <div><b>Map viewer</b><small id="viewer-dates">Earlier / later Sentinel-2 true-color, boundaries, and zone-colored detections</small></div>
      <nav>
        <button id="before" class="selected">Earlier</button>
        <button id="after">Later</button>
        <button id="toggle-wetland" class="selected">Wetland</button>
        <button id="toggle-govt" class="selected">Govt Land</button>
        <button id="changes" class="selected">Changes</button>
      </nav>
    </div>
    <div id="map"></div>
    <div class="legend">
      <span><i class="swatch red"></i> Change inside Wetland</span>
      <span><i class="swatch orange"></i> Change inside Govt Land</span>
      <span><i class="swatch violet"></i> Outside Change</span>
      <span><i class="swatch cyan-line"></i> Wetland Boundary</span>
      <span><i class="swatch yellow-line"></i> Govt Land Boundary</span>
      <span id="feature-info" class="feature-info">Click a polygon or boundary to inspect details.</span>
    </div>
  </section>

  <section class="panel table-panel">
    <div class="table-header">
      <h2>Detection results (NDVI · NDWI · MNDWI · NDBI · BSI)</h2>
      <div class="zone-filters">
        <button class="filter-btn selected" data-zone="ALL">All</button>
        <button class="filter-btn" data-zone="INSIDE_WETLAND">Inside Wetland</button>
        <button class="filter-btn" data-zone="INSIDE_GOVT_LAND">Inside Govt Land</button>
        <button class="filter-btn" data-zone="OUTSIDE_BOUNDARIES">Outside</button>
      </div>
    </div>
    <div id="results">Loading detection results…</div>
  </section>

  <p class="warning" id="note-banner">
    Static showcase of Sentinel-2 L2A 5-index (NDVI, NDWI, MNDWI, NDBI, BSI) encroachment screening. Wetland & Govt Land polygons are satellite-derived demonstration boundaries; replace with official cadastral/Ramsar boundaries for legal enforcement.
  </p>
</main>
`;

const map = new Map({
  target: 'map',
  layers: [new TileLayer({ source: new OSM() })],
  view: new View({ center: [0, 0], zoom: 2 })
});

const govtLandLayer = new VectorLayer({
  source: new VectorSource(),
  style: new Style({
    stroke: new Stroke({ color: '#eab308', width: 2.2, lineDash: [8, 5] }),
    fill: new Fill({ color: 'rgba(234, 179, 8, 0.08)' })
  })
});

const wetlandLayer = new VectorLayer({
  source: new VectorSource(),
  style: new Style({
    stroke: new Stroke({ color: '#06b6d4', width: 2.5, lineDash: [7, 4] }),
    fill: new Fill({ color: 'rgba(6, 182, 212, 0.08)' })
  })
});

const changeLayer = new VectorLayer({
  source: new VectorSource(),
  style: feature => ZONE_STYLES[feature.get('zone_status')] || ZONE_STYLES.OUTSIDE_BOUNDARIES
});

let beforeLayer = null;
let afterLayer = null;
let showBefore = true;
let activeZoneFilter = 'ALL';
let currentExtent3857 = FALLBACK_EXTENT_3857;
let rawFeatureCollection = { type: 'FeatureCollection', features: [] };

map.addLayer(govtLandLayer);
map.addLayer(wetlandLayer);
map.addLayer(changeLayer);

function makeImageLayer(url, extent3857) {
  return new ImageLayer({
    source: new ImageStatic({ url, imageExtent: extent3857, projection: 'EPSG:3857' }),
    opacity: 0.94
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatClass(code) {
  return String(code || 'SPECTRAL_CHANGE').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

function zoneBadgeClass(zoneStatus) {
  if (zoneStatus === 'INSIDE_WETLAND') return 'badge-wetland';
  if (zoneStatus === 'INSIDE_GOVT_LAND') return 'badge-govt';
  return 'badge-outside';
}

function alertBadgeClass(level) {
  if (level === 'CRITICAL') return 'alert-critical';
  if (level === 'HIGH') return 'alert-high';
  if (level === 'MEDIUM') return 'alert-medium';
  return 'alert-low';
}

function populateMetadata(meta) {
  document.querySelector('#region-title').textContent = meta.region_name || 'Monitoring AOI';
  if (meta.before_scene && meta.after_scene) {
    document.querySelector('#scene-summary').textContent =
      `Comparing ${meta.before_scene.date} (cloud ${meta.before_scene.cloud_cover}%) vs ${meta.after_scene.date} (cloud ${meta.after_scene.cloud_cover}%) · ${meta.crs} · ${meta.width}×${meta.height} px.`;
    document.querySelector('#viewer-dates').textContent =
      `Earlier (${meta.before_scene.date}) / Later (${meta.after_scene.date}) · Wetland & Govt Land boundaries`;
    document.querySelector('#before').textContent = `Earlier (${meta.before_scene.date})`;
    document.querySelector('#after').textContent = `Later (${meta.after_scene.date})`;
  }
}

function applyZoneFilter() {
  const allFeatures = rawFeatureCollection.features || [];
  const filtered = activeZoneFilter === 'ALL'
    ? allFeatures
    : allFeatures.filter(f => f.properties?.zone_status === activeZoneFilter);

  changeLayer.getSource().clear();
  changeLayer.getSource().addFeatures(
    new GeoJSON().readFeatures({ ...rawFeatureCollection, features: filtered }, { featureProjection: 'EPSG:3857' })
  );

  const box = document.querySelector('#results');
  if (!filtered.length) {
    box.textContent = 'No candidate polygons match this filter.';
    return;
  }

  const hasIndices = filtered[0]?.properties?.mean_d_ndvi !== undefined;
  box.innerHTML = `<table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Alert</th>
        <th>Zone</th>
        <th>Classification</th>
        <th>Area (ha)</th>
        ${hasIndices ? '<th>Consensus</th><th>ΔNDVI</th><th>ΔNDWI</th><th>ΔMNDWI</th><th>ΔNDBI</th><th>ΔBSI</th>' : ''}
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map(f => {
        const p = f.properties || {};
        return `<tr data-id="${escapeHtml(p.candidate_id)}">
          <td><b>${escapeHtml(p.candidate_id)}</b></td>
          <td><span class="alert-pill ${alertBadgeClass(p.alert_level)}">${escapeHtml(p.alert_level || 'LOW')}</span></td>
          <td><span class="zone-pill ${zoneBadgeClass(p.zone_status)}">${escapeHtml(p.zone_label || 'Outside')}</span></td>
          <td>${escapeHtml(formatClass(p.classification))}</td>
          <td>${Number(p.area_ha).toFixed(2)}</td>
          ${hasIndices ? `<td>${escapeHtml(p.index_consensus || '—')} (${Math.round((p.alert_confidence ?? 0) * 100)}%)</td><td>${Number(p.mean_d_ndvi ?? 0).toFixed(3)}</td><td>${Number(p.mean_d_ndwi ?? 0).toFixed(3)}</td><td>${Number(p.mean_d_mndwi ?? 0).toFixed(3)}</td><td>${Number(p.mean_d_ndbi ?? 0).toFixed(3)}</td><td>${Number(p.mean_d_bsi ?? 0).toFixed(3)}</td>` : ''}
          <td>${escapeHtml(p.status === 'PRIORITY_REVIEW' ? 'Priority review' : 'Observe')}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function init() {
  const [meta, wetlandGeo, govtGeo, changesGeo, stats] = await Promise.all([
    fetch('/data/dataset_metadata.json').then(r => r.json()),
    fetch('/data/wetland_boundary.geojson').then(r => r.json()),
    fetch('/data/govt_land_boundary.geojson').then(r => r.json()),
    fetch('/output/detected_changes.geojson').then(r => r.json()),
    fetch('/output/statistics.json').then(r => r.json())
  ]);

  populateMetadata(meta);
  currentExtent3857 = Array.isArray(meta.extent_3857) && meta.extent_3857.length === 4
    ? meta.extent_3857
    : FALLBACK_EXTENT_3857;

  beforeLayer = makeImageLayer('/data/before_rgb.png', currentExtent3857);
  afterLayer = makeImageLayer('/data/after_rgb.png', currentExtent3857);
  beforeLayer.setVisible(showBefore);
  afterLayer.setVisible(!showBefore);
  map.getLayers().insertAt(1, beforeLayer);
  map.getLayers().insertAt(2, afterLayer);

  wetlandLayer.getSource().addFeatures(
    new GeoJSON().readFeatures(wetlandGeo, { featureProjection: 'EPSG:3857' })
  );
  govtLandLayer.getSource().addFeatures(
    new GeoJSON().readFeatures(govtGeo, { featureProjection: 'EPSG:3857' })
  );

  rawFeatureCollection = changesGeo;
  const zc = stats.zone_counts || {};
  const za = stats.zone_area_ha || {};
  document.querySelector('#stat-wetland').textContent =
    `${zc.INSIDE_WETLAND ?? 0} (${Number(za.INSIDE_WETLAND ?? 0).toFixed(2)} ha)`;
  document.querySelector('#stat-govt').textContent =
    `${zc.INSIDE_GOVT_LAND ?? 0} (${Number(za.INSIDE_GOVT_LAND ?? 0).toFixed(2)} ha)`;
  document.querySelector('#stat-outside').textContent =
    `${zc.OUTSIDE_BOUNDARIES ?? 0} (${Number(za.OUTSIDE_BOUNDARIES ?? 0).toFixed(2)} ha)`;
  document.querySelector('#area').textContent =
    `${stats.candidate_feature_count ?? 0} (${Number(stats.candidate_area_ha ?? 0).toFixed(2)} ha)`;

  applyZoneFilter();
  map.getView().fit(currentExtent3857, { padding: [25, 25, 25, 25] });
}

map.on('singleclick', evt => {
  const info = document.querySelector('#feature-info');
  const changeFeat = map.forEachFeatureAtPixel(evt.pixel, f => f, {
    layerFilter: layer => layer === changeLayer
  });
  if (changeFeat) {
    const p = changeFeat.getProperties();
    const idxText = p.mean_d_ndvi !== undefined
      ? ` · [${p.alert_level} ${p.index_consensus}] ΔNDVI ${Number(p.mean_d_ndvi).toFixed(2)}, ΔNDWI ${Number(p.mean_d_ndwi).toFixed(2)}, ΔMNDWI ${Number(p.mean_d_mndwi).toFixed(2)}, ΔNDBI ${Number(p.mean_d_ndbi).toFixed(2)}, ΔBSI ${Number(p.mean_d_bsi).toFixed(2)}`
      : '';
    info.textContent = `${p.candidate_id} (${p.zone_label}): ${formatClass(p.classification)} · ${Number(p.area_ha).toFixed(2)} ha${idxText}`;
    return;
  }

  const wetFeat = map.forEachFeatureAtPixel(evt.pixel, f => f, { layerFilter: l => l === wetlandLayer });
  if (wetFeat) {
    const p = wetFeat.getProperties();
    info.textContent = `${p.boundary_id}: ${p.name} (${p.area_ha} ha)`;
    return;
  }

  const govtFeat = map.forEachFeatureAtPixel(evt.pixel, f => f, { layerFilter: l => l === govtLandLayer });
  if (govtFeat) {
    const p = govtFeat.getProperties();
    info.textContent = `${p.parcel_id}: ${p.name} · ${p.authority} (${p.area_ha} ha)`;
    return;
  }

  info.textContent = 'Click a polygon or boundary to inspect details.';
});

document.querySelector('#fit-btn').onclick = () => {
  map.getView().fit(currentExtent3857, { padding: [25, 25, 25, 25], duration: 300 });
};

document.querySelector('#before').onclick = () => {
  showBefore = true;
  if (beforeLayer) beforeLayer.setVisible(true);
  if (afterLayer) afterLayer.setVisible(false);
  document.querySelector('#before').classList.add('selected');
  document.querySelector('#after').classList.remove('selected');
};

document.querySelector('#after').onclick = () => {
  showBefore = false;
  if (beforeLayer) beforeLayer.setVisible(false);
  if (afterLayer) afterLayer.setVisible(true);
  document.querySelector('#after').classList.add('selected');
  document.querySelector('#before').classList.remove('selected');
};

document.querySelector('#toggle-wetland').onclick = () => {
  const visible = !wetlandLayer.getVisible();
  wetlandLayer.setVisible(visible);
  document.querySelector('#toggle-wetland').classList.toggle('selected', visible);
};

document.querySelector('#toggle-govt').onclick = () => {
  const visible = !govtLandLayer.getVisible();
  govtLandLayer.setVisible(visible);
  document.querySelector('#toggle-govt').classList.toggle('selected', visible);
};

document.querySelector('#changes').onclick = () => {
  const visible = !changeLayer.getVisible();
  changeLayer.setVisible(visible);
  document.querySelector('#changes').classList.toggle('selected', visible);
};

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.onclick = () => {
    activeZoneFilter = btn.dataset.zone;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('selected', b === btn));
    applyZoneFilter();
  };
});

init().catch(err => console.error(err));
