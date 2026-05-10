import { NextResponse } from 'next/server';
import { deleteIngredient, togglePinIngredient, updateIngredientCategory } from '@/lib/db';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    await deleteIngredient(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();

    if ('category' in body) {
      const updated = await updateIngredientCategory(id, body.category);
      if (!updated) return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
      return NextResponse.json(updated);
    }

    const updated = await togglePinIngredient(id, body.is_pinned);
    if (!updated) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
