import { NextResponse } from 'next/server';
import { getSavedRecipes, saveRecipe } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || undefined;
    const genre = url.searchParams.get('genre') || undefined;
    const timeMaxStr = url.searchParams.get('timeMax');
    const timeMax = timeMaxStr ? parseInt(timeMaxStr, 10) : undefined;

    const recipes = await getSavedRecipes({ search, genre, timeMax });
    return NextResponse.json(recipes);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, time, ingredients, steps, tips, image_url, nutrition, genre } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title required' }, { status: 400 });
    }

    const recipe = await saveRecipe({
      title,
      time: time ?? '',
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      steps: Array.isArray(steps) ? steps : [],
      tips: tips ?? '',
      image_url: image_url ?? null,
      nutrition: nutrition ?? null,
      genre: genre ?? null,
    });
    if (!recipe) throw new Error('DB Save returned null');
    return NextResponse.json(recipe);
  } catch (error: any) {
    console.error('API: Failed to save recipe:', error);
    return NextResponse.json({ error: 'Failed to save: ' + error.message }, { status: 500 });
  }
}
