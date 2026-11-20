import "server-only";
// ChatGPT (OpenAI) — imtihon savollarini yaratish. Kalit Vercel'da: OPENAI_API_KEY.
// OPENAI_MODEL — ixtiyoriy (standart: gpt-4o-mini — tez va arzon). OPENAI_BASE_URL — faqat sinov uchun (soxta server).

export class OpenAIError extends Error {}

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const base = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
export const openaiModel = () => process.env.OPENAI_MODEL || "gpt-4o-mini";

/** JSON sxemaga mos javob (structured output). Xato bo'lsa — tushunarli o'zbekcha matn bilan OpenAIError. */
export async function openaiJson(v: { system: string; user: string; schema: { name: string; strict: boolean; schema: object }; temperature?: number }): Promise<unknown> {
  if (!openaiConfigured()) throw new OpenAIError("ChatGPT kaliti kiritilmagan (Vercel: OPENAI_API_KEY)");
  let res: Response;
  try {
    res = await fetch(`${base()}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: openaiModel(),
        temperature: v.temperature ?? 0.8,
        messages: [
          { role: "system", content: v.system },
          { role: "user", content: v.user },
        ],
        response_format: { type: "json_schema", json_schema: v.schema },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch (err) {
    const timeout = (err as Error).name === "TimeoutError";
    throw new OpenAIError(timeout ? "ChatGPT javob bermadi (vaqt tugadi) — qayta urinib ko‘ring" : "ChatGPT’ga ulanib bo‘lmadi — qayta urinib ko‘ring");
  }
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
    choices?: { message?: { content?: string; refusal?: string } }[];
  };
  if (!res.ok) {
    const code = json.error?.code ?? "";
    const msg =
      res.status === 401
        ? "ChatGPT kaliti noto‘g‘ri (OPENAI_API_KEY)"
        : res.status === 429 && code === "insufficient_quota"
          ? "ChatGPT hisobida mablag‘ tugagan (platform.openai.com → Billing)"
          : res.status === 429
            ? "ChatGPT so‘rovlar chegarasi — bir daqiqadan keyin qayta urinib ko‘ring"
            : `ChatGPT xatosi (HTTP ${res.status})${json.error?.message ? `: ${json.error.message.slice(0, 200)}` : ""}`;
    throw new OpenAIError(msg);
  }
  const msg = json.choices?.[0]?.message;
  if (msg?.refusal) throw new OpenAIError(`ChatGPT rad etdi: ${msg.refusal.slice(0, 200)}`);
  try {
    return JSON.parse(msg?.content ?? "");
  } catch {
    throw new OpenAIError("ChatGPT javobini o‘qib bo‘lmadi — qayta urinib ko‘ring");
  }
}
