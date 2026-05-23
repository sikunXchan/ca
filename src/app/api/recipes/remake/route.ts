import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = ['models/gemini-2.5-flash', 'models/gemini-2.0-flash'];

async function generateWithRetry(ai: any, config: any, maxRetries = 3): Promise<any> {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...config, model });
        return response;
      } catch (err: any) {
        const status = err?.status ?? err?.httpStatusCode;
        const code = err?.code;
        const retryable = status === 503 || status === 429 || code === 'UNAVAILABLE' || code === 'RESOURCE_EXHAUSTED';
        if (retryable) {
          if (attempt < maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`Model ${model} attempt ${attempt + 1} failed (${status ?? code}), retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            console.warn(`All retries exhausted for model ${model}, trying next model...`);
          }
        } else {
          throw err;
        }
      }
    }
  }
  throw new Error('すべてのAIモデルが一時的に利用不可です。しばらく時間をおいてお試しください。');
}


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
  "genre": "和食",
  "ingredients": [
    { "name": "具材名", "amount": "分量" }
  ],
  "steps": ["手順1", "手順2..."],
  "tips": "リメイクのポイント"
}
genreは「和食」「洋食」「中華」「アジア料理」「イタリアン」「フレンチ」「その他」から選んでください。`;

    const response = await generateWithRetry(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');

    const json = JSON.parse(text);

    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error('Remake Gen Error:', error);
    const status = error?.status || error?.httpStatusCode || error?.code;
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({ error: 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: `リメイクレシピの生成に失敗しました: ${error.message}` }, { status: 500 });
  }
}
