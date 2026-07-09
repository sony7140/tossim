// Created: 2026-07-09 21:14:28
// Vercel Serverless Function — OpenRouter 프록시
//
// 브라우저에 API 키를 노출하지 않기 위해, OpenRouter 호출은 오직 이 서버 함수에서만
// 수행한다. 키는 Vercel 환경변수 OPENROUTER_API_KEY 에서만 읽으며 절대 하드코딩하지 않는다.
// 클라이언트(index.html)는 { text } 만 보내고, 이 함수가 감정 분석 결과
// { emotion, emoji, message } 를 돌려준다.

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b:free";

// 감정 분석가 시스템 프롬프트 — JSON 형식으로만 답하도록 강제한다.
const SYSTEM_PROMPT =
  "너는 따뜻하고 다정한 감정 분석가야. 사용자가 오늘 있었던 일을 한 줄로 적으면, " +
  "그 마음을 헤아려 감정을 분석하고 진심으로 공감하며 위로해 줘. " +
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

  // 키는 서버 환경변수에서만 읽는다.
  const apiKey = process.env.OPENROUTER_API_KEY;
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
    return res.status(502).json({ error: "OpenRouter 호출에 실패했어요." });
  }
};
