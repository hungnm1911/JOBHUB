import { createGroqClient } from "../src/llm/groq-client.js";

const EXPECTED_RESPONSE = "JOBHUB_GROQ_OK";
const SMOKE_MESSAGES = Object.freeze([
  Object.freeze({
    role: "user",
    content: `Reply with exactly: ${EXPECTED_RESPONSE}`,
  }),
]);

const runGroqSmoke = async ({ apiKey, model, logger }) => {
  const client = createGroqClient({ apiKey, model, logger });
  const response = await client.createChatCompletion({
    messages: SMOKE_MESSAGES,
  });
  const responseText = typeof response?.choices?.[0]?.message?.content === "string"
    ? response.choices[0].message.content.trim()
    : "";

  if (responseText.length === 0) {
    throw new Error("Groq returned an empty text response");
  }

  if (responseText !== EXPECTED_RESPONSE) {
    throw new Error(
      `Groq returned unexpected text: ${JSON.stringify(responseText)}`,
    );
  }

  return Object.freeze({
    model: model.trim(),
    responseText,
  });
};

export { runGroqSmoke };
