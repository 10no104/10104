import { CONFIG } from "./assets/js/config.js";

const VIEWS = {
  baking: {
    title: "베이킹",
    type: "baking",
  },
  cocktail: {
    title: "칵테일",
    type: "cocktail",
  },
  cooking: {
    title: "요리",
    type: "cooking",
  },
};

const APP_SHEETS = {
  recipes: "App_Recipes",
  ingredients: "App_Ingredients",
  steps: "App_Steps",
  feedback: "App_Feedback",
  referenceData: "App_ReferenceData",
};

const PLACE_TYPE_ICONS = {
  restaurant: "🍽️",
  food: "🍽️",
  음식점: "🍽️",
  attraction: "🏞️",
  sightseeing: "🏞️",
  관광지: "🏞️",
  hotel: "🏨",
  stay: "🏨",
  숙소: "🏨",
  transit: "🚉",
  transport: "🚉",
  교통: "🚉",
  other: "📍",
  기타: "📍",
};

const state = {
  view: "baking",
  recipes: [],
  selectedId: "",
  query: "",
  placeQuery: "",
  placeResults: [],
  sort: "updatedAt",
  apiUrl: CONFIG.APPS_SCRIPT_URL || "",
  places: [],
  map: null,
  placeLayer: null,
  searchLayer: null,
  locationMarker: null,
  searchTimer: 0,
};

const sectionTitle = document.querySelector("#sectionTitle");
const recipeCount = document.querySelector("#recipeCount");
const searchInput = document.querySelector("#searchInput");
const recipeStage = document.querySelector("#recipeStage");
const recipeList = document.querySelector("#recipeList");
const emptyDetail = document.querySelector("#emptyDetail");
const recipeDetail = document.querySelector("#recipeDetail");
const detailType = document.querySelector("#detailType");
const detailName = document.querySelector("#detailName");
const detailDescription = document.querySelector("#detailDescription");
const sourceLink = document.querySelector("#sourceLink");
const detailYield = document.querySelector("#detailYield");
const detailUpdated = document.querySelector("#detailUpdated");
const detailFeedback = document.querySelector("#detailFeedback");
const deleteRecipeButton = document.querySelector("#deleteRecipeButton");
const ingredientList = document.querySelector("#ingredientList");
const stepList = document.querySelector("#stepList");
const latestFeedbackCard = document.querySelector("#latestFeedbackCard");
const latestFeedback = document.querySelector("#latestFeedback");
const placesMap = document.querySelector("#placesMap");
const mapStatus = document.querySelector("#mapStatus");
const mapSearchInput = document.querySelector("#mapSearchInput");
const placeTypeSelect = document.querySelector("#placeTypeSelect");
const placeResults = document.querySelector("#placeResults");
const locateButton = document.querySelector("#locateButton");
const convertAmount = document.querySelector("#convertAmount");
const convertFrom = document.querySelector("#convertFrom");
const convertResult = document.querySelector("#convertResult");
const recipeModal = document.querySelector("#recipeModal");
const recipeForm = document.querySelector("#recipeForm");
const recipeFormStatus = document.querySelector("#recipeFormStatus");

async function loadRecipes() {
  const current = VIEWS[state.view];
  state.selectedId = "";
  recipeStage.classList.remove("show-detail");
  setStatus("불러오는 중", 0);
  recipeList.innerHTML = '<p class="empty-state">불러오는 중</p>';

  if (!current) {
    renderStaticView();
    if (state.view === "map") initMapView();
    return;
  }

  try {
    const recipes = await loadFromSpreadsheetWithFallback(current.type);
    state.recipes = normalizeRecipes(recipes);
    setStatus(state.recipes.length ? `${state.recipes.length}개` : "없음", state.recipes.length);
  } catch {
    state.recipes = [];
    setStatus("오류", 0);
  }

  render();
}

async function loadFromSpreadsheetWithFallback(recipeType) {
  try {
    return await loadFromSpreadsheet(recipeType);
  } catch {
    if (!state.apiUrl) throw new Error("LOAD_FAILED");
    return loadFromApi(recipeType);
  }
}

async function loadFromApi(recipeType) {
  const payload = await jsonp(buildApiUrl("listRecipes", { type: recipeType }));
  if (!payload.ok) throw new Error(payload.error?.message || "API_ERROR");
  return payload.data;
}

