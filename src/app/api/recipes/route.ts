import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getRecentRecipeNames } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Recipe Gen Request Body:', JSON.stringify(body));
    const { ingredients, instruction } = body;
    
    if (!ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json({ error: 'Ingredients array required' }, { status: 400 });
    }

    // Fetch recent recipe history for personalization
    const recentNames = await getRecentRecipeNames(5);
    const historyNote = recentNames.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentNames.join('、')}\n`
      : '';

    const prompt = `あなたはプロの料理アシスタントです。以下の食材リストをもとに、消費できる最適なレシピを複数提案してください。
【現在の在庫食材】
${ingredients.join(', ')}
${instruction ? `\n【ユーザーからの追加リクエスト】\n${instruction}\n` : ''}${historyNote}
【重要・厳守事項】
以下のJSON構造で、"recipes"配列の中に複数のレシピデータを格納して返してください。これ以外のテキストは一切含めないでください。
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const text = response.text || '';
    const json = JSON.parse(text);

    // Generate images for each recipe
    if (json.recipes && Array.isArray(json.recipes)) {
      const imagePromises = json.recipes.map(async (recipe: any) => {
        try {
          const imgResponse = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `A beautiful, appetizing, professional food photography of ${recipe.title}. Japanese home cooking style. Top-down view on a wooden table. Warm natural lighting. High quality.`,
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
          // Recipe works without image - leave image_url undefined
        }
      });

      await Promise.all(imagePromises);
    }

    return NextResponse.json(json);
    
  } catch (error: any) {
    console.error('Recipe Gen Error:', error);
    if (error.status === 429) {
      return NextResponse.json({ error: 'しばらく時間をおいてから再度お試しください' }, { status: 429 });
    }
    return NextResponse.json({ error: 'レシピの生成に失敗しました。時間をおいて再試行してください' }, { status: 500 });
  }
}
