import { CONFIG } from "./assets/js/config.js";

const VIEWS = {
  baking: {
    title: "베이킹",
    description: "App_ 전용 탭에 저장된 베이킹 레시피를 확인합니다.",
    type: "baking",
    tags: ["전체", "빵", "쿠키", "케이크", "타르트", "발효빵"],
  },
  cocktail: {
    title: "칵테일",
    description: "칵테일 레시피와 제조 정보를 빠르게 확인합니다.",
    type: "cocktail",
    tags: ["전체", "진", "럼", "위스키", "보드카", "무알코올"],
  },
  cooking: {
    title: "요리",
    description: "일반 요리 레시피와 조리 메모를 모아 봅니다.",
    type: "cooking",
    tags: ["전체", "한식", "파스타", "소스", "찌개", "반찬"],
  },
};

const SAMPLE_RECIPES = [
  {
    recipeId: "sample-baking-1",
    name: "Pizza Dough",
    recipeType: "baking",
    description: "실제 API 연결 전 화면 확인용 샘플입니다.",
    sourceName: "Sample",
    sourceUrl: "",
    category: "발효빵",
    tags: ["빵", "발효빵"],
    baseYield: "2",
    yieldUnit: "balls",
    updatedAt: "2026-07-12",
    feedbackCount: 0,
    ingredients: [
      { name: "Water", amount: "600", unit: "ml", groupName: "반죽" },
      { name: "Yeast", amount: "1", unit: "tsp", groupName: "반죽" },
      { name: "Bread Flour", amount: "600", unit: "g", groupName: "반죽" },
      { name: "Salt", amount: "1", unit: "Tbsp", groupName: "반죽" },
    ],
    steps: [
      { instruction: "재료를 섞어 반죽을 만듭니다." },
      { instruction: "실온에서 2시간 또는 냉장고에서 1~7일 발효합니다." },
      { instruction: "500°F에서 6~7분 굽습니다." },
    ],
  },
  {
    recipeId: "sample-baking-2",
    name: "우유 식빵",
    recipeType: "baking",
    description: "부드러운 우유 식빵 샘플입니다.",
    category: "빵",
    tags: ["빵"],
    baseYield: "1",
    yieldUnit: "loaf",
    updatedAt: "2026-07-12",
    feedbackCount: 0,
    ingredients: [
      { name: "Milk", amount: "200", unit: "ml", groupName: "반죽" },
      { name: "Yeast", amount: "3", unit: "g", groupName: "반죽" },
      { name: "Bread Flour", amount: "250", unit: "g", groupName: "반죽" },
      { name: "Butter", amount: "20", unit: "g", groupName: "반죽" },
    ],
    steps: [{ instruction: "반죽 후 1차, 2차 발효를 진행합니다." }, { instruction: "355°F에서 25분 굽습니다." }],
  },
];

const state = {
  view: "baking",
  recipes: [],
  selectedId: "",
  query: "",
  tag: "전체",
  sort: "updatedAt",
  apiReady: Boolean(CONFIG.APPS_SCRIPT_URL),
};

const sectionTitle = document.querySelector("#sectionTitle");
const sectionDescription = document.querySelector("#sectionDescription");
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
const ingredientList = document.querySelector("#ingredientList");
const stepList = document.querySelector("#stepList");
const latestFeedbackCard = document.querySelector("#latestFeedbackCard");
const latestFeedback = document.querySelector("#latestFeedback");
const mapFrame = document.querySelector("#mapFrame");
const mapOpenLink = document.querySelector("#mapOpenLink");
const convertAmount = document.querySelector("#convertAmount");
const convertFrom = document.querySelector("#convertFrom");
const convertResult = document.querySelector("#convertResult");

