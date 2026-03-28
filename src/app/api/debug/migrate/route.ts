import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // 1. Add is_pinned to ingredients
    try {
      await sql`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`;
    } catch (e) {
      console.log('is_pinned might already exist');
    }

    // 2. Create shopping_list table
    await sql`
      CREATE TABLE IF NOT EXISTS shopping_list (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({ success: true, message: 'Migration completed successfully' });
  } catch (error: any) {
    console.error('Migration Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
