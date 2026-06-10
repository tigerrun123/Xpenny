import OpenAI from "openai";

const {
  AGENT_API_URL,
  AGENT_API_KEY,
  AGENT_API_AUTH_HEADER = "Authorization",
  AGENT_API_AUTH_SCHEME = "Bearer",
  AGENT_TIMEOUT_MS = "30000",
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5.2",
} = process.env;

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const systemInstructions = `
You are the LiveSailing cloud agent connected to Telegram.
Reply in the same language as the user unless they ask otherwise.
Be concise, useful, and action-oriented.
When you cannot access a private cloud resource, say exactly what credential or endpoint is needed.
`;

function buildAuthHeaders() {
  if (!AGENT_API_KEY) {
    return {};
  }

  const value = AGENT_API_AUTH_SCHEME
    ? `${AGENT_API_AUTH_SCHEME} ${AGENT_API_KEY}`
    : AGENT_API_KEY;

  return { [AGENT_API_AUTH_HEADER]: value };
}

function extractAgentText(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  return (
    payload?.reply ||
    payload?.message ||
    payload?.output_text ||
    payload?.output ||
    payload?.text ||
    payload?.choices?.[0]?.message?.content ||
    payload?.data?.reply ||
    payload?.data?.message ||
    ""
  );
}

export async function askCloudAgent({ chatId, userText, history }) {
  if (AGENT_API_URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(AGENT_TIMEOUT_MS));

    try {
      const response = await fetch(AGENT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          chat_id: String(chatId),
          message: userText,
          history,
          source: "telegram",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Cloud agent returned HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      const text = extractAgentText(payload);

      if (!text) {
        throw new Error("Cloud agent response did not contain reply text.");
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!openai) {
    throw new Error("Set AGENT_API_URL or OPENAI_API_KEY before starting the bot.");
  }

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: systemInstructions,
    input: [
      ...history.map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content,
      })),
      { role: "user", content: userText },
    ],
    max_output_tokens: 900,
  });

  return response.output_text;
}

