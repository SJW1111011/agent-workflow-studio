const path = require("path");
const { fileExists, readJson, readText } = require("./fs-utils");
const { recipesIndexPath, recipesRoot } = require("./workspace");

function listRecipes(workspaceRoot) {
  const index = readJson(recipesIndexPath(workspaceRoot), { recipes: [] });
  return Array.isArray(index.recipes) ? index.recipes : [];
}

function getRecipe(workspaceRoot, recipeId) {
  const recipe = listRecipes(workspaceRoot).find((item) => item.id === normalizeRecipeId(recipeId));
  if (!recipe) {
    return null;
  }

  const absolutePath = path.join(recipesRoot(workspaceRoot), recipe.fileName);
  return {
    ...recipe,
    exists: fileExists(absolutePath),
    absolutePath,
    content: readText(absolutePath, ""),
  };
}

function normalizeRecipeId(recipeId) {
  return recipeId || "feature";
}

module.exports = {
  getRecipe,
  listRecipes,
  normalizeRecipeId,
};
