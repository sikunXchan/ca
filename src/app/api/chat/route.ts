import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json(); 

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    const systemInstruction = "あなたはプロの料理アシスタントです。ユーザーの料理に関する質問に、簡潔かつ的確に答えてください。料理以外の質問には「私は料理アシスタントのため、料理に関する質問のみお答えできます」と適切に断ってください。";

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-8b',
      contents: messages,
      config: { systemInstruction: systemInstruction }
    });

    const text = response.text || '';
    
    return NextResponse.json({ text });
    
  } catch (error: any) {
    console.error('Chat Error:', error);
    if (error.status === 429) {
      return NextResponse.json({ error: 'しばらく時間をおいてから再度お試しください' }, { status: 429 });
    }
    return NextResponse.json({ error: 'エラーが発生しました。時間をおいてもう一度お試しください。' }, { status: 500 });
  }
}
