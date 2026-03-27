import { sql } from '@vercel/postgres';

export type Ingredient = {
  id: number;
  name: string;
  created_at: Date;
};

export type SavedRecipe = {
  id: number;
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  image_url: string | null;
  saved_at: string;
};

// --- Ingredients ---

export async function getIngredients(): Promise<Ingredient[]> {
  try {
    const { rows } = await sql<Ingredient>`SELECT * FROM ingredients ORDER BY created_at DESC`;
    return rows;
  } catch (error) {
    console.error('Failed to fetch ingredients:', error);
    return [];
  }
}

export async function addIngredient(name: string): Promise<Ingredient | null> {
  try {
    const { rows } = await sql<Ingredient>`
      INSERT INTO ingredients (name)
      VALUES (${name})
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

// --- Saved Recipes ---

export async function getSavedRecipes(): Promise<SavedRecipe[]> {
  try {
    const { rows } = await sql<SavedRecipe>`SELECT * FROM recipes ORDER BY saved_at DESC`;
    return rows;
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
}): Promise<SavedRecipe | null> {
  try {
    const ingredientsJson = JSON.stringify(recipe.ingredients);
    const stepsJson = JSON.stringify(recipe.steps);
    const { rows } = await sql<SavedRecipe>`
      INSERT INTO recipes (title, time, ingredients, steps, tips, image_url)
      VALUES (${recipe.title}, ${recipe.time}, ${ingredientsJson}::jsonb, ${stepsJson}::jsonb, ${recipe.tips}, ${recipe.image_url})
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
