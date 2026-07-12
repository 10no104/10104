const storageKey = "recipe-library-v1";

const starterRecipes = [
  {
    id: "kimchi-rice",
    title: "김치볶음밥",
    category: "한식",
    time: "15분",
    servings: "1인분",
    note: "냉장고 재료로 빠르게 만드는 든든한 한 끼.",
    ingredients: ["밥 1공기", "잘 익은 김치 1/2컵", "대파 한 줌", "간장 1작은술", "참기름 약간"],
    steps: ["대파를 먼저 볶아 향을 낸다.", "김치를 넣고 물기가 줄 때까지 볶는다.", "밥과 간장을 넣고 고루 섞는다.", "불을 끄고 참기름을 둘러 마무리한다."],
  },
  {
    id: "tomato-egg",
    title: "토마토 달걀볶음",
    category: "간식",
    time: "12분",
    servings: "2인분",
    note: "가볍게 먹기 좋은 부드러운 반찬 겸 브런치.",
    ingredients: ["토마토 2개", "달걀 3개", "소금 한 꼬집", "설탕 1작은술", "식용유"],
    steps: ["달걀에 소금을 넣고 풀어 둔다.", "팬에 달걀을 부드럽게 익힌 뒤 덜어 둔다.", "토마토와 설탕을 넣고 살짝 볶는다.", "달걀을 다시 넣고 크게 섞어 낸다."],
  },
  {
    id: "cream-pasta",
    title: "버섯 크림파스타",
    category: "양식",
    time: "25분",
    servings: "2인분",
    note: "버섯 향이 진한 주말용 파스타.",
    ingredients: ["파스타면 180g", "양송이버섯 6개", "마늘 3쪽", "생크림 1컵", "파르메산 치즈"],
    steps: ["면을 봉지 표기보다 1분 짧게 삶는다.", "마늘과 버섯을 노릇하게 볶는다.", "생크림과 면수를 넣어 농도를 맞춘다.", "면과 치즈를 넣고 소스가 배도록 섞는다."],
  },
];

const state = {
  recipes: loadRecipes(),
  selectedId: "",
  filter: "all",
  query: "",
  checks: {},
  isCreating: false,
};

const recipeList = document.querySelector("#recipeList");
const searchInput = document.querySelector("#searchInput");
const selectedCategory = document.querySelector("#selectedCategory");
const selectedTitle = document.querySelector("#selectedTitle");
const selectedNote = document.querySelector("#selectedNote");
const selectedTime = document.querySelector("#selectedTime");
const selectedServings = document.querySelector("#selectedServings");
const ingredientChecklist = document.querySelector("#ingredientChecklist");
const stepChecklist = document.querySelector("#stepChecklist");
const recipeForm = document.querySelector("#recipeForm");

function loadRecipes() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return starterRecipes;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : starterRecipes;
  } catch {
    return starterRecipes;
  }
}

function saveRecipes() {
  localStorage.setItem(storageKey, JSON.stringify(state.recipes));
}

function linesToList(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function makeId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `recipe-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function getVisibleRecipes() {
  const query = state.query.trim().toLowerCase();
  return state.recipes.filter((recipe) => {
    const matchesFilter = state.filter === "all" || recipe.category === state.filter;
    const haystack = [recipe.title, recipe.category, recipe.note, ...recipe.ingredients, ...recipe.steps]
      .join(" ")
      .toLowerCase();
    return matchesFilter && haystack.includes(query);
  });
}

function getSelectedRecipe() {
  return state.recipes.find((recipe) => recipe.id === state.selectedId) || state.recipes[0];
}

function selectRecipe(id) {
  state.selectedId = id;
  state.isCreating = false;
  render();
}

function renderList() {
  const visibleRecipes = getVisibleRecipes();
  recipeList.innerHTML = "";

  if (!visibleRecipes.length) {
    recipeList.innerHTML = '<div class="empty-state">검색 조건에 맞는 레시피가 없어요. 새 레시피를 추가해 보세요.</div>';
    return;
  }

  if (!visibleRecipes.some((recipe) => recipe.id === state.selectedId)) {
    state.selectedId = visibleRecipes[0].id;
  }

  visibleRecipes.forEach((recipe) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recipe-card${recipe.id === state.selectedId ? " active" : ""}`;
    button.innerHTML = `<strong>${recipe.title}</strong><span>${recipe.category} · ${recipe.time} · ${recipe.servings}</span>`;
    button.addEventListener("click", () => selectRecipe(recipe.id));
    recipeList.append(button);
  });
}

