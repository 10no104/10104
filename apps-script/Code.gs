const SPREADSHEET_ID = "1Le4nNsN2k91YX1mQQpqT5Gbt499u3AFSlKfHRo2gUl8";

const SHEETS = {
  RECIPES: "App_Recipes",
  INGREDIENTS: "App_Ingredients",
  STEPS: "App_Steps",
  FEEDBACK: "App_Feedback",
  VERSIONS: "App_Versions",
  REFERENCE_DATA: "App_ReferenceData",
  SETTINGS: "App_Settings",
};

const HEADERS = {
  [SHEETS.RECIPES]: [
    "recipeId",
    "name",
    "recipeType",
    "description",
    "sourceName",
    "sourceUrl",
    "category",
    "tagsJson",
    "baseYield",
    "yieldUnit",
    "imageUrl",
    "ovenTemperatureC",
    "ovenTemperatureF",
    "bakeTimeMinutes",
    "firstProofMinutes",
    "secondProofMinutes",
    "proofTemperatureC",
    "restTimeMinutes",
    "panSize",
    "cookTimeMinutes",
    "cookTemperatureC",
    "glassType",
    "cocktailMethod",
    "ice",
    "garnish",
    "finalVolumeMl",
    "notes",
    "currentVersion",
    "createdAt",
    "updatedAt",
    "isArchived",
  ],
  [SHEETS.INGREDIENTS]: ["ingredientId", "recipeId", "version", "groupName", "sortOrder", "name", "amount", "unit", "notes"],
  [SHEETS.STEPS]: ["stepId", "recipeId", "version", "sortOrder", "instruction", "durationMinutes", "temperatureC", "notes"],
  [SHEETS.FEEDBACK]: [
    "feedbackId",
    "recipeId",
    "recipeVersion",
    "rating",
    "result",
    "problems",
    "nextChanges",
    "actualYield",
    "actualYieldUnit",
    "imageUrl",
    "status",
    "createdAt",
    "updatedAt",
  ],
  [SHEETS.VERSIONS]: ["versionId", "recipeId", "version", "snapshotJson", "changeReason", "feedbackId", "createdAt"],
  [SHEETS.REFERENCE_DATA]: ["referenceId", "category", "name", "value", "unit", "source", "note", "sortOrder", "isActive"],
  [SHEETS.SETTINGS]: ["key", "value", "description"],
};

function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const created = [];
  const untouched = [];
  const headerAdded = [];

  Object.keys(HEADERS).forEach((sheetName) => {
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      created.push(sheetName);
    } else {
      untouched.push(sheetName);
    }

    if (isHeaderMissing_(sheet)) {
      sheet.getRange(1, 1, 1, HEADERS[sheetName].length).setValues([HEADERS[sheetName]]);
      sheet.setFrozenRows(1);
      headerAdded.push(sheetName);
    }
  });

  const result = { created, untouched, headerAdded };
  Logger.log(JSON.stringify(result));
  return result;
}

function doGet(e) {
  const request = e.parameter || {};
  return respond_(handleRequest_(request), request.callback);
}

function doPost(e) {
  let body = {};
  try {
    body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (error) {
    return respond_(fail_("BAD_JSON", "JSON 본문을 읽을 수 없습니다."));
  }

  return respond_(handleRequest_(body));
}

function handleRequest_(request) {
  try {
    const action = request.action;
    if (action === "listRecipes") return ok_(listRecipes_(request.type));
    if (action === "getRecipe") return ok_(getRecipe_(request.recipeId));
    if (action === "setupSpreadsheet") return ok_(setupSpreadsheet());
    return fail_("UNKNOWN_ACTION", "지원하지 않는 action입니다.");
  } catch (error) {
    return fail_("SERVER_ERROR", error.message);
  }
}

function listRecipes_(recipeType) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const recipeRows = readObjects_(ss, SHEETS.RECIPES);
  const ingredients = readObjects_(ss, SHEETS.INGREDIENTS);
  const steps = readObjects_(ss, SHEETS.STEPS);
  const feedback = readObjects_(ss, SHEETS.FEEDBACK);

  return recipeRows
    .filter((recipe) => String(recipe.isArchived).toLowerCase() !== "true")
    .filter((recipe) => !recipeType || recipe.recipeType === recipeType)
    .map((recipe) => decorateRecipe_(recipe, ingredients, steps, feedback));
}

function getRecipe_(recipeId) {
  if (!recipeId) throw new Error("recipeId가 필요합니다.");
  const recipe = listRecipes_("").find((item) => item.recipeId === recipeId);
  if (!recipe) throw new Error("레시피를 찾을 수 없습니다.");
  return recipe;
}

function decorateRecipe_(recipe, ingredients, steps, feedback) {
  const version = recipe.currentVersion || "";
  const recipeFeedback = feedback.filter((item) => item.recipeId === recipe.recipeId);
  const latest = recipeFeedback.length ? recipeFeedback[recipeFeedback.length - 1].result : "";

  return {
    ...recipe,
    ingredients: ingredients
      .filter((item) => item.recipeId === recipe.recipeId && (!version || String(item.version) === String(version)))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    steps: steps
      .filter((item) => item.recipeId === recipe.recipeId && (!version || String(item.version) === String(version)))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    feedbackCount: recipeFeedback.length,
    latestFeedback: latest || "",
  };
}

function readObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1).filter((row) => row.some(Boolean)).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index];
    });
    return object;
  });
}

function isHeaderMissing_(sheet) {
  if (sheet.getLastRow() === 0) return true;
  const firstRow = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
  return firstRow.every((cell) => cell === "");
}

function ok_(data) {
  return { ok: true, data, error: null };
}

function fail_(code, message) {
  return { ok: false, data: null, error: { code, message } };
}

function respond_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
