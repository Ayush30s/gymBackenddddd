const OpenAI = require("openai");

// Configure OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const res = async () => {
  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Eassy on diwali" }],
    max_tokens: 10,
  });

  console.log(chatCompletion.choices[0].message);
};

res();