function apiUrl(action, params = {}) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function apiGet(action, params) {
  if (!CONFIG.APPS_SCRIPT_URL) throw new Error("NO_API_URL");
  const payload = await jsonp(apiUrl(action, params));
  if (!payload.ok) throw new Error(payload.error?.message || "API_ERROR");
  return payload.data;
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `__recipeApi_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const script = document.createElement("script");
    const requestUrl = new URL(url);
    requestUrl.searchParams.set("callback", callback);

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("API_TIMEOUT"));
    }, 10000);

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
      reject(new Error("API_LOAD_ERROR"));
    };

    script.src = requestUrl.toString();
    script.async = true;
    document.head.append(script);
  });
}

async function loadRecipes() {
  const current = VIEWS[state.view];
  state.selectedId = "";
  recipeStage.classList.remove("show-detail");
  setStatus("레시피를 불러오는 중...", 0);

  if (!current) {
    renderStaticView();
    return;
  }

  try {
    const recipes = await apiGet("listRecipes", { type: current.type });
    state.recipes = normalizeRecipes(recipes);
    setStatus(`${state.recipes.length}개의 레시피를 불러왔습니다.`, state.recipes.length);
  } catch (error) {
    state.recipes = SAMPLE_RECIPES.filter((recipe) => recipe.recipeType === current.type);
    setStatus(
      state.apiReady
        ? "API 응답을 읽지 못해 샘플을 표시합니다."
        : "Apps Script URL이 비어 있어 샘플을 표시합니다.",
      state.recipes.length,
    );
  }

  render();
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
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (VIEWS[view]) {
    document.querySelector("#recipesScreen").classList.add("active");
    document.querySelector("#mapScreen").classList.remove("active");
    document.querySelector("#toolsScreen").classList.remove("active");
    sectionTitle.textContent = VIEWS[view].title;
    sectionDescription.textContent = VIEWS[view].description;
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
  sectionTitle.textContent = state.view === "map" ? "지도" : "계산·정보";
  sectionDescription.textContent =
    state.view === "map" ? "저장한 Google My Maps를 확인합니다." : "단위 계산과 조리 기준 정보를 확인합니다.";
  setStatus(state.view === "map" ? "지도를 표시합니다." : "계산 도구를 사용할 수 있습니다.", 0);
  recipeCount.textContent = "-";
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
    const matchesQuery = !query || recipe.name.toLowerCase().includes(query);
    const matchesTag = state.tag === "전체" || recipe.category === state.tag || recipe.tags?.includes(state.tag);
    return matchesQuery && matchesTag;
  });

  return recipes.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name, "ko");
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
    recipeList.innerHTML = '<p class="empty-state">표시할 레시피가 없습니다.</p>';
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
  if (!recipe) return;

  detailType.textContent = recipe.recipeType || "Recipe";
  detailName.textContent = recipe.name;
  detailDescription.textContent = recipe.description || recipe.notes || "";
  detailYield.textContent = formatYield(recipe);
  detailUpdated.textContent = recipe.updatedAt || "-";
  detailFeedback.textContent = recipe.feedbackCount || 0;

  sourceLink.hidden = !recipe.sourceUrl;
  sourceLink.href = recipe.sourceUrl || "#";
  sourceLink.textContent = recipe.sourceName ? `${recipe.sourceName} 보기` : "출처 보기";

  renderIngredients(recipe.ingredients || []);
  renderSteps(recipe.steps || []);

  if (recipe.latestFeedback) latestFeedback.textContent = recipe.latestFeedback;
}

function renderIngredients(items) {
  ingredientList.innerHTML = "";
  const list = items.length ? items : [{ name: "등록된 재료가 없습니다.", amount: "", unit: "" }];
  list.forEach((item) => {
    const li = document.createElement("li");
    const group = item.groupName ? `[${item.groupName}] ` : "";
    li.textContent = `${group}${item.name || ""} ${item.amount || ""} ${item.unit || ""}`.trim();
    ingredientList.append(li);
  });
}

function renderSteps(items) {
  stepList.innerHTML = "";
  const list = items.length ? items : [{ instruction: "등록된 조리 순서가 없습니다." }];
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

function updateHash() {
  history.replaceState(null, "", `#${state.view}`);
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

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.selectedId = "";
  recipeStage.classList.remove("show-detail");
  render();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelector("#backButton").addEventListener("click", () => {
  recipeStage.classList.remove("show-detail");
});

document.querySelector("#refreshButton").addEventListener("click", loadRecipes);
convertAmount.addEventListener("input", updateConverter);
convertFrom.addEventListener("change", updateConverter);

mapFrame.src = CONFIG.MAP_EMBED_URL;
mapOpenLink.href = CONFIG.MAP_EMBED_URL;

initFromHash();
updateConverter();
setView(state.view);
