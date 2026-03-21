import { NextResponse } from 'next/server';
import { getIngredients, addIngredient } from '@/lib/db';

export async function GET() {
  try {
    const ingredients = await getIngredients();
    return NextResponse.json(ingredients);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    
    const ingredient = await addIngredient(name);
    return NextResponse.json(ingredient);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
