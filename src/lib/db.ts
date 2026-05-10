import { sql } from '@vercel/postgres';

export type Ingredient = {
  id: number;
  name: string;
  is_pinned: boolean;
  category: string;
  created_at: Date;
};

export type ShoppingItem = {
  id: number;
  name: string;
  is_completed: boolean;
  created_at: Date;
};

export type NutritionData = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type SavedRecipe = {
  id: number;
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition: NutritionData | null;
  genre: string | null;
  saved_at: string;
};

// --- Ingredients ---

export async function getIngredients(): Promise<Ingredient[]> {
  try {
    const { rows } = await sql<Ingredient>`SELECT * FROM ingredients ORDER BY is_pinned DESC, created_at DESC`;
    return rows;
  } catch (error) {
    console.error('Failed to fetch ingredients:', error);
    return [];
  }
}

export async function addIngredient(name: string, category: string = 'その他'): Promise<Ingredient | null> {
  try {
    const cleanName = name.trim();
    const { rows: existing } = await sql<Ingredient>`
      SELECT * FROM ingredients
      WHERE LOWER(TRIM(name)) = LOWER(${cleanName})
      LIMIT 1
    `;

    if (existing.length > 0) {
      return existing[0];
    }

    const { rows } = await sql<Ingredient>`
      INSERT INTO ingredients (name, is_pinned, category)
      VALUES (${cleanName}, false, ${category})
      RETURNING *
    `;
    return rows[0];
  } catch (error) {
    console.error('Failed to add ingredient:', error);
    return null;
  }
}

export async function deleteIngredient(id: number): Promise<boolean> {
  try {
    await sql`DELETE FROM ingredients WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.error('Failed to delete ingredient:', error);
    return false;
  }
}

export async function removeDuplicateIngredients(): Promise<number> {
  try {
    const result = await sql`
      DELETE FROM ingredients
      WHERE id NOT IN (
        SELECT MIN(id) FROM ingredients GROUP BY LOWER(TRIM(name))
      )
    `;
    const removed = result.rowCount ?? 0;
    console.log(`Removed ${removed} duplicate ingredient(s)`);
    return removed;
  } catch (error) {
    console.error('Failed to remove duplicate ingredients:', error);
    return 0;
  }
}

export async function togglePinIngredient(id: number, is_pinned: boolean): Promise<Ingredient | null> {
  try {
    const { rows } = await sql<Ingredient>`
      UPDATE ingredients SET is_pinned = ${is_pinned} WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to toggle pin ingredient:', error);
    return null;
  }
}

export async function updateIngredientCategory(id: number, category: string): Promise<Ingredient | null> {
  try {
    const { rows } = await sql<Ingredient>`
      UPDATE ingredients SET category = ${category} WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to update ingredient category:', error);
    return null;
  }
}

// --- Shopping List ---

export async function getShoppingList(): Promise<ShoppingItem[]> {
  try {
    const { rows } = await sql<ShoppingItem>`SELECT * FROM shopping_list ORDER BY created_at DESC`;
    return rows;
  } catch (error) {
    console.error('Failed to fetch shopping list:', error);
    return [];
  }
}

export async function addShoppingItem(name: string): Promise<ShoppingItem | null> {
  try {
    const { rows } = await sql<ShoppingItem>`
      INSERT INTO shopping_list (name)
      VALUES (${name})
      RETURNING *
    `;
    return rows[0];
  } catch (error) {
    console.error('Failed to add shopping item:', error);
    return null;
  }
}

export async function deleteShoppingItem(id: number): Promise<boolean> {
  try {
    await sql`DELETE FROM shopping_list WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.error('Failed to delete shopping item:', error);
    return false;
  }
}

