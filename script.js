import { CONFIG } from "./assets/js/config.js";

const VIEWS = {
  baking: {
    title: "베이킹",
    type: "baking",
    tags: ["전체", "빵", "쿠키", "케이크", "타르트", "발효빵"],
  },
  cocktail: {
    title: "칵테일",
    type: "cocktail",
    tags: ["전체", "진", "럼", "위스키", "보드카", "무알코올"],
  },
  cooking: {
    title: "요리",
    type: "cooking",
    tags: ["전체", "한식", "파스타", "소스", "찌개", "반찬"],
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
  tag: "전체",
  sort: "updatedAt",
  apiUrl: CONFIG.APPS_SCRIPT_URL || "",
  places: [],
  map: null,
  placeLayer: null,
  locationMarker: null,
};

const sectionTitle = document.querySelector("#sectionTitle");
const statusText = document.querySelector("#statusText");
const recipeCount = document.querySelector("#recipeCount");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const tagRow = document.querySelector("#tagRow");
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

function setStatus(message, count) {
  statusText.textContent = message;
  recipeCount.textContent = count;
}

function setView(view) {
  state.view = view;
  state.query = "";
  state.tag = "전체";
  searchInput.value = "";
  document.body.classList.toggle("map-view", view === "map");
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (VIEWS[view]) {
    document.querySelector("#recipesScreen").classList.add("active");
    document.querySelector("#mapScreen").classList.remove("active");
    document.querySelector("#toolsScreen").classList.remove("active");
    sectionTitle.textContent = VIEWS[view].title;
    renderTags();
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
  }

  window.setTimeout(() => state.map.invalidateSize(), 50);
  await loadPlaces();
}

async function loadPlaces() {
  mapStatus.textContent = "불러오는 중";

  try {
    const rows = await readAppSheet(APP_SHEETS.referenceData);
    state.places = rows.filter((row) => String(row.category).toLowerCase() === "place").map(normalizePlace).filter(Boolean);
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
    type: parsed.type || parsed.category || "기타",
    lat,
    lng,
    googleMapsUrl: parsed.googleMapsUrl || parsed.url || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  };
}

function renderPlaces() {
  state.placeLayer.clearLayers();
  const bounds = [];
  const query = state.placeQuery.trim().toLowerCase();
  const places = state.places.filter((place) => {
    if (!query) return true;
    return [place.name, place.note, place.type].some((value) => String(value || "").toLowerCase().includes(query));
  });

  places.forEach((place) => {
    const marker = L.marker([place.lat, place.lng], { icon: placeIcon(place.type) });
    marker.bindPopup(`
      <div class="place-popup">
        <strong>${escapeHtml(place.name)}</strong>
        ${place.note ? `<p>${escapeHtml(place.note)}</p>` : ""}
        <a href="${escapeHtml(place.googleMapsUrl)}" target="_blank" rel="noreferrer">Google Maps 열기</a>
      </div>
    `);
    marker.addTo(state.placeLayer);
    bounds.push([place.lat, place.lng]);
  });

  if (state.places.length) mapStatus.textContent = places.length ? `${places.length}개` : "없음";
  if (bounds.length) state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
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

function renderTags() {
  tagRow.innerHTML = "";
  VIEWS[state.view].tags.forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tag;
    button.classList.toggle("active", state.tag === tag);
    button.addEventListener("click", () => {
      state.tag = tag;
      state.selectedId = "";
      recipeStage.classList.remove("show-detail");
      render();
      renderTags();
    });
    tagRow.append(button);
  });
}

function getVisibleRecipes() {
  const query = state.query.trim().toLowerCase();
  const recipes = state.recipes.filter((recipe) => {
    const matchesQuery = !query || String(recipe.name || "").toLowerCase().includes(query);
    const matchesTag = state.tag === "전체" || recipe.category === state.tag || recipe.tags?.includes(state.tag);
    return matchesQuery && matchesTag;
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
    button.innerHTML = `<strong>${escapeHtml(recipe.name)}</strong><span>${escapeHtml(recipe.category || recipe.recipeType)} · ${escapeHtml(formatYield(recipe))} · ${escapeHtml(recipe.updatedAt || "-")}</span>`;
    button.addEventListener("click", () => {
      state.selectedId = recipe.recipeId;
      recipeStage.classList.add("show-detail");
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
  if (state.map) renderPlaces();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelector("#backButton").addEventListener("click", () => {
  recipeStage.classList.remove("show-detail");
});

deleteRecipeButton.addEventListener("click", handleDeleteRecipe);
document.querySelector("#refreshButton").addEventListener("click", loadRecipes);
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

  const previousStatus = statusText.textContent;
  setStatus("삭제 중", state.recipes.length);

  try {
    await deleteRecipe(recipe.recipeId);
    state.recipes = state.recipes.filter((item) => item.recipeId !== recipe.recipeId);
    state.selectedId = "";
    recipeStage.classList.remove("show-detail");
    setStatus(state.recipes.length ? `${state.recipes.length}개` : "없음", state.recipes.length);
    render();
  } catch (error) {
    setStatus(previousStatus || "오류", state.recipes.length);
    const message = error.message === "지원하지 않는 action입니다." ? "Apps Script 재배포 필요" : error.message;
    alert(message);
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
