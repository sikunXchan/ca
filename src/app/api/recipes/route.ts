import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getRecentRecipeNames } from '@/lib/db';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = ['models/gemini-3.5-flash', 'models/gemini-2.5-flash'];

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

type NutritionContext = {
  title: string;
  nutrition: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Recipe Gen Request Body:', JSON.stringify(body));
    const {
      ingredients,
      pinnedIngredients,
      conditions,
      instruction,
      servings,
      model = 'sikun-5.9',
      nutritionContext = [] as NutritionContext[],
    } = body;

    if (!ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json({ error: 'Ingredients array required' }, { status: 400 });
    }

    const isLily = model === 'lily-5.9' || model === 'lily-1.1';
    const isLily11 = model === 'lily-1.1';

    const pinnedSection = pinnedIngredients && pinnedIngredients.length > 0
      ? `\n【ピン留め食材（これらを必ず主役・または必須で使用してください！）】\n${pinnedIngredients.join(', ')}\n`
      : '';

    const conditionsSection = conditions && conditions.length > 0
      ? `\n【重要：守るべき調理条件】\n${conditions.join('、')}\n`
      : '';

    const recentNames = await getRecentRecipeNames(5);
    const historyNote = recentNames.length > 0
      ? `\n【直近の料理履歴（マンネリ防止のため、これらと異なる料理を提案してください）】\n${recentNames.join('、')}\n`
      : '';

    const servingsSection = servings
      ? `\n【分量指定】\nすべてのレシピの材料・分量は ${servings}人分 で記載してください。\n`
      : '';

    const nutritionBalanceSection = isLily
      ? `\n【栄養バランス指針】\nPFC（タンパク質・炭水化物・脂質）バランスの取れた健康的なレシピを優先してください。\n`
      : '';

    let nutritionContextSection = '';
    if (isLily11 && nutritionContext.length > 0) {
      const summary = nutritionContext.map((r: NutritionContext) =>
        `・${r.title}（カロリー:${r.nutrition.calories}kcal, タンパク質:${r.nutrition.protein_g}g, 炭水化物:${r.nutrition.carbs_g}g, 脂質:${r.nutrition.fat_g}g）`
      ).join('\n');
      nutritionContextSection = `\n【直近に食べた料理の栄養素（これらを踏まえ、不足している栄養素を補うレシピを提案してください）】\n${summary}\n`;
    }

    const nutritionJsonSchema = isLily ? `
      "nutrition": { "calories": 450, "protein_g": 30, "carbs_g": 45, "fat_g": 12 },` : '';

    const seasoningSection = `\n【調味料・味付けの前提】\n塩・こしょう・砂糖・醤油・味噌・みりん・酒・酢・サラダ油・ごま油・バター・だし（顆粒和風だし/コンソメ/鶏がらスープの素）・ケチャップ・マヨネーズ・にんにく・しょうがなどの基本的な調味料は「常備されている」前提で自由に使用してください。これらは在庫食材に含まれていなくても構いません。\n`;

    const prompt = `あなたはプロの料理アシスタントです。以下の内容をもとに、消費できる最高のレシピを複数提案してください。
【現在の在庫食材】
${ingredients.join(', ')}
${seasoningSection}${pinnedSection}${conditionsSection}${servingsSection}${instruction ? `\n【ユーザーからのカスタム指示】\n${instruction}\n` : ''}${historyNote}${nutritionBalanceSection}${nutritionContextSection}
【重要・厳守事項】
1. ピン留め食材がある場合、それらを「主役」として扱うか、レシピに「必ず」組み込んでください。
2. 調理条件（低カロリー、時短など）が指定されている場合、必ずその条件を満たすレシピにしてください。
3. 味付けは「ぼやけない・しっかりした美味しさ」を最優先してください。基本調味料を積極的に使い、すべての調味料について分量を「大さじ・小さじ・g」など具体的な数値で必ず明記してください（「適量」「少々」は塩・こしょうなど一部の仕上げ調味料のみ許可）。各レシピが料理として味が決まる、満足できる仕上がりになるよう設計してください。
4. 以下のJSON構造で、"recipes"配列の中に複数のレシピデータを格納して返してください。また"cooking_tips"配列に食材に関連するコツ・保存方法・栄養豆知識を3件含めてください。これ以外のテキストは一切含めないでください。
{
  "recipes": [
    {
      "title": "料理名",
      "time": "調理時間目安（例：15分）",
      "genre": "和食",
      "ingredients": [
        { "name": "使用する具材または調味料", "amount": "分量の目安（例：鶏もも肉200g、玉ねぎ1/2個、醤油 大さじ2、砂糖 小さじ1など）" }
      ],
      "steps": ["手順1", "手順2", "手順3..."],
      "tips": "調理のコツ・アドバイス"${nutritionJsonSchema}
    }
  ],
  "cooking_tips": [
    { "category": "保存方法", "tip": "食材の保存に関するアドバイス" },
    { "category": "調理のコツ", "tip": "料理をおいしくするコツ" },
    { "category": "栄養豆知識", "tip": "食材や栄養に関する豆知識" }
  ]
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
    console.error('Recipe Gen Error:', error);
    const status = error?.status || error?.httpStatusCode || error?.code;
    if (status === 429 || status === 503 || status === 'UNAVAILABLE') {
      return NextResponse.json({ error: 'AIモデルが一時的に混雑しています。しばらく時間をおいてから再度お試しください。' }, { status: 503 });
    }
    return NextResponse.json({ error: `レシピの生成に失敗しました: ${error.message}` }, { status: 500 });
  }
}