export async function completeShoppingItem(id: number): Promise<boolean> {
  try {
    const { rows } = await sql<{ name: string }>`SELECT name FROM shopping_list WHERE id = ${id}`;
    if (rows.length === 0) return false;

    const name = rows[0].name;
    const cleanName = name.trim();

    const { rows: existing } = await sql`SELECT id FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(${cleanName})`;

    if (existing.length === 0) {
      await addIngredient(cleanName);
    }

    await sql`DELETE FROM shopping_list WHERE id = ${id}`;

    return true;
  } catch (error) {
    console.error('Failed to complete shopping item:', error);
    return false;
  }
}

// --- Saved Recipes ---

export async function getSavedRecipes(opts?: {
  search?: string;
  genre?: string;
  timeMax?: number;
}): Promise<SavedRecipe[]> {
  try {
    const { rows } = await sql<SavedRecipe>`SELECT * FROM recipes ORDER BY saved_at DESC`;

    let results = rows;

    if (opts?.search) {
      const q = opts.search.toLowerCase();
      results = results.filter(r => {
        const inTitle = r.title.toLowerCase().includes(q);
        const inIngredients = Array.isArray(r.ingredients) && r.ingredients.some((i: any) => i.name?.toLowerCase().includes(q));
        return inTitle || inIngredients;
      });
    }

    if (opts?.genre) {
      results = results.filter(r => r.genre === opts.genre);
    }

    if (opts?.timeMax) {
      results = results.filter(r => {
        const match = (r.time || '').match(/(\d+)/);
        if (!match) return true;
        return parseInt(match[1], 10) <= opts.timeMax!;
      });
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch saved recipes:', error);
    return [];
  }
}

export async function saveRecipe(recipe: {
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url: string | null;
  nutrition?: NutritionData | null;
  genre?: string | null;
}): Promise<SavedRecipe | null> {
  try {
    const ingredientsJson = JSON.stringify(recipe.ingredients ?? []);
    const stepsJson = JSON.stringify(recipe.steps ?? []);
    const nutritionJson = recipe.nutrition ? JSON.stringify(recipe.nutrition) : null;
    const genre = recipe.genre ?? null;
    const { rows } = await sql<SavedRecipe>`
      INSERT INTO recipes (title, time, ingredients, steps, tips, image_url, nutrition, genre)
      VALUES (
        ${recipe.title},
        ${recipe.time},
        ${ingredientsJson}::jsonb,
        ${stepsJson}::jsonb,
        ${recipe.tips},
        ${recipe.image_url},
        ${nutritionJson}::jsonb,
        ${genre}
      )
      RETURNING *
    `;
    return rows[0];
  } catch (error: any) {
    console.error('DB: Failed to save recipe. Error detail:', error.message, error.stack, JSON.stringify(recipe));
    return null;
  }
}

export async function deleteSavedRecipe(id: number): Promise<boolean> {
  try {
    await sql`DELETE FROM recipes WHERE id = ${id}`;
    return true;
  } catch (error) {
    console.error('Failed to delete recipe:', error);
    return false;
  }
}

export async function updateRecipeSavedAt(id: number): Promise<SavedRecipe | null> {
  try {
    const { rows } = await sql<SavedRecipe>`
      UPDATE recipes SET saved_at = CURRENT_TIMESTAMP WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to update recipe saved_at:', error);
    return null;
  }
}

export async function getRecentRecipeNames(limit: number = 5): Promise<string[]> {
  try {
    const { rows } = await sql<{ title: string }>`
      SELECT title FROM recipes ORDER BY saved_at DESC LIMIT ${limit}
    `;
    return rows.map(r => r.title);
  } catch (error) {
    console.error('Failed to fetch recent recipe names:', error);
    return [];
  }
}

export async function getRecentRecipesWithNutrition(limit: number = 15): Promise<SavedRecipe[]> {
  try {
    const { rows } = await sql<SavedRecipe>`
      SELECT * FROM recipes
      WHERE nutrition IS NOT NULL
      ORDER BY saved_at DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch (error) {
    console.error('Failed to fetch recent recipes with nutrition:', error);
    return [];
  }
}