async function createRecipe(data) {
  if (!state.apiUrl) throw new Error("URL 필요");
  const payload = await jsonp(buildApiUrl("createRecipe", { data: JSON.stringify(data) }));
  if (!payload.ok) throw new Error(payload.error?.message || "저장 실패");
  return payload.data;
}

async function deleteRecipe(recipeId) {
  if (!state.apiUrl) throw new Error("URL 필요");
  const payload = await jsonp(buildApiUrl("deleteRecipe", { recipeId }));
  if (!payload.ok) throw new Error(payload.error?.message || "삭제 실패");
  return payload.data;
}

async function createPlace(place) {
  if (!state.apiUrl) throw new Error("URL 필요");
  const payload = await jsonp(buildApiUrl("createPlace", { data: JSON.stringify(place) }));
  if (!payload.ok) throw new Error(payload.error?.message || "저장 실패");
  return payload.data;
}

async function deletePlace(placeId) {
  if (!state.apiUrl) throw new Error("URL 필요");
  const payload = await jsonp(buildApiUrl("deletePlace", { placeId }));
  if (!payload.ok) throw new Error(payload.error?.message || "삭제 실패");
  return payload.data;
}

async function updatePlaceNote(placeId, note) {
  if (!state.apiUrl) throw new Error("URL 필요");
  const payload = await jsonp(buildApiUrl("updatePlaceNote", { placeId, note }));
  if (!payload.ok) throw new Error(payload.error?.message || "저장 실패");
  return payload.data;
}

async function loadFromSpreadsheet(recipeType) {
  if (!CONFIG.SPREADSHEET_ID) throw new Error("SPREADSHEET_ID 없음");

  const [recipesResult, ingredientsResult, stepsResult, feedbackResult] = await Promise.allSettled([
    readAppSheet(APP_SHEETS.recipes),
    readAppSheet(APP_SHEETS.ingredients),
    readAppSheet(APP_SHEETS.steps),
    readAppSheet(APP_SHEETS.feedback),
  ]);

  if (recipesResult.status === "rejected") throw recipesResult.reason;

  const recipes = recipesResult.value;
  const ingredients = ingredientsResult.status === "fulfilled" ? ingredientsResult.value : [];
  const steps = stepsResult.status === "fulfilled" ? stepsResult.value : [];
  const feedback = feedbackResult.status === "fulfilled" ? feedbackResult.value : [];

  return recipes
    .filter((recipe) => String(recipe.isArchived).toLowerCase() !== "true")
    .filter((recipe) => !recipeType || recipe.recipeType === recipeType)
    .map((recipe) => decorateRecipe(recipe, ingredients, steps, feedback));
}

function buildApiUrl(action, params = {}) {
  const url = new URL(state.apiUrl);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function buildSheetUrl(sheetName) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq`);
  url.searchParams.set("sheet", sheetName);
  url.searchParams.set("headers", "1");
  return url.toString();
}

async function readAppSheet(sheetName) {
  const data = await googleSheetJsonp(buildSheetUrl(sheetName));
  return parseSheetTable(data);
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `__recipeApi_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("callback", callback);
    injectJsonpScript(requestUrl.toString(), callback, resolve, reject);
  });
}

function googleSheetJsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `__recipeSheet_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("tqx", `out:json;responseHandler:${callback}`);
    injectJsonpScript(requestUrl.toString(), callback, resolve, reject);
  });
}

function injectJsonpScript(url, callback, resolve, reject) {
  const script = document.createElement("script");
  const timeout = window.setTimeout(() => {
    cleanup();
    reject(new Error("시간 초과"));
  }, 12000);

  function cleanup() {
    window.clearTimeout(timeout);
    script.remove();
    delete window[callback];
  }

  window[callback] = (payload) => {
    cleanup();
    resolve(payload);
  };

  script.onerror = () => {
    cleanup();
    reject(new Error("로드 실패"));
  };

  script.src = url;
  script.async = true;
  document.head.append(script);
}

function parseSheetTable(data) {
  const table = data?.table;
  if (!table) return [];

  const headers = table.cols.map((column) => column.label || column.id).map(String);
  return table.rows
    .map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row.c[index]?.f || row.c[index]?.v || "";
      });
      return object;
    })
    .filter((row) => Object.values(row).some(Boolean));
}

function decorateRecipe(recipe, ingredients, steps, feedback) {
  const version = recipe.currentVersion || "";
  const recipeFeedback = feedback.filter((item) => item.recipeId === recipe.recipeId);
  const latestFeedbackText = recipeFeedback.length ? recipeFeedback[recipeFeedback.length - 1].result : "";

  return {
    ...recipe,
    ingredients: ingredients
      .filter((item) => item.recipeId === recipe.recipeId && (!version || String(item.version) === String(version)))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    steps: steps
      .filter((item) => item.recipeId === recipe.recipeId && (!version || String(item.version) === String(version)))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    feedbackCount: recipeFeedback.length,
    latestFeedback: latestFeedbackText,
  };
}

function normalizeRecipes(recipes) {
  return (recipes || []).map((recipe) => ({
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : safeJson(recipe.tagsJson, []),
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
  }));
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function setStatus(_message, count) {
  const total = Number.isFinite(Number(count)) ? Number(count) : state.recipes.length;
  recipeCount.textContent = `${total}개`;
}

function setView(view) {
  state.view = view;
  state.query = "";
  searchInput.value = "";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.body.classList.toggle("map-view", view === "map");
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (VIEWS[view]) {
    document.querySelector("#recipesScreen").classList.add("active");
    document.querySelector("#mapScreen").classList.remove("active");
    document.querySelector("#toolsScreen").classList.remove("active");
    sectionTitle.textContent = VIEWS[view].title;
    loadRecipes();
    updateHash();
    return;
  }

  renderStaticView();
  updateHash();
}

function renderStaticView() {
  document.querySelector("#recipesScreen").classList.remove("active");
  document.querySelector("#mapScreen").classList.toggle("active", state.view === "map");
  document.querySelector("#toolsScreen").classList.toggle("active", state.view === "tools");
  sectionTitle.textContent = state.view === "map" ? "지도" : "계산";
  setStatus(state.view === "map" ? "지도" : "계산", "-");
  if (state.view === "map") initMapView();
}

async function initMapView() {
  if (!window.L) {
    mapStatus.textContent = "지도 오류";
    return;
  }

  if (!state.map) {
    state.map = L.map(placesMap, { zoomControl: true }).setView([37.5665, 126.978], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(state.map);
    state.placeLayer = L.layerGroup().addTo(state.map);
    state.searchLayer = L.layerGroup().addTo(state.map);
  }

  window.setTimeout(() => state.map.invalidateSize(), 50);
  window.setTimeout(() => state.map.invalidateSize(), 250);
  await loadPlaces();
}

async function loadPlaces() {
  mapStatus.textContent = "불러오는 중";

  try {
    const rows = await readAppSheet(APP_SHEETS.referenceData);
    state.places = rows
      .filter((row) => String(row.category).toLowerCase() === "place")
      .filter((row) => String(row.isActive).toLowerCase() !== "false")
      .map(normalizePlace)
      .filter(Boolean);
    mapStatus.textContent = state.places.length ? `${state.places.length}개` : "장소 없음";
  } catch {
    state.places = [];
    mapStatus.textContent = "오류";
  }

  renderPlaces();
}

function normalizePlace(row) {
  const parsed = safeJson(row.value, {});
  const lat = Number(parsed.lat ?? parsed.latitude ?? row.lat);
  const lng = Number(parsed.lng ?? parsed.longitude ?? row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    placeId: row.referenceId || parsed.placeId || `${lat},${lng}`,
    name: row.name || parsed.name || "장소",
    note: row.note || parsed.note || "",
    address: parsed.address || "",
    type: parsed.type || parsed.category || "기타",
    lat,
    lng,
    googleMapsUrl: parsed.googleMapsUrl || parsed.url || buildGoogleMapsSearchUrl(row.name || parsed.name || "장소", parsed.address || row.note || ""),
  };
}

function renderPlaces() {
  if (!state.placeLayer) return;
  state.placeLayer.clearLayers();
  const bounds = [];

  state.places.forEach((place) => {
    const marker = L.marker([place.lat, place.lng], { icon: placeIcon(place.type) });
    marker.bindPopup(`
      <div class="place-popup">
        <strong>${escapeHtml(place.name)}</strong>
        <textarea class="place-note-input" rows="3">${escapeHtml(place.note || "")}</textarea>
        <a href="${escapeHtml(place.googleMapsUrl)}" target="_blank" rel="noreferrer">Google Maps 열기</a>
        <button type="button" class="place-note-save-button">저장</button>
        <button type="button" class="place-delete-button">삭제</button>
      </div>
    `);
    marker.on("popupopen", () => {
      const popup = marker.getPopup()?.getElement();
      const deleteButton = popup?.querySelector(".place-delete-button");
      const saveButton = popup?.querySelector(".place-note-save-button");
      const noteInput = popup?.querySelector(".place-note-input");
      if (deleteButton) deleteButton.addEventListener("click", () => handleDeletePlace(place));
      if (saveButton && noteInput) saveButton.addEventListener("click", () => handleSavePlaceNote(place, noteInput.value));
    });
    marker.addTo(state.placeLayer);
    bounds.push([place.lat, place.lng]);
  });

  if (state.places.length) mapStatus.textContent = `${state.places.length}개`;
  if (bounds.length === 1) state.map.setView(bounds[0], Math.max(state.map.getZoom(), 15));
  else if (bounds.length) state.map.fitBounds(bounds, { padding: [38, 38], maxZoom: 14 });
}

function renderPlaceResults() {
  placeResults.innerHTML = "";
  placeResults.hidden = !state.placeResults.length;

  state.placeResults.forEach((place, index) => {
    const item = document.createElement("div");
    item.className = "place-result";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "place-result-main";
    button.innerHTML = `<strong>${escapeHtml(place.name)}</strong><span>${escapeHtml(place.address)}</span>`;
    button.addEventListener("click", () => previewSearchPlace(place));

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "place-add-button";
    addButton.textContent = "추가";
    addButton.addEventListener("click", () => addSearchPlace(index));

    item.append(button, addButton);
    placeResults.append(item);
  });
}

function previewSearchPlace(place) {
  if (!state.searchLayer) return;
  state.searchLayer.clearLayers();
  const marker = L.marker([place.lat, place.lng], { icon: placeIcon(placeTypeSelect.value) });
  marker.bindPopup(`<div class="place-popup"><strong>${escapeHtml(place.name)}</strong></div>`);
  marker.addTo(state.searchLayer).openPopup();
  state.map.setView([place.lat, place.lng], 16);
}

async function searchPlaces(query) {
  const term = query.trim();
  if (term.length < 2) {
    state.placeResults = [];
    renderPlaceResults();
    mapStatus.textContent = state.places.length ? `${state.places.length}개` : "장소 없음";
    return;
  }

  mapStatus.textContent = "검색 중";

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("accept-language", "ko");
    url.searchParams.set("q", term);
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("SEARCH_FAILED");

    const results = await response.json();
    state.placeResults = results
      .map((result) => ({
        name: result.name || result.display_name?.split(",")[0] || term,
        address: result.display_name || "",
        lat: Number(result.lat),
        lng: Number(result.lon),
      }))
      .filter((result) => Number.isFinite(result.lat) && Number.isFinite(result.lng));

    renderPlaceResults();
    mapStatus.textContent = state.placeResults.length ? `${state.placeResults.length}개` : "검색 없음";
    if (state.placeResults.length === 1) previewSearchPlace(state.placeResults[0]);
  } catch {
    state.placeResults = [];
    renderPlaceResults();
    mapStatus.textContent = "검색 오류";
  }
}

async function addSearchPlace(index) {
  const result = state.placeResults[index];
  if (!result) return;

  const type = placeTypeSelect.value || "기타";
  const place = {
    name: result.name,
    note: "",
    address: result.address,
    type,
    lat: result.lat,
    lng: result.lng,
    googleMapsUrl: buildGoogleMapsSearchUrl(result.name, result.address),
  };

  mapStatus.textContent = "저장 중";

  try {
    const saved = await createPlace(place);
    state.places.push(normalizePlace(saved) || place);
    state.placeResults = [];
    mapSearchInput.value = "";
    if (state.searchLayer) state.searchLayer.clearLayers();
    renderPlaceResults();
    renderPlaces();
    mapStatus.textContent = `${state.places.length}개`;
  } catch (error) {
    mapStatus.textContent = error.message;
  }
}

function placeIcon(type) {
  const icon = PLACE_TYPE_ICONS[type] || PLACE_TYPE_ICONS[String(type).toLowerCase()] || PLACE_TYPE_ICONS.other;
  return L.divIcon({
    className: "place-marker",
    html: `<span>${icon}</span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });
}

