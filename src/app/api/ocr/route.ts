import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File;
    if (!file) return NextResponse.json({ error: 'Image required' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString('base64');
    
    const prompt = `あなたはプロのレシート画像読み取りAIです。提供されたレシート画像から、「食材名」のみを抽出してください。調味料や香辛料は無視してください。
必ず以下のJSON形式で結果を返してください。それ以外のテキストは一切含めないでください。
{"ingredients": ["食材1", "食材2", ...]}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType: file.type } }
        ]}
      ],
      config: { responseMimeType: 'application/json' }
    });

    const text = response.text || '';
    const json = JSON.parse(text);
    return NextResponse.json(json);
  } catch (error: any) {
    console.error('OCR Error:', error);
    if (error.status === 429) {
      return NextResponse.json({ error: 'しばらく時間をおいてから再度お試しください' }, { status: 429 });
    }
    return NextResponse.json({ error: 'レシートを読み取れませんでした。もう一度撮影するか、手動で追加してください' }, { status: 500 });
  }
}
