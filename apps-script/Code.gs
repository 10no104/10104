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
    if (action === "createRecipe") return ok_(createRecipe_(parseData_(request.data || request)));
    if (action === "deleteRecipe") return ok_(deleteRecipe_(request.recipeId));
    if (action === "createPlace") return ok_(createPlace_(parseData_(request.data || request)));
    if (action === "deletePlace") return ok_(deletePlace_(request.placeId));
    if (action === "setupSpreadsheet") return ok_(setupSpreadsheet());
    return fail_("UNKNOWN_ACTION", "지원하지 않는 action입니다.");
  } catch (error) {
    return fail_("SERVER_ERROR", error.message);
  }
}

function createRecipe_(data) {
  if (!data || !data.name) throw new Error("레시피 이름이 필요합니다.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    setupSpreadsheet();

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const recipeId = Utilities.getUuid();
    const version = "1";
    const now = new Date().toISOString();
    const recipe = {
      recipeId,
      name: String(data.name || "").trim(),
      recipeType: String(data.recipeType || "baking").trim(),
      description: String(data.description || "").trim(),
      sourceName: String(data.sourceName || "").trim(),
      sourceUrl: String(data.sourceUrl || "").trim(),
      category: String(data.category || "").trim(),
      tagsJson: JSON.stringify(data.tags || []),
      baseYield: String(data.baseYield || "").trim(),
      yieldUnit: String(data.yieldUnit || "").trim(),
      imageUrl: String(data.imageUrl || "").trim(),
      notes: String(data.notes || "").trim(),
      currentVersion: version,
      createdAt: now,
      updatedAt: now,
      isArchived: "false",
    };

    appendObject_(ss, SHEETS.RECIPES, recipe);

    (data.ingredients || []).forEach((item, index) => {
      appendObject_(ss, SHEETS.INGREDIENTS, {
        ingredientId: Utilities.getUuid(),
        recipeId,
        version,
        groupName: item.groupName || "",
        sortOrder: item.sortOrder || index + 1,
        name: item.name || "",
        amount: item.amount || "",
        unit: item.unit || "",
        notes: item.notes || "",
      });
    });

    (data.steps || []).forEach((item, index) => {
      appendObject_(ss, SHEETS.STEPS, {
        stepId: Utilities.getUuid(),
        recipeId,
        version,
        sortOrder: item.sortOrder || index + 1,
        instruction: item.instruction || "",
        durationMinutes: item.durationMinutes || "",
        temperatureC: item.temperatureC || "",
        notes: item.notes || "",
      });
    });

    return getRecipe_(recipeId);
  } finally {
    lock.releaseLock();
  }
}

function deleteRecipe_(recipeId) {
  if (!recipeId) throw new Error("recipeId가 필요합니다.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.RECIPES);
    if (!sheet) throw new Error("App_Recipes 시트를 찾을 수 없습니다.");

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) throw new Error("레시피를 찾을 수 없습니다.");

    const headers = values[0].map(String);
    const recipeIdColumn = headers.indexOf("recipeId") + 1;
    const archivedColumn = headers.indexOf("isArchived") + 1;
    const updatedAtColumn = headers.indexOf("updatedAt") + 1;
    if (!recipeIdColumn || !archivedColumn) throw new Error("필수 컬럼을 찾을 수 없습니다.");

    for (let rowIndex = 2; rowIndex <= values.length; rowIndex += 1) {
      if (String(values[rowIndex - 1][recipeIdColumn - 1]) === String(recipeId)) {
        sheet.getRange(rowIndex, archivedColumn).setValue("true");
        if (updatedAtColumn) sheet.getRange(rowIndex, updatedAtColumn).setValue(new Date().toISOString());
        return { recipeId, isArchived: true };
      }
    }

    throw new Error("레시피를 찾을 수 없습니다.");
  } finally {
    lock.releaseLock();
  }
}

function createPlace_(data) {
  if (!data || !data.name) throw new Error("장소명이 필요합니다.");

  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (!isFinite(lat) || !isFinite(lng)) throw new Error("좌표가 필요합니다.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    setupSpreadsheet();

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const type = String(data.type || "기타").trim();
    const place = {
      referenceId: Utilities.getUuid(),
      category: "place",
      name: String(data.name || "").trim(),
      value: JSON.stringify({
        lat,
        lng,
        type,
        googleMapsUrl: String(data.googleMapsUrl || "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng).trim(),
      }),
      unit: "",
      source: String(data.source || "map-search").trim(),
      note: String(data.note || "").trim(),
      sortOrder: "",
      isActive: "true",
    };

    appendObject_(ss, SHEETS.REFERENCE_DATA, place);
    return place;
  } finally {
    lock.releaseLock();
  }
}

function deletePlace_(placeId) {
  if (!placeId) throw new Error("placeId가 필요합니다.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEETS.REFERENCE_DATA);
    if (!sheet) throw new Error("App_ReferenceData 시트를 찾을 수 없습니다.");

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) throw new Error("장소를 찾을 수 없습니다.");

    const headers = values[0].map(String);
    const referenceIdColumn = headers.indexOf("referenceId") + 1;
    const isActiveColumn = headers.indexOf("isActive") + 1;
    if (!referenceIdColumn || !isActiveColumn) throw new Error("필수 컬럼을 찾을 수 없습니다.");

    for (let rowIndex = 2; rowIndex <= values.length; rowIndex += 1) {
      if (String(values[rowIndex - 1][referenceIdColumn - 1]) === String(placeId)) {
        sheet.getRange(rowIndex, isActiveColumn).setValue("false");
        return { placeId, isActive: false };
      }
    }

    throw new Error("장소를 찾을 수 없습니다.");
  } finally {
    lock.releaseLock();
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

function appendObject_(ss, sheetName, object) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + " 시트를 찾을 수 없습니다.");

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = headers.map((header) => object[header] !== undefined ? object[header] : "");
  sheet.appendRow(row);
}

function parseData_(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error("data JSON을 읽을 수 없습니다.");
  }
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
