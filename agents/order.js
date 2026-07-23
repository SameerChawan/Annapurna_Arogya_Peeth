const { generateCompletion } = require('../lib/openrouter');
const supabase = require('../lib/supabase');

const ORDER_REPLY_SYSTEM = `You are the order confirmation assistant for "Annapurna Arogya Peeth" — a home-based healthy atta business in Kalachowki, Mumbai.

Brand voice: warm, trust-based, like talking to a family member. Tagline: "आईच्या हाताने प्रेमाने"

Your job: Draft a warm, friendly WhatsApp reply to confirm an order was received.

Rules:
- Thank the customer by name
- Confirm their order details (products, quantity, total)
- Mention estimated delivery (say "जलद पोहोचवू" — will deliver soon)
- Keep it short (4-6 lines max)
- Use Devanagari (Marathi/Hindi mix)
- Do NOT include payment details or phone numbers
- End with a warm closing`;

const PARSE_SYSTEM = `You are a message parser for "Annapurna Arogya Peeth" — a healthy atta business.

Parse the customer message and extract:
1. customer_name (if mentioned)
2. phone (if mentioned)
3. intent: "order" | "inquiry" | "subscription" | "complaint" | "other"
4. products: array of {productId, quantity} — match to known products:
   - "diabetic" → diabetic-atta
   - "barley" → barley-dosa-atta
   - "moong" or "moong dal" → moong-dal-dosa-atta
   - "nachani" or "ragi" → nachani-dosa-atta
   - "jwari" or "jowar" → jwari-dosa-atta
   - "bajri" or "bajra" → bajri-dosa-atta
   - "mixed" or "mix dal" → mixed-dal-dosa-atta
5. notes: any special requests

Respond ONLY with valid JSON, no markdown, no explanation:
{"customer_name": "", "phone": "", "intent": "", "products": [], "notes": ""}`;

async function draftOrderReply(order) {
  const orderSummary = (order.items || [])
    .map(item => `${item.productId} x${item.quantity} = ₹${item.price * item.quantity}`)
    .join(', ');

  const userPrompt = `Customer: ${order.customer_name}
Phone: ${order.phone}
Order: ${orderSummary}
Total: ₹${order.total}
Notes: ${order.notes || 'none'}

Draft a warm order confirmation reply in Marathi/Hindi.`;

  const content = await generateCompletion(ORDER_REPLY_SYSTEM, userPrompt);

  const { data, error } = await supabase
    .from('aap_content_drafts')
    .insert({
      type: 'order_reply',
      content,
      status: 'pending_approval',
      created_by_agent: 'order',
      context: {
        order_id: order.id,
        customer_name: order.customer_name,
        total: order.total,
      },
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function parseMessage(rawMessage) {
  const parsed = await generateCompletion(PARSE_SYSTEM, rawMessage);

  let result;
  try {
    // Try to parse the JSON response, stripping any markdown fences
    const cleaned = parsed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    result = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Failed to parse agent response as JSON: ' + parsed);
  }

  // If intent is order and we have products, create the order
  if (result.intent === 'order' && result.products && result.products.length > 0) {
    const productsData = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'data', 'products.json'), 'utf8'
    );
    const productMap = {};
    JSON.parse(productsData).products.forEach(p => { productMap[p.id] = p; });

    const enrichedItems = result.products.map(item => {
      const product = productMap[item.productId];
      return {
        productId: item.productId,
        quantity: item.quantity || 1,
        price: product ? product.price : 0,
      };
    });
    const total = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Upsert customer if phone available
    let customerId = null;
    if (result.phone) {
      const { data: existing } = await supabase
        .from('aap_customers')
        .select('id')
        .eq('phone', result.phone)
        .single();

      if (existing) {
        customerId = existing.id;
      } else if (result.customer_name) {
        const { data: newCust } = await supabase
          .from('aap_customers')
          .insert({ name: result.customer_name, phone: result.phone })
          .select('id')
          .single();
        if (newCust) customerId = newCust.id;
      }
    }

    // Insert order
    const { data: order } = await supabase
      .from('aap_orders')
      .insert({
        customer_id: customerId,
        customer_name: result.customer_name || 'Unknown',
        phone: result.phone || '',
        items: enrichedItems,
        total,
        status: 'pending',
        notes: result.notes || '',
      })
      .select()
      .single();

    // Draft reply
    if (order) {
      await draftOrderReply(order);
    }

    return { ...result, order_created: !!order };
  }

  return result;
}

module.exports = { draftOrderReply, parseMessage };
