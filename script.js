const sheetId = "1Le4nNsN2k91YX1mQQpqT5Gbt499u3AFSlKfHRo2gUl8";
const sheetGid = "0";
const jsonpCallbackName = "__recipeSheetLoaded";
const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${sheetGid}&headers=0&tqx=out:json;responseHandler:${jsonpCallbackName}`;

const fallbackRecipes = [
  {
    id: "sample-kimchi-rice",
    title: "김치볶음밥",
    category: "샘플",
    time: "15분",
    servings: "1인분",
    note: "시트를 읽지 못했을 때 보이는 예시입니다.",
    ingredients: ["밥 1공기", "김치 1/2컵", "대파", "간장", "참기름"],
    steps: ["대파를 볶아 향을 냅니다.", "김치를 넣고 볶습니다.", "밥과 간장을 넣고 섞습니다.", "참기름으로 마무리합니다."],
  },
];

const state = {
  recipes: [],
  selectedId: "",
  query: "",
  loadingScript: null,
  timeoutId: null,
};

const recipeStage = document.querySelector("#recipeStage");
const recipeList = document.querySelector("#recipeList");
const searchInput = document.querySelector("#searchInput");
const statusText = document.querySelector("#statusText");
const recipeCount = document.querySelector("#recipeCount");
const emptyDetail = document.querySelector("#emptyDetail");
const recipeDetail = document.querySelector("#recipeDetail");
const detailCategory = document.querySelector("#detailCategory");
const detailTitle = document.querySelector("#detailTitle");
const detailNote = document.querySelector("#detailNote");
const detailTime = document.querySelector("#detailTime");
const detailServings = document.querySelector("#detailServings");
const ingredientList = document.querySelector("#ingredientList");
const stepList = document.querySelector("#stepList");

function loadRecipes() {
  clearSheetRequest();
  setStatus("시트에서 레시피를 불러오는 중...", 0);

  window[jsonpCallbackName] = (data) => {
    clearTimeout(state.timeoutId);
    try {
      const recipes = parseSheetData(data);
      if (!recipes.length) throw new Error("no recipes");

      state.recipes = recipes;
      state.selectedId = "";
      recipeStage.classList.remove("show-detail");
      setStatus(`${recipes.length}개의 레시피를 불러왔습니다.`, recipes.length);
      render();
    } catch {
      showFallback();
    } finally {
      clearSheetRequest();
    }
  };

  state.timeoutId = window.setTimeout(showFallback, 9000);

  const script = document.createElement("script");
  script.src = `${sheetUrl}&cachebust=${Date.now()}`;
  script.async = true;
  script.onerror = showFallback;
  document.head.append(script);
  state.loadingScript = script;
}

function clearSheetRequest() {
  if (state.loadingScript) state.loadingScript.remove();
  if (state.timeoutId) clearTimeout(state.timeoutId);
  state.loadingScript = null;
  state.timeoutId = null;
}

function showFallback() {
  clearSheetRequest();
  state.recipes = fallbackRecipes;
  state.selectedId = "";
  recipeStage.classList.remove("show-detail");
  setStatus("시트를 읽지 못해 샘플을 표시합니다. 공유 권한을 확인해주세요.", fallbackRecipes.length);
  render();
}

function parseSheetData(data) {
  const rows = data.table.rows.map((row) => row.c.map((cell) => String(cell?.f || cell?.v || "").trim()));
  return parseRecipeBlocks(rows);
}

function parseRecipeBlocks(rows) {
  const recipes = [];
  const maxColumns = Math.max(...rows.map((row) => row.length));

  for (let column = 0; column < maxColumns - 1; column += 3) {
    recipes.push(...parseColumnPair(rows, column, column + 1));
  }

  return recipes.map((recipe, index) => ({
    ...recipe,
    id: `sheet-recipe-${index}`,
  }));
}

function parseColumnPair(rows, nameColumn, valueColumn) {
  const recipes = [];
  let pendingMeta = [];
  let current = null;

  rows.forEach((row, rowIndex) => {
    const name = cleanCell(row[nameColumn]);
    const value = cleanCell(row[valueColumn]);
    const looksLikeTitle = isLikelyTitle(name) && !value && hasDetailRowsBelow(rows, nameColumn, valueColumn, rowIndex);

    if (looksLikeTitle) {
      if (current) recipes.push(finalizeRecipe(current));
      current = {
        title: name,
        category: "Sheet",
        meta: pendingMeta,
        ingredients: [],
        steps: [],
      };
      pendingMeta = [];
      return;
    }

    if (!name && !value) return;

    const line = formatPair(name, value);
    if (!line) return;

    if (!current) {
      pendingMeta.push(line);
      return;
    }

    if (isProcessLine(name)) current.steps.push(line);
    else current.ingredients.push(line);
  });

  if (current) recipes.push(finalizeRecipe(current));
  return recipes.filter((recipe) => recipe.title && recipe.ingredients.length + recipe.steps.length > 0);
}

function hasDetailRowsBelow(rows, nameColumn, valueColumn, rowIndex) {
  const nextRows = rows.slice(rowIndex + 1, rowIndex + 17);
  return nextRows.filter((row) => cleanCell(row[nameColumn]) && cleanCell(row[valueColumn])).length >= 2;
}

function finalizeRecipe(recipe) {
  const infoLines = [...recipe.meta, ...recipe.steps];
  const time = findTime(infoLines) || findTime(recipe.ingredients) || "-";

  return {
    title: recipe.title,
    category: recipe.category,
    time,
    servings: "-",
    note: infoLines.join(" · "),
    ingredients: recipe.ingredients,
    steps: infoLines.length ? infoLines : ["시트에 별도 과정이 없으면 재료/정보 목록을 확인하세요."],
  };
}

function cleanCell(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatPair(name, value) {
  if (name && value) return `${name}: ${value}`;
  return name || value;
}

function isLikelyTitle(value) {
  return Boolean(value) && !/[=:]/.test(value) && !/^\d/.test(value) && !/(ml|gram|g|cup|tbsp|tsp|oz|°f|℃)$/i.test(value);
}

function isProcessLine(value) {
  return /temp|fridge|second|seccond|stretch|fold|bake|oven|°f|℃|hours?|mins?|분|시간/i.test(value || "");
}

function findTime(lines) {
  const match = lines.find((line) => /(\d|half|one).*(min|hour|분|시간)|\d+\s*-\s*\d+/.test(line.toLowerCase()));
  return match ? match.replace(/^.*?:\s*/, "") : "";
}

function getVisibleRecipes() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.recipes;
  return state.recipes.filter((recipe) => recipe.title.toLowerCase().includes(query));
}

function getSelectedRecipe() {
  return state.recipes.find((recipe) => recipe.id === state.selectedId);
}

function setStatus(message, count) {
  statusText.textContent = message;
  recipeCount.textContent = count;
}

function renderList() {
  const recipes = getVisibleRecipes();
  recipeList.innerHTML = "";

  if (!recipes.length) {
    recipeList.innerHTML = '<p class="empty-state">검색 결과가 없습니다.</p>';
    return;
  }

  recipes.forEach((recipe) => {
    const button = document.createElement("button");
    button.className = `recipe-title-button${recipe.id === state.selectedId ? " active" : ""}`;
    button.type = "button";
    button.textContent = recipe.title;
    button.addEventListener("click", () => {
      state.selectedId = recipe.id;
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
  if (!recipe) return;

  detailCategory.textContent = recipe.category;
  detailTitle.textContent = recipe.title;
  detailNote.textContent = recipe.note || "";
  detailTime.textContent = recipe.time;
  detailServings.textContent = recipe.servings;
  renderItems(ingredientList, recipe.ingredients, "등록된 재료가 없습니다.");
  renderItems(stepList, recipe.steps, "등록된 조리 순서가 없습니다.");
}

function renderItems(container, items, emptyText) {
  container.innerHTML = "";
  const visibleItems = items.length ? items : [emptyText];

  visibleItems.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.append(li);
  });
}

function render() {
  renderList();
  renderDetail();
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.selectedId = "";
  recipeStage.classList.remove("show-detail");
  render();
});

document.querySelector("#backButton").addEventListener("click", () => {
  recipeStage.classList.remove("show-detail");
});

document.querySelector("#refreshButton").addEventListener("click", loadRecipes);

loadRecipes();
