// Created: 2026-07-09 21:14:28
// Vercel Serverless Function — OpenRouter 프록시
//
// 브라우저에 API 키를 노출하지 않기 위해, OpenRouter 호출은 오직 이 서버 함수에서만
// 수행한다. 키는 Vercel 환경변수 OPENROUTER_API_KEY 에서만 읽으며 절대 하드코딩하지 않는다.
// 클라이언트(index.html)는 { text } 만 보내고, 이 함수가 감정 분석 결과
// { emotion, emoji, message } 를 돌려준다.

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.3-70b-instruct:free";

// 감정 분석가 시스템 프롬프트 — 감정 정의·예시로 오분류를 줄이고, JSON만 답하게 강제한다.
const SYSTEM_PROMPT =
  "너는 따뜻하고 다정한 감정 분석가야. 사용자가 오늘 있었던 일을 한 줄로 적으면, " +
  "그 마음을 헤아려 감정을 분석하고 진심으로 공감하며 위로해 줘.\n\n" +
  "emotion은 반드시 아래 7가지 중 정확히 하나로 고르고, 각 감정의 정의와 예시를 참고해 " +
  "긍정과 부정을 헷갈리지 마.\n" +
  "- 기쁨: 좋은 일이 생겨 즐겁고 만족스러운 상태. 예) \"시험에 합격했어\", \"칭찬받아서 뿌듯해\"\n" +
  "- 설렘: 기대되고 두근거리는 긍정적 흥분. 예) \"내일 여행 가서 두근거려\", \"짝사랑에게 연락이 왔어\"\n" +
  "- 평온: 편안하고 안정되어 개운한 상태. 예) \"푹 쉬어서 개운해\", \"산책하니 마음이 잔잔해\"\n" +
  "- 슬픔: 상실·실망으로 마음이 아프고 울적한 상태. 예) \"반려동물이 아파서 속상해\", \"헤어졌어\"\n" +
  "- 불안: 앞일이 걱정되고 초조한 상태. 예) \"발표를 망칠까 봐 떨려\", \"결과가 안 나와서 초조해\"\n" +
  "- 분노: 부당함·짜증으로 화가 난 상태. 예) \"약속을 어겨서 화가 나\", \"억울한 일을 당했어\"\n" +
  "- 지침: 힘이 다 빠지고 피곤해 지친 상태. 예) \"야근이 계속돼 너무 피곤해\", \"아무것도 하기 싫어\"\n\n" +
  "\"개운해\"·\"푹 쉬었어\"·\"뿌듯해\" 같은 긍정 표현을 슬픔으로 잘못 분류하지 마.\n\n" +
  "반드시 아래 JSON 형식으로만 답하고, 그 외의 말은 절대 하지 마.\n" +
  '{"emotion":"기쁨|슬픔|분노|불안|평온|설렘|지침 중 정확히 하나",' +
  '"emoji":"감정을 나타내는 이모지 1개",' +
  '"message":"2~3문장의 진심 어린 공감과 위로. 따뜻한 존댓말로."}\n' +
  "message는 반드시 자연스러운 한국어로만 작성하고, 다른 언어의 단어나 문자를 절대 섞지 마.";

// 견고한 JSON 추출 — 모델이 앞뒤로 군말을 붙여도 첫 { 부터 마지막 } 까지만 파싱한다.
function extractJson(text) {
  if (!text) return null;
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e < s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); }
  catch (err) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  // 키는 서버 환경변수에서만 읽는다. 먼저 trim으로 앞뒤 공백을 제거하고,
  // 붙여넣을 때 개행·중복이 끼어들어 헤더가 깨지는(잘못된 Authorization 값 →
  // fetch 예외) 경우까지 막기 위해 공백 기준 첫 유효 토큰만 취한다.
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 OPENROUTER_API_KEY가 설정되지 않았습니다." });
  }

  // 본문 파싱 (Vercel이 application/json을 자동 파싱하지만, 문자열로 올 때도 대비)
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const text = body && typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "text 필드가 필요합니다." });
  }

  try {
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        max_tokens: 1200,   // gpt-oss는 reasoning 모델 → 넉넉히 줘야 content가 채워짐
        temperature: 0.85
      })
    });

    if (upstream.status === 429) {
      return res.status(429).json({ error: "잠시 요청이 많아요. 조금 뒤에 다시 시도해 주세요." });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: "OpenRouter 응답 오류 (" + upstream.status + ")" });
    }

    const data = await upstream.json();
    const content = data && data.choices && data.choices[0] &&
                    data.choices[0].message && data.choices[0].message.content;
    const parsed = extractJson(content);
    if (!parsed || !parsed.message) {
      return res.status(502).json({ error: "EMPTY" });
    }

    return res.status(200).json({
      emotion: parsed.emotion || "평온",
      emoji: parsed.emoji || "🌿",
      message: parsed.message
    });
  } catch (err) {
    // detail은 원인 진단용. 혹시라도 예외 메시지에 키가 섞여 나가지 않도록 마스킹한다.
    const detail = String((err && err.message) || err).replace(/sk-or-[A-Za-z0-9\-]+/g, "sk-***");
    return res.status(502).json({ error: "OpenRouter 호출에 실패했어요.", detail: detail });
  }
};
