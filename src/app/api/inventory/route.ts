import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getIngredients, addIngredient } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CATEGORIES = ['野菜', '肉', '魚介類', '乳製品・卵', '穀物・パン', '調味料', '果物', '豆類', 'その他'];

async function categorizeIngredient(name: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'models/gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [{ text: `食材「${name}」のカテゴリを次の中から1つだけ選んでください。カテゴリ名のみを返してください:\n${CATEGORIES.join('、')}` }]
      }],
    });
    const text = (response.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return CATEGORIES.includes(text) ? text : 'その他';
  } catch {
    return 'その他';
  }
}

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
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const category = await categorizeIngredient(name);
    const ingredient = await addIngredient(name, category);
    return NextResponse.json(ingredient);
  } catch {
    return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
  }
}
