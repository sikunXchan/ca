import { sql } from '@vercel/postgres';

export type Ingredient = {
  id: number;
  name: string;
  created_at: Date;
};

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