function showCurrentLocation() {
  if (!navigator.geolocation) {
    mapStatus.textContent = "위치 꺼짐";
    return;
  }

  mapStatus.textContent = "확인 중";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latlng = [position.coords.latitude, position.coords.longitude];
      if (state.locationMarker) state.locationMarker.setLatLng(latlng);
      else {
        state.locationMarker = L.circleMarker(latlng, {
          radius: 8,
          color: "#1267ff",
          fillColor: "#2f80ff",
          fillOpacity: 0.9,
          weight: 3,
        }).addTo(state.map);
      }
      state.map.setView(latlng, Math.max(state.map.getZoom(), 14));
      mapStatus.textContent = "현재 위치";
    },
    () => {
      mapStatus.textContent = "위치 꺼짐";
    },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
  );
}

function getVisibleRecipes() {
  const query = state.query.trim().toLowerCase();
  const recipes = state.recipes.filter((recipe) => {
    return !query || String(recipe.name || "").toLowerCase().includes(query);
  });

  return recipes.sort((a, b) => {
    if (state.sort === "name") return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}

function getSelectedRecipe() {
  return state.recipes.find((recipe) => recipe.recipeId === state.selectedId);
}

function renderList() {
  const recipes = getVisibleRecipes();
  recipeList.innerHTML = "";

  if (!recipes.length) {
    recipeList.innerHTML = '<p class="empty-state">없음</p>';
    return;
  }

  recipes.forEach((recipe) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recipe-card${recipe.recipeId === state.selectedId ? " active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(recipe.name)}</strong>`;
    button.addEventListener("click", () => {
      if (state.selectedId === recipe.recipeId) {
        state.selectedId = "";
        recipeStage.classList.remove("show-detail");
      } else {
        state.selectedId = recipe.recipeId;
        recipeStage.classList.add("show-detail");
      }
      render();
    });
    recipeList.append(button);
  });
}

function renderDetail() {
  const recipe = getSelectedRecipe();
  emptyDetail.hidden = Boolean(recipe);
  recipeDetail.hidden = !recipe;
  latestFeedbackCard.hidden = !recipe?.latestFeedback;
  deleteRecipeButton.disabled = !recipe;
  if (!recipe) return;

  detailType.textContent = recipe.recipeType || "Recipe";
  detailName.textContent = recipe.name;
  detailDescription.textContent = recipe.description || recipe.notes || "";
  detailYield.textContent = formatYield(recipe);
  detailUpdated.textContent = recipe.updatedAt || "-";
  detailFeedback.textContent = recipe.feedbackCount || 0;

  sourceLink.hidden = !recipe.sourceUrl;
  sourceLink.href = normalizeUrl(recipe.sourceUrl) || "#";
  sourceLink.textContent = recipe.sourceName || "출처";

  renderIngredients(recipe.ingredients || []);
  renderSteps(recipe.steps || []);

  if (recipe.latestFeedback) latestFeedback.textContent = recipe.latestFeedback;
}

function renderIngredients(items) {
  ingredientList.innerHTML = "";
  const list = items.length ? items : [{ name: "없음", amount: "", unit: "" }];
  list.forEach((item) => {
    const li = document.createElement("li");
    const group = item.groupName ? `[${item.groupName}] ` : "";
    li.textContent = `${group}${item.name || ""} ${item.amount || ""} ${item.unit || ""}`.trim();
    ingredientList.append(li);
  });
}

function renderSteps(items) {
  stepList.innerHTML = "";
  const list = items.length ? items : [{ instruction: "없음" }];
  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.instruction || item;
    stepList.append(li);
  });
}

