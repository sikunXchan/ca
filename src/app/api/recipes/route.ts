import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getRecentRecipeNames } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = ['models/gemini-2.5-flash', 'models/gemini-2.0-flash'];

async function generateWithRetry(ai: any, config: any, maxRetries = 3): Promise<any> {
  for (const model of MODELS) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...config, model });
        return response;
      } catch (err: any) {
        const status = err?.status || err?.httpStatusCode || err?.code;
        if (status === 503 || status === 429 || status === 'UNAVAILABLE') {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`Model ${model} attempt ${attempt + 1} failed (${status}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    console.warn(`All retries exhausted for model ${model}, trying next model...`);
  }
  throw new Error('すべてのAIモデルが一時的に利用不可です。しばらく時間をおいてお試しください。');
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Recipe Gen Request Body:', JSON.stringify(body));
    const { ingredients, pinnedIngredients, conditions, instruction, servings } = body;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json({ error: 'Ingredients array required' }, { status: 400 });
    }

    const pinnedSection = pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【ピン留め食材（これらを必ず主役・または必須で使用してください！）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const conditionsSection = conditions && conditions.length > 0
      ? `\n【重要：守るべき調理条件】\n${conditions.join('、')}\n`
      : '';

    // Fetch recent recipe history for personalization
    const recentNames = await getRecentRecipeNames(5);
    const historyNote = recentNames.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentNames.join('、')}\n`
      : '';

    const servingsSection = servings
      ? `\n【分量指定】\nすべてのレシピの材料・分量は ${servings}人分 で記載してください。\n`
      : '';

    const prompt = `あなたはプロの料理アシスタントです。以下の内容をもとに、消費できる最高のレシピを複数提案してください。
【現在の在庫食材】
${ingredients.join(', ')}
${pinnedSection}${conditionsSection}${servingsSection}${instruction ? `\n【ユーザーからのカスタム指示】\n${instruction}\n` : ''}${historyNote}
【重要・厳守事項】
1. ピン留め食材がある場合、それらを「主役」として扱うか、レシピに「必ず」組み込んでください。
2. 調理条件（低カロリー、時短など）が指定されている場合、必ずその条件を満たすレシピにしてください。
3. 以下のJSON構造で、"recipes"配列の中に複数のレシピデータを格納して返してください。これ以外のテキストは一切含めないでください。
{
  "recipes": [
    {
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "ingredients": [
        { "name": "使用する具材1", "amount": "分量の目安（例：200g、1/2個など）" },
        { "name": "調味料", "amount": "分量の目安（例：大さじ1など）" }
      ],
      "steps": ["手順1", "手順2", "手順3..."],
      "tips": "調理のコツ・アドバイス"
    }
  ]
}`;

    // Use retry logic with fallback models
    const response = await generateWithRetry(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text || '';
    if (!text) throw new Error('AI output was empty');
    
    const json = JSON.parse(text);

    // Generate images for each recipe (Graceful failure handled)
    if (json.recipes && Array.isArray(json.recipes)) {
      const imagePromises = json.recipes.map(async (recipe: any, index: number) => {
        try {
          const imgResponse = await (ai as any).models.generateImages({
            model: 'models/imagen-4.0-generate-001',
            prompt: `A professional, close-up, appetizing food photography of ${recipe.title}. High-end restaurant style, centered, bright natural lighting, shallow depth of field, vibrant colors.`,
            config: {
              numberOfImages: 1,
            },
          });
          
          if (imgResponse.generatedImages && imgResponse.generatedImages.length > 0) {
            const imgBytes = imgResponse.generatedImages[0].image?.imageBytes;
            if (imgBytes) {
              recipe.image_url = `data:image/png;base64,${imgBytes}`;
            }
          }
        } catch (imgError) {
          console.error('Image generation failed for:', recipe.title, imgError);
          recipe.image_url = null;
        }
      });

      await Promise.all(imagePromises);
    }

    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error('Recipe Gen Error:', error);
    const status = error?.status || error?.httpStatusCode || error?.code;
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({ error: 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: `レシピの生成に失敗しました: ${error.message}` }, { status: 500 });
  }
}
