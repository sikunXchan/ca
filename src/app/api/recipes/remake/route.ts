import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { recipe } = await req.json();
    
    if (!recipe) {
      return NextResponse.json({ error: 'Original recipe required' }, { status: 400 });
    }

    const prompt = `あなたはプロの料理リメイク専門家です。以下の既存レシピ（残り物）をベースに、全く別の料理に生まれ変わらせる「アレンジ（リメイク）」レシピを提案してください。
例：肉じゃが → コロッケ、ポトフ → カレー、野菜炒め → あんかけ焼きそば など。

【元のレシピ】
料理名: ${recipe.title}
材料: ${recipe.ingredients.map((i: any) => `${i.name} (${i.amount})`).join(', ')}

【要件】
1. 元の料理の面影を残しつつ、全く新しい料理の名前にしてください。
2. 分量、手順、ポイントを具体的に記載してください。
3. 以下のJSON構造で返してください。これ以外のテキストは一切含めないでください。
{
  "title": "リメイク後の料理名",
  "time": "調理時間目安（例：15分）",
  "ingredients": [
    { "name": "具材名", "amount": "分量" }
  ],
  "steps": ["手順1", "手順2..."],
  "tips": "リメイクのポイント"
}`;

    const response = await (ai as any).models.generateContent({
      model: 'models/gemini-flash-latest',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');
    
    const json = JSON.parse(text);

    // Image generation for remake
    try {
      const imgResponse = await (ai as any).models.generateImages({
        model: 'models/imagen-4.0-generate-001',
        prompt: `A professional food photography of ${json.title}, a creative leftover remake dish. High resolution, appetizing.`,
        config: { numberOfImages: 1 },
      });
      
      if (imgResponse.generatedImages && imgResponse.generatedImages.length > 0) {
        const imgBytes = imgResponse.generatedImages[0].image?.imageBytes;
        if (imgBytes) {
          json.image_url = `data:image/png;base64,${imgBytes}`;
        }
      }
    } catch (imgError) {
      console.error('Remake image generation failed', imgError);
      json.image_url = null;
    }

    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error('Remake Gen Error:', error);
    return NextResponse.json({ error: `リメイクレシピの生成に失敗しました: ${error.message}` }, { status: 500 });
  }
}