function render() {
  renderList();
  renderDetail();
}

function formatYield(recipe) {
  return `${recipe.baseYield || "-"} ${recipe.yieldUnit || ""}`.trim();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildGoogleMapsSearchUrl(name, address = "") {
  const query = [name, address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function updateHash() {
  history.replaceState(null, "", `${location.pathname}${location.search}#${state.view}`);
}

function initFromHash() {
  const hash = location.hash.replace("#", "");
  if (hash && (VIEWS[hash] || hash === "map" || hash === "tools")) state.view = hash;
}

function updateConverter() {
  const amount = Number(convertAmount.value || 0);
  const unit = convertFrom.value;
  const result = {
    cup: `${amount * 240} ml`,
    tbsp: `${amount * 15} ml`,
    tsp: `${amount * 5} ml`,
    c: `${Math.round((amount * 9) / 5 + 32)} °F`,
    f: `${Math.round(((amount - 32) * 5) / 9)} °C`,
  }[unit];
  convertResult.textContent = result;
}

document.querySelectorAll(".bottom-nav button").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelector("#addRecipeButton").addEventListener("click", () => {
  openRecipeForm();
});

document.querySelector("#closeRecipeForm").addEventListener("click", closeRecipeForm);
document.querySelector("#cancelRecipeForm").addEventListener("click", closeRecipeForm);

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  recipeFormStatus.textContent = "저장 중";

  try {
    const data = collectRecipeForm();
    await createRecipe(data);
    recipeFormStatus.textContent = "저장됨";
    closeRecipeForm();
    setView(data.recipeType);
  } catch (error) {
    recipeFormStatus.textContent = error.message;
  }
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.selectedId = "";
  recipeStage.classList.remove("show-detail");
  render();
});

mapSearchInput.addEventListener("input", (event) => {
  state.placeQuery = event.target.value;
  window.clearTimeout(state.searchTimer);
  state.searchTimer = window.setTimeout(() => searchPlaces(state.placeQuery), 450);
});

document.querySelector("#backButton").addEventListener("click", () => {
  recipeStage.classList.remove("show-detail");
});

deleteRecipeButton.addEventListener("click", handleDeleteRecipe);
locateButton.addEventListener("click", showCurrentLocation);
convertAmount.addEventListener("input", updateConverter);
convertFrom.addEventListener("change", updateConverter);

initFromHash();
updateConverter();
setView(state.view);

function openRecipeForm() {
  recipeForm.reset();
  recipeFormStatus.textContent = state.apiUrl ? "" : "URL 없음";
  document.querySelector("#recipeTypeInput").value = VIEWS[state.view]?.type || "baking";
  recipeModal.hidden = false;
  document.querySelector("#recipeNameInput").focus();
}

function closeRecipeForm() {
  recipeModal.hidden = true;
}

async function handleDeleteRecipe() {
  const recipe = getSelectedRecipe();
  if (!recipe) return;
  if (!confirm(`삭제할까요?\n${recipe.name}`)) return;

  setStatus("삭제 중", state.recipes.length);

  try {
    await deleteRecipe(recipe.recipeId);
    state.recipes = state.recipes.filter((item) => item.recipeId !== recipe.recipeId);
    state.selectedId = "";
    recipeStage.classList.remove("show-detail");
    setStatus(state.recipes.length ? `${state.recipes.length}개` : "없음", state.recipes.length);
    render();
  } catch (error) {
    setStatus("오류", state.recipes.length);
    const message = error.message === "지원하지 않는 action입니다." ? "Apps Script 재배포 필요" : error.message;
    alert(message);
  }
}

async function handleDeletePlace(place) {
  if (!place?.placeId) return;
  if (!confirm(`삭제할까요?\n${place.name}`)) return;

  mapStatus.textContent = "삭제 중";

  try {
    await deletePlace(place.placeId);
    state.places = state.places.filter((item) => item.placeId !== place.placeId);
    if (state.map) state.map.closePopup();
    renderPlaces();
    mapStatus.textContent = state.places.length ? `${state.places.length}개` : "장소 없음";
  } catch (error) {
    mapStatus.textContent = error.message;
  }
}

async function handleSavePlaceNote(place, note) {
  if (!place?.placeId) return;

  mapStatus.textContent = "저장 중";

  try {
    await updatePlaceNote(place.placeId, note.trim());
    place.note = note.trim();
    mapStatus.textContent = "저장됨";
  } catch (error) {
    mapStatus.textContent = error.message;
  }
}

function collectRecipeForm() {
  return {
    name: document.querySelector("#recipeNameInput").value.trim(),
    recipeType: document.querySelector("#recipeTypeInput").value,
    category: document.querySelector("#recipeCategoryInput").value.trim(),
    description: document.querySelector("#recipeDescriptionInput").value.trim(),
    sourceUrl: normalizeUrl(document.querySelector("#recipeSourceUrlInput").value),
    baseYield: document.querySelector("#recipeYieldInput").value.trim(),
    yieldUnit: document.querySelector("#recipeYieldUnitInput").value.trim(),
    tags: document.querySelector("#recipeTagsInput").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    ingredients: parseIngredientLines(document.querySelector("#recipeIngredientsInput").value),
    steps: parseStepLines(document.querySelector("#recipeStepsInput").value),
  };
}

function parseIngredientLines(value) {
  return value
    .split(/\r?\n/)
    .map((line, index) => {
      const [name = "", amount = "", unit = "", groupName = "", notes = ""] = line.split("|").map((part) => part.trim());
      return { name, amount, unit, groupName, notes, sortOrder: index + 1 };
    })
    .filter((item) => item.name);
}

function parseStepLines(value) {
  return value
    .split(/\r?\n/)
    .map((line, index) => ({ instruction: line.trim(), sortOrder: index + 1 }))
    .filter((item) => item.instruction);
}
