require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const { marked } = require('marked');
const supabase = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'annapurna-arogya-peeth-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth credentials from env
const ADMIN_USER = process.env.ADMIN_USERNAME || 'NayanaChawan';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'Nayana@2471';

// CORS headers for API endpoints
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Data helpers ────────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');

function readData(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeData(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function generateId(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${ts}${rand}`.toUpperCase();
}

// ─── Auth middleware ─────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.redirect('/admin/login');
}

// ─── Public routes ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const data = readData('products.json');
  const products = data.products.filter(p => p.active !== false);
  res.render('index', { products, lang: 'en' });
});

app.get('/mr', (req, res) => {
  const data = readData('products.json');
  const products = data.products.filter(p => p.active !== false);
  res.render('index', { products, lang: 'mr' });
});

app.get('/market-research', (req, res) => {
  try {
    const mdPath = path.join(__dirname, 'data', 'market_research.md');
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const htmlContent = marked(mdContent);
    res.render('doc_page', { title: 'बाजार संशोधन अहवाल — अन्नपूर्णा आरोग्य पीठ', content: htmlContent, lang: 'mr' });
  } catch (err) {
    console.error('Error rendering market research:', err);
    res.status(500).send('Error loading document');
  }
});

app.get('/business-plan', (req, res) => {
  try {
    const mdPath = path.join(__dirname, 'data', 'business_plan.md');
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const htmlContent = marked(mdContent);
    res.render('doc_page', { title: 'व्यवसाय योजना — अन्नपूर्णा आरोग्य पीठ', content: htmlContent, lang: 'mr' });
  } catch (err) {
    console.error('Error rendering business plan:', err);
    res.status(500).send('Error loading document');
  }
});

// ─── Customer-facing API (public) ───────────────────────────────────────────
app.post('/api/order', async (req, res) => {
  try {
    const { customerName, phone, address, items, notes } = req.body;
    if (!customerName || !phone || !items || !items.length) {
      return res.status(400).json({ error: 'customerName, phone, and items are required' });
    }

    const productsData = readData('products.json');
    const productMap = {};
    productsData.products.forEach(p => { productMap[p.id] = p; });

    const enrichedItems = items.map(item => {
      const product = productMap[item.productId];
      return {
        productId: item.productId,
        quantity: item.quantity || 1,
        price: product ? product.price : (item.price || 0)
      };
    });
    const total = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Upsert customer by phone
    let customerId = null;
    const { data: existing } = await supabase
      .from('aap_customers')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existing) {
      customerId = existing.id;
      await supabase
        .from('aap_customers')
        .update({ name: customerName, address: address || '', updated_at: new Date().toISOString() })
        .eq('id', customerId);
    } else {
      const { data: newCustomer } = await supabase
        .from('aap_customers')
        .insert({ name: customerName, phone, address: address || '' })
        .select('id')
        .single();
      if (newCustomer) customerId = newCustomer.id;
    }

    // Insert order
    const { data: order, error } = await supabase
      .from('aap_orders')
      .insert({
        customer_id: customerId,
        customer_name: customerName,
        phone,
        address: address || '',
        items: enrichedItems,
        total,
        status: 'pending',
        notes: notes || '',
      })
      .select()
      .single();

    if (error) throw error;

    // Generate order reply draft via Order Agent
    const orderAgent = require('./agents/order');
    await orderAgent.draftOrderReply(order);

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error('POST /api/order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const { customerName, phone, address, productId, quantity, frequency, notes } = req.body;
    if (!customerName || !phone || !productId) {
      return res.status(400).json({ error: 'customerName, phone, and productId are required' });
    }

    const productsData = readData('products.json');
    const product = productsData.products.find(p => p.id === productId);
    const price = product ? product.price : 180;
    const qty = quantity || 5;
    const freq = frequency || 'monthly';

    const startDate = new Date().toISOString().split('T')[0];
    const next = new Date();
    if (freq === 'weekly') next.setDate(next.getDate() + 7);
    else if (freq === 'biweekly') next.setDate(next.getDate() + 14);
    else next.setMonth(next.getMonth() + 1);

    // Upsert customer
    let customerId = null;
    const { data: existing } = await supabase
      .from('aap_customers')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCustomer } = await supabase
        .from('aap_customers')
        .insert({ name: customerName, phone, address: address || '' })
        .select('id')
        .single();
      if (newCustomer) customerId = newCustomer.id;
    }

    const { data: subscription, error } = await supabase
      .from('aap_subscriptions')
      .insert({
        customer_id: customerId,
        customer_name: customerName,
        phone,
        address: address || '',
        product_id: productId,
        quantity: qty,
        frequency: freq,
        price: price * qty,
        status: 'active',
        start_date: startDate,
        next_delivery: next.toISOString().split('T')[0],
        notes: notes || '',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, subscription });
  } catch (err) {
    console.error('POST /api/subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin auth routes ──────────────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin');
  res.render('login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid username or password' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// ─── Admin dashboard ────────────────────────────────────────────────────────
app.get('/admin', requireAuth, async (req, res) => {
  const products = readData('products.json');

  const { data: orders } = await supabase
    .from('aap_orders')
    .select('*')
    .order('order_date', { ascending: false });

  const { data: subscriptions } = await supabase
    .from('aap_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: customers } = await supabase
    .from('aap_customers')
    .select('*')
    .order('created_at', { ascending: false });

  // Fetch deliveries with subscription price info for revenue calculation
  const { data: deliveries } = await supabase
    .from('aap_subscription_deliveries')
    .select('*, aap_subscriptions(price, product_id)')
    .order('delivered_date', { ascending: false });

  res.render('admin', {
    products: products.products,
    orders: orders || [],
    subscriptions: subscriptions || [],
    customers: customers || [],
    deliveries: deliveries || []
  });
});

// ─── Protected API: Products ────────────────────────────────────────────────
app.get('/api/products', requireAuth, (req, res) => {
  const data = readData('products.json');
  res.json(data.products);
});

app.post('/api/products', requireAuth, (req, res) => {
  try {
    const data = readData('products.json');
    const product = {
      id: req.body.id || generateId('PROD'),
      name_en: req.body.name_en || '',
      name_mr: req.body.name_mr || '',
      description_en: req.body.description_en || '',
      description_mr: req.body.description_mr || '',
      price: req.body.price || 0,
      weight_kg: req.body.weight_kg || 1,
      badge_en: req.body.badge_en || '',
      badge_mr: req.body.badge_mr || '',
      tags: req.body.tags || [],
      tags_mr: req.body.tags_mr || [],
      icon: req.body.icon || '',
      emoji: req.body.emoji || '',
      image: req.body.image || '',
      category: req.body.category || 'millet',
      active: req.body.active !== undefined ? req.body.active : true,
      ingredients_en: req.body.ingredients_en || '',
      ingredients_mr: req.body.ingredients_mr || '',
      nutrition: req.body.nutrition || { calories: 0, protein: 0, fiber: 0, carbs: 0, fat: 0 }
    };
    data.products.push(product);
    writeData('products.json', data);
    res.status(201).json(product);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  try {
    const data = readData('products.json');
    const idx = data.products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    data.products[idx] = { ...data.products[idx], ...req.body, id: req.params.id };
    writeData('products.json', data);
    res.json(data.products[idx]);
  } catch (err) {
    console.error('PUT /api/products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  try {
    const data = readData('products.json');
    const idx = data.products.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    data.products.splice(idx, 1);
    writeData('products.json', data);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Protected API: Orders ──────────────────────────────────────────────────
app.get('/api/orders', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('aap_orders')
    .select('*')
    .order('order_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const validStatuses = ['pending', 'confirmed', 'delivered', 'cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }
    const { data, error } = await supabase
      .from('aap_orders')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PUT /api/orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Protected API: Subscriptions ───────────────────────────────────────────
app.get('/api/subscriptions', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('aap_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/subscriptions/:id', requireAuth, async (req, res) => {
  try {
    const validStatuses = ['active', 'paused', 'cancelled'];
    if (req.body.status && !validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }
    const { data, error } = await supabase
      .from('aap_subscriptions')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('PUT /api/subscriptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/subscriptions/:id/deliveries', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('aap_subscription_deliveries')
    .select('*')
    .eq('subscription_id', req.params.id)
    .order('delivered_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/subscriptions/:id/deliver', requireAuth, async (req, res) => {
  try {
    const subId = req.params.id;
    const { quantity, notes } = req.body;

    // Get subscription
    const { data: sub, error: subErr } = await supabase
      .from('aap_subscriptions')
      .select('*')
      .eq('id', subId)
      .single();
    if (subErr || !sub) return res.status(404).json({ error: 'Subscription not found' });

    // Insert delivery record
    const { data: delivery, error: delErr } = await supabase
      .from('aap_subscription_deliveries')
      .insert({
        subscription_id: subId,
        delivered_date: new Date().toISOString().split('T')[0],
        quantity: quantity || sub.quantity,
        notes: notes || '',
      })
      .select()
      .single();
    if (delErr) throw delErr;

    // Auto-advance next_delivery date
    const next = new Date(sub.next_delivery || new Date());
    if (sub.frequency === 'weekly') next.setDate(next.getDate() + 7);
    else if (sub.frequency === 'biweekly') next.setDate(next.getDate() + 14);
    else next.setMonth(next.getMonth() + 1);

    await supabase
      .from('aap_subscriptions')
      .update({ next_delivery: next.toISOString().split('T')[0] })
      .eq('id', subId);

    res.json({ success: true, delivery, next_delivery: next.toISOString().split('T')[0] });
  } catch (err) {
    console.error('POST /api/subscriptions/:id/deliver error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Protected API: Customers ───────────────────────────────────────────────
app.get('/api/customers', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('aap_customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Agent API: Marketing ───────────────────────────────────────────────────
app.post('/api/agents/marketing/generate', requireAuth, async (req, res) => {
  try {
    const { type, topic } = req.body;
    if (!type || !topic) {
      return res.status(400).json({ error: 'type and topic are required' });
    }
    const marketing = require('./agents/marketing');
    const draft = await marketing.generateDraft(type, topic);
    res.json(draft);
  } catch (err) {
    console.error('Marketing agent error:', err);
    res.status(500).json({ error: err.message || 'Agent error' });
  }
});

// ─── Agent API: Order Parse ─────────────────────────────────────────────────
app.post('/api/agents/order/parse', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    const orderAgent = require('./agents/order');
    const result = await orderAgent.parseMessage(message);
    res.json(result);
  } catch (err) {
    console.error('Order agent error:', err);
    res.status(500).json({ error: err.message || 'Agent error' });
  }
});

// ─── Agent API: Morning Brief ───────────────────────────────────────────────
app.get('/api/agents/brief', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Pending orders
    const { data: pendingOrders } = await supabase
      .from('aap_orders')
      .select('*')
      .eq('status', 'pending');

    // Subscriptions due this week
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const { data: dueSubs } = await supabase
      .from('aap_subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('next_delivery', weekFromNow.toISOString().split('T')[0]);

    // Pending drafts
    const { data: pendingDrafts } = await supabase
      .from('aap_content_drafts')
      .select('*')
      .eq('status', 'pending_approval');

    // Today's orders total
    const { data: todayOrders } = await supabase
      .from('aap_orders')
      .select('total')
      .gte('order_date', today);

    const todayRevenue = (todayOrders || []).reduce((sum, o) => sum + (o.total || 0), 0);

    const brief = {
      date: today,
      pending_orders: pendingOrders || [],
      subscriptions_due: dueSubs || [],
      pending_drafts: pendingDrafts || [],
      today_revenue: todayRevenue,
      summary: `📊 Morning Brief — ${today}\n\n` +
        `🛒 Pending Orders: ${(pendingOrders || []).length}\n` +
        `📦 Subscriptions Due (next 7 days): ${(dueSubs || []).length}\n` +
        `📝 Drafts Waiting Approval: ${(pendingDrafts || []).length}\n` +
        `💰 Today's Revenue: ₹${todayRevenue.toLocaleString('en-IN')}`
    };

    res.json(brief);
  } catch (err) {
    console.error('Brief error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Drafts API ─────────────────────────────────────────────────────────────
app.get('/api/drafts', requireAuth, async (req, res) => {
  const status = req.query.status || 'pending_approval';
  const { data, error } = await supabase
    .from('aap_content_drafts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/drafts/:id/approve', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('aap_content_drafts')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/drafts/:id/reject', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('aap_content_drafts')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/drafts/:id', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  const { data, error } = await supabase
    .from('aap_content_drafts')
    .update({ content })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ─── Agent Dashboard ────────────────────────────────────────────────────────
app.get('/admin/agent', requireAuth, (req, res) => {
  res.render('agent');
});

// ─── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// ─── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Annapurna Arogya Peeth server running on http://localhost:${PORT}`);
});
