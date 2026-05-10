import { NextResponse } from 'next/server';
import { getIngredients, addIngredient } from '@/lib/db';

export async function GET() {
  try {
    const ingredients = await getIngredients();
    return NextResponse.json(ingredients);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, category } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const ingredient = await addIngredient(name, category ?? 'その他');
    if (!ingredient) return NextResponse.json({ error: 'Failed to add ingredient' }, { status: 500 });
    return NextResponse.json(ingredient);
  } catch {
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
