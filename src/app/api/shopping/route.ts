import { NextResponse } from 'next/server';
import { getShoppingList, addShoppingItem } from '@/lib/db';

export async function GET() {
  try {
    const items = await getShoppingList();
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    
    const item = await addShoppingItem(name);
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