function renderDetail() {
  const recipe = getSelectedRecipe();
  if (!recipe) return;

  selectedCategory.textContent = recipe.category;
  selectedTitle.textContent = recipe.title;
  selectedNote.textContent = recipe.note;
  selectedTime.textContent = recipe.time;
  selectedServings.textContent = recipe.servings;

  renderChecklist(ingredientChecklist, recipe, "ingredients");
  renderChecklist(stepChecklist, recipe, "steps");
}

function renderChecklist(container, recipe, type) {
  const values = recipe[type];
  const checkGroup = `${recipe.id}:${type}`;
  state.checks[checkGroup] ||= [];
  container.innerHTML = "";

  values.forEach((value, index) => {
    const id = `${checkGroup}:${index}`;
    const label = document.createElement("label");
    label.className = "check-item";
    label.innerHTML = `<input type="checkbox" ${state.checks[checkGroup].includes(index) ? "checked" : ""} /><span>${type === "steps" ? `${index + 1}. ` : ""}${value}</span>`;
    label.querySelector("input").addEventListener("change", (event) => {
      const checked = new Set(state.checks[checkGroup]);
      if (event.target.checked) checked.add(index);
      else checked.delete(index);
      state.checks[checkGroup] = [...checked];
    });
    label.querySelector("input").id = id;
    container.append(label);
  });
}

function renderForm() {
  const recipe = getSelectedRecipe();
  document.querySelector("#formTitle").textContent = state.isCreating ? "새 레시피 추가" : "레시피 수정";

  if (state.isCreating || !recipe) {
    recipeForm.reset();
    document.querySelector("#categoryInput").value = "한식";
    return;
  }

  document.querySelector("#titleInput").value = recipe.title;
  document.querySelector("#categoryInput").value = recipe.category;
  document.querySelector("#timeInput").value = recipe.time;
  document.querySelector("#servingsInput").value = recipe.servings;
  document.querySelector("#noteInput").value = recipe.note;
  document.querySelector("#ingredientsInput").value = recipe.ingredients.join("\n");
  document.querySelector("#stepsInput").value = recipe.steps.join("\n");
}

function render() {
  renderList();
  renderDetail();
  renderForm();
}

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
    chip.classList.add("active");
    state.filter = chip.dataset.filter;
    render();
  });
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}Panel`).classList.add("active");
  });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

document.querySelector("#resetChecks").addEventListener("click", () => {
  const recipe = getSelectedRecipe();
  if (!recipe) return;
  delete state.checks[`${recipe.id}:ingredients`];
  delete state.checks[`${recipe.id}:steps`];
  renderDetail();
});

recipeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const activeRecipe = getSelectedRecipe();
  const formRecipe = {
    id: state.isCreating ? makeId() : activeRecipe?.id || makeId(),
    title: document.querySelector("#titleInput").value.trim(),
    category: document.querySelector("#categoryInput").value,
    time: document.querySelector("#timeInput").value.trim(),
    servings: document.querySelector("#servingsInput").value.trim(),
    note: document.querySelector("#noteInput").value.trim(),
    ingredients: linesToList(document.querySelector("#ingredientsInput").value),
    steps: linesToList(document.querySelector("#stepsInput").value),
  };

  const existingIndex = state.recipes.findIndex((recipe) => recipe.id === formRecipe.id);
  if (existingIndex >= 0) state.recipes[existingIndex] = formRecipe;
  else state.recipes.unshift(formRecipe);

  state.selectedId = formRecipe.id;
  state.isCreating = false;
  saveRecipes();
  render();
});

document.querySelector("#newRecipe").addEventListener("click", () => {
  state.isCreating = true;
  renderForm();
  document.querySelector("#titleInput").focus();
});

document.querySelector("#deleteRecipe").addEventListener("click", () => {
  if (state.recipes.length <= 1) return;

  state.recipes = state.recipes.filter((recipe) => recipe.id !== state.selectedId);
  state.selectedId = state.recipes[0]?.id || "";
  saveRecipes();
  render();
});

state.selectedId = state.recipes[0]?.id || "";
render();
