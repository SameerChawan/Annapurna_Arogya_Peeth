const OpenAI = require('openai');

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite';

async function generateCompletion(systemPrompt, userPrompt) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const response = await openrouter.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

module.exports = { openrouter, generateCompletion, MODEL };
