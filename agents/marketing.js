const { generateCompletion } = require('../lib/openrouter');
const supabase = require('../lib/supabase');

const BRAND_CONTEXT = `You are the marketing assistant for "Annapurna Arogya Peeth" — a home-based FSSAI-registered healthy atta (flour) business in Kalachowki, Mumbai.

Brand voice: warm, trust-based, family-oriented. Tagline: "आईच्या हाताने प्रेमाने" (Made with mother's love). Mix Marathi and Hindi naturally. Use Devanagari script.

Products (7 types, ₹200-275/kg):
- Diabetic Atta (₹250) — for blood sugar management, low GI
- Barley Dosa Atta (₹275) — high fiber, weight management
- Moong Dal Dosa Atta (₹275) — high protein, strength
- Nachani/Ragi Dosa Atta (₹225) — calcium-rich, good for bones
- Jwari/Jowar Dosa Atta (₹225) — iron-rich, gluten-free
- Bajri/Bajra Dosa Atta (₹200) — good for digestion
- Mixed Dal Dosa Atta (₹250) — protein powerhouse

Subscription: ₹1,100/month for 5kg (saves ₹₹₹)

Rules:
- Keep it WhatsApp-friendly (short, punchy, with line breaks)
- Include emojis sparingly (1-3 max)
- End with a call-to-action (order/subscribe/inquire)
- Do NOT include phone numbers or links (founder will add)
- Write primarily in Devanagari (Marathi/Hindi mix), can use some English words
- Keep it authentic, not corporate`;

const TYPE_PROMPTS = {
  whatsapp_broadcast: `Generate a WhatsApp broadcast message for: {topic}
Make it feel personal, like a message from a trusted neighbor. Short paragraphs, easy to read on mobile.`,

  instagram_caption: `Generate an Instagram caption for: {topic}
Include a hook in the first line, keep it under 150 words, suggest 5-8 relevant hashtags at the end.`,

  free_sample: `Generate a free-sample announcement for: {topic}
Create excitement. Mention it's limited-time, encourage people to try and share feedback.`
};

async function generateDraft(type, topic) {
  const typePrompt = TYPE_PROMPTS[type] || TYPE_PROMPTS.whatsapp_broadcast;
  const userPrompt = typePrompt.replace('{topic}', topic);

  const content = await generateCompletion(BRAND_CONTEXT, userPrompt);

  // Save to content_drafts
  const { data, error } = await supabase
    .from('aap_content_drafts')
    .insert({
      type,
      content,
      status: 'pending_approval',
      created_by_agent: 'marketing',
      context: { topic, type },
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

module.exports = { generateDraft };
