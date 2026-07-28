# Annapurna Arogya Peeth — Complete Documentation

> Last updated: 2026-07-28

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [VPS Setup](#4-vps-setup)
5. [Security Hardening](#5-security-hardening)
6. [SEO Setup](#6-seo-setup)
7. [Deployment Workflow](#7-deployment-workflow)
8. [Environment Variables](#8-environment-variables)
9. [Database Schema](#9-database-schema)
10. [API Endpoints](#10-api-endpoints)
11. [Troubleshooting](#11-troubleshooting)
12. [Cost Breakdown](#12-cost-breakdown)
13. [Pending Items](#13-pending-items)

---

## 1. Project Overview

**Annapurna Arogya Peeth** is a homemade flour business website selling diabetic-friendly, heart-healthy millet atta. The site is bilingual (English + Marathi) and includes:

- Public-facing product catalog
- Order and subscription management
- Admin dashboard with AI-powered order parsing
- WhatsApp integration for customer communication
- n8n workflow automation for notifications

**Domain:** `annapurna.merasahayak-ai.in`
**Repository:** https://github.com/SameerChawan/Annapurna_Arogya_Peeth

---

## 2. Architecture

```
User → Cloudflare (DNS + SSL + CDN + WAF + DDoS)
         ↓
    VPS (103.160.106.84)
         ↓
    Nginx (port 80/443)
         ├── annapurna.merasahayak-ai.in → localhost:3001 → Docker (Annapurna)
         ├── n8n.merasahayak-ai.in       → localhost:5678 → Docker (n8n)
         ├── dashboard.merasahayak-ai.in → localhost:3002 → Node.js (systemd)
         └── merasahayak-ai.in           → /opt/apps/landing/ (static HTML)

    UFW: Only 22, 80, 443
    Fail2Ban: 3 jails (sshd, nginx-limit-req, nginx-botsearch)
    Docker: Isolated containers with resource limits
```

### Container Architecture

| Service | Port | Runtime | Directory |
|---------|------|---------|-----------|
| Annapurna Website | 3001 | Docker | `/opt/apps/annapurna/` |
| n8n | 5678 | Docker | `/opt/apps/n8n/` |
| Monitoring Dashboard | 3002 | systemd | `/opt/apps/dashboard/` |
| Landing Page | - | Nginx static | `/opt/apps/landing/` |

---

## 3. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 22 (Alpine) |
| Framework | Express.js | 4.18.2 |
| Template Engine | EJS | 3.1.9 |
| Database | Supabase (PostgreSQL) | Free tier |
| AI Provider | OpenRouter (Gemini 2.5 Flash Lite) | - |
| Process Manager | Docker Compose | 5.3.1 |
| Reverse Proxy | Nginx | 1.24.0 |
| SSL/CDN | Cloudflare | Free plan |
| VPS | MilesWeb SM-L2 | 8GB RAM, 100GB NVMe |
| OS | Ubuntu | 24.04 LTS |

### Dependencies

```json
{
  "@supabase/supabase-js": "^2.110.7",
  "body-parser": "^1.20.2",
  "dotenv": "^17.4.2",
  "ejs": "^3.1.9",
  "express": "^4.18.2",
  "express-rate-limit": "^7.5.0",
  "express-session": "^1.17.3",
  "helmet": "^8.1.0",
  "marked": "^18.0.6",
  "openai": "^6.48.0"
}
```

---

## 4. VPS Setup

### Initial Server Configuration

```bash
# SSH into VPS
ssh root@103.160.106.84

# Create superuser
adduser SameerChawan
usermod -aG sudo SameerChawan
echo "SameerChawan ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/SameerChawan

# Set hostname
hostnamectl set-hostname merasahayak

# Update packages
sudo apt update && sudo apt upgrade -y
```

### SSH Hardening

```bash
# Generate SSH key locally
ssh-keygen -t ed25519 -f ~/.ssh/merasahayak

# Copy key to VPS
ssh-copy-id -i ~/.ssh/merasahayak.pub SameerChawan@103.160.106.84

# Edit SSH config
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no
# Set: PubkeyAuthentication yes

# Restart SSH
sudo systemctl restart sshd
```

### Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

### Fail2Ban

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check banned IPs
sudo fail2ban-client status sshd
```

### Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker SameerChawan

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### Nginx Configuration

```nginx
# /opt/nginx/conf.d/annapurna.conf
server {
    listen 80;
    server_name annapurna.merasahayak-ai.in;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    location /admin/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:3001;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
```

### Cloudflare DNS

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | 103.160.106.84 | Proxied (orange) |
| A | www | 103.160.106.84 | Proxied (orange) |
| A | annapurna | 103.160.106.84 | Proxied (orange) |
| A | n8n | 103.160.106.84 | Proxied (orange) |
| A | dashboard | 103.160.106.84 | Proxied (orange) |

**SSL Settings in Cloudflare:**
- SSL mode: Full
- Always Use HTTPS: On
- Min TLS Version: 1.2
- HSTS: Enabled (max-age: 1 year)

---

## 5. Security Hardening

### Application-Level Security (server.js)

#### Helmet.js — Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],  // Required for onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "https://*.supabase.co"],
      connectSrc: ["'self'", "https://*.supabase.co", "https://openrouter.ai"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
```

**Headers added by Helmet:**
- `Content-Security-Policy` — Controls what resources can load
- `Strict-Transport-Security` — Forces HTTPS
- `X-Frame-Options: SAMEORIGIN` — Prevents clickjacking
- `X-Content-Type-Options: nosniff` — Prevents MIME sniffing
- `X-XSS-Protection: 0` — Modern browsers use CSP instead
- `Referrer-Policy: no-referrer` — Don't send referrer info
- `Cross-Origin-Opener-Policy: same-origin` — Isolates browsing context
- `Cross-Origin-Resource-Policy: same-origin` — Prevents cross-origin reads
- `X-DNS-Prefetch-Control: off` — Prevents DNS prefetch leaks
- `X-Download-Options: noopen` — Prevents IE downloads executing
- `X-Permitted-Cross-Domain-Policies: none` — Blocks Flash/PDF

#### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// General API: 100 requests per 15 minutes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Login: 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});

// Orders: 20 per hour
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
});
```

#### CORS Restriction

```javascript
// BEFORE (vulnerable):
res.header('Access-Control-Allow-Origin', '*');

// AFTER (secure):
const ALLOWED_ORIGINS = [
  'https://annapurna.merasahayak-ai.in',
  'https://www.merasahayak-ai.in',
  'http://localhost:3000'
];

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  // ...
});
```

#### Session Cookie Hardening

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
    httpOnly: true,                 // JS can't read cookie
    secure: 'auto',                 // HTTPS only in production
    sameSite: 'lax'                 // Prevents CSRF
  }
}));
```

**Why `secure: 'auto'` instead of `true`:**
- Cloudflare handles SSL termination
- Inside Docker, traffic is HTTP
- `auto` sets secure flag based on request protocol

**Why `sameSite: 'lax'` instead of `strict`:**
- `strict` breaks sessions when redirected from Cloudflare
- `lax` allows cookies on top-level navigations (clicking links)

#### Credential Security

```javascript
// No hardcoded fallbacks — server crashes if env vars missing
const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('FATAL: ADMIN_USERNAME and ADMIN_PASSWORD must be set');
  process.exit(1);
}
```

#### Trust Proxy

```javascript
// Required when behind Cloudflare + Nginx
app.set('trust proxy', 1);
```

**Why this is needed:**
- Express sees requests from `127.0.0.1` (Nginx)
- Rate limiter needs real client IP from `X-Forwarded-For` header
- Without this, rate limiter treats all requests as same user

### Security Test Results

| Test | Result |
|------|--------|
| Password SSH login | Blocked ✅ |
| Root SSH login | Blocked ✅ |
| Internal ports (3001, 5678) | Bound to 127.0.0.1 ✅ |
| Dashboard auth | 401 without creds ✅ |
| Security headers (all sites) | All 11 headers present ✅ |
| Container users | Both run as `node` ✅ |
| Rate limiting | Configured ✅ |
| Server tokens | Hidden ✅ |
| UFW | Only 22, 80, 443 ✅ |
| Fail2Ban | Active ✅ |

---

## 6. SEO Setup

### Sitemap (`public/sitemap.xml`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://annapurna.merasahayak-ai.in/</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="en" href="https://annapurna.merasahayak-ai.in/" />
    <xhtml:link rel="alternate" hreflang="mr" href="https://annapurna.merasahayak-ai.in/mr" />
  </url>
  <url>
    <loc>https://annapurna.merasahayak-ai.in/mr</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://annapurna.merasahayak-ai.in/market-research</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://annapurna.merasahayak-ai.in/business-plan</loc>
    <lastmod>2026-07-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

### Robots.txt (Dynamic)

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /admin/login

Host: annapurna.merasahayak-ai.in
Sitemap: https://annapurna.merasahayak-ai.in/sitemap.xml
```

**Note:** Cloudflare prepends AI bot blocking (GPTBot, ClaudeBot, etc.)

### Meta Tags (views/index.ejs)

```html
<!-- Canonical URL — dynamic per language -->
<link rel="canonical" href="https://annapurna.merasahayak-ai.in<%= lang === 'mr' ? '/mr' : '' %>">

<!-- Hreflang — tells Google about language variants -->
<link rel="alternate" hreflang="en" href="https://annapurna.merasahayak-ai.in/" />
<link rel="alternate" hreflang="mr" href="https://annapurna.merasahayak-ai.in/mr" />
<link rel="alternate" hreflang="x-default" href="https://annapurna.merasahayak-ai.in/" />

<!-- Open Graph — social media sharing -->
<meta property="og:title" content="<%= lang === 'mr' ? 'अन्नपूर्णा...' : 'Annapurna...' %>">
<meta property="og:url" content="https://annapurna.merasahayak-ai.in<%= lang === 'mr' ? '/mr' : '' %>">
<meta property="og:image" content="https://annapurna.merasahayak-ai.in/hero-banner.png">

<!-- Twitter — now bilingual -->
<meta name="twitter:title" content="<%= lang === 'mr' ? 'अन्नपूर्णा...' : 'Annapurna...' %>">
```

### Structured Data (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Annapurna Arogya Peeth",
  "description": "Homemade natural millet flour. Diabetic-friendly, heart-healthy atta.",
  "url": "https://annapurna.merasahayak-ai.in",
  "image": "https://annapurna.merasahayak-ai.in/hero-banner.png",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Mumbai",
    "addressRegion": "Maharashtra",
    "addressCountry": "IN"
  },
  "areaServed": {
    "@type": "City",
    "name": "Mumbai"
  },
  "priceRange": "₹200-₹275",
  "openingHours": "Mo-Sa 09:00-18:00",
  "sameAs": []
}
```

### Google Search Console

**Verification method:** DNS TXT record in Cloudflare

```
Type: TXT
Name: @
Content: google-site-verification=78H9yWJx4pQsHqWzICBLaoVXNUrgKcp4Vget_qfzBos
```

**Sitemap submitted at:** `https://annapurna.merasahayak-ai.in/sitemap.xml`

---

## 7. Deployment Workflow

### Local → GitHub → VPS

```bash
# 1. Edit files locally (OneDrive/Sameer POS)

# 2. Commit and push
cd "C:\Users\samee\OneDrive\Sameer POS\Annapurna_Arogya_Peeth"
git add .
git commit -m "description of changes"
git push origin main

# 3. Deploy to VPS
ssh -i ~/.ssh/merasahayak SameerChawan@103.160.106.84 \
  "cd /opt/apps/annapurna && \
   sudo git fetch origin && \
   sudo git reset --hard origin/main && \
   sudo docker compose up -d --build"
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  annapurna:
    build: .
    container_name: annapurna
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3000"
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/node_modules
```

### Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

### Checking Deployment Status

```bash
# Check container status
ssh -i ~/.ssh/merasahayak SameerChawan@103.160.106.84 "sudo docker ps"

# Check logs
ssh -i ~/.ssh/merasahayak SameerChawan@103.160.106.84 "sudo docker logs annapurna --tail 20"

# Check if site is responding
ssh -i ~/.ssh/merasahayak SameerChawan@103.160.106.84 "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/"

# Check security headers
ssh -i ~/.ssh/merasahayak SameerChawan@103.160.106.84 "curl -sI http://localhost:3001/ | head -20"
```

---

## 8. Environment Variables

### Required Variables (VPS `.env`)

```bash
# Supabase
SUPABASE_URL=https://nuoyckfrcoownqnfwndi.supabase.co
SUPABASE_KEY=sb_publishable_...

# OpenRouter (AI)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash-lite

# Security (REQUIRED — server crashes without these)
SESSION_SECRET=<strong-random-string>
ADMIN_USERNAME=<admin-username>
ADMIN_PASSWORD=<strong-password>

# Server
PORT=3000
NODE_ENV=production

# Optional
ORDER_WEBHOOK_URL=https://n8n.merasahayak-ai.in/webhook/...
```

### Generating Secure Secrets

```bash
# Generate random session secret
openssl rand -hex 32

# Generate random password
openssl rand -base64 24
```

---

## 9. Database Schema

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `aap_products` | Product catalog |
| `aap_orders` | Customer orders |
| `aap_customers` | Customer records |
| `aap_subscriptions` | Recurring deliveries |
| `aap_subscription_deliveries` | Delivery tracking |
| `aap_content_drafts` | AI-generated content |

### Key Columns

**aap_products:**
- `id` (text, PK) — e.g., "PROD-abc123"
- `name_en`, `name_mr` — Product names
- `price` (integer) — Price in INR
- `image` (text) — Google Drive URL
- `active` (boolean) — Visibility toggle

**aap_orders:**
- `id` (integer, PK, auto)
- `customer_id` (integer, FK)
- `customer_name`, `phone`, `address`
- `items` (jsonb) — Array of {productId, quantity, price}
- `total` (integer)
- `status` — 'pending' | 'confirmed' | 'delivered' | 'cancelled'
- `order_date` (timestamp, default now())

---

## 10. API Endpoints

### Public Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | English homepage |
| GET | `/mr` | Marathi homepage |
| GET | `/market-research` | Market research doc |
| GET | `/business-plan` | Business plan doc |
| GET | `/sitemap.xml` | XML sitemap |
| GET | `/robots.txt` | Robots file |
| POST | `/api/order` | Place order |
| POST | `/api/subscribe` | Create subscription |

### Admin Routes (require auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/admin/login` | Authentication |
| GET | `/admin` | Dashboard |
| GET | `/admin/agent` | AI agent dashboard |
| GET | `/admin/logout` | Logout |
| GET | `/api/products` | List products |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| GET | `/api/orders` | List orders |
| PUT | `/api/orders/:id` | Update order status |
| GET | `/api/subscriptions` | List subscriptions |
| PUT | `/api/subscriptions/:id` | Update subscription |
| POST | `/api/subscriptions/:id/deliver` | Record delivery |
| GET | `/api/customers` | List customers |
| POST | `/api/agents/order/parse` | Parse WhatsApp message |
| POST | `/api/agents/marketing/generate` | Generate marketing content |
| GET | `/api/agents/brief` | Morning brief |
| GET | `/api/drafts` | List content drafts |
| POST | `/api/drafts/:id/approve` | Approve draft |
| POST | `/api/drafts/:id/reject` | Reject draft |

---

## 11. Troubleshooting

### Admin Panel Tabs Not Working

**Symptom:** Login works but clicking tabs (Orders, Products, etc.) does nothing.

**Cause:** Helmet.js CSP blocks inline event handlers (`onclick="..."`).

**Fix:** Add `scriptSrcAttr: ["'unsafe-inline'"]` to Helmet CSP config:
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrcAttr: ["'unsafe-inline'"],
      // ... other directives
    },
  },
}));
```

### Session Not Persisting (Redirect Loop)

**Symptom:** Login redirects back to login page.

**Cause:** `secure: true` cookie flag requires HTTPS, but Docker runs on HTTP internally.

**Fix:** Use `secure: 'auto'` instead:
```javascript
cookie: {
  secure: 'auto',    // Sets based on request protocol
  sameSite: 'lax'    // Not 'strict' — breaks on Cloudflare redirects
}
```

### Rate Limiter Error Behind Proxy

**Symptom:** Error `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`

**Cause:** Express doesn't trust proxy headers by default.

**Fix:** Add trust proxy setting:
```javascript
app.set('trust proxy', 1);
```

### Locked Out by UFW

**Symptom:** Can't SSH after enabling UFW.

**Cause:** Enabled UFW before allowing SSH port.

**Fix:** Use MilesWeb console → disable UFW → add SSH rule → re-enable.

### SQLite Migration Missing WAL

**Symptom:** n8n database corrupted after migration.

**Cause:** Didn't include WAL (Write-Ahead Log) files.

**Fix:** Stop source n8n first, then copy database.sqlite + database.sqlite-wal + database.sqlite-shm.

### Docker Git Ownership Issue

**Symptom:** `git pull` fails with "dubious ownership" error.

**Cause:** Repository cloned as root, but running as `node` user.

**Fix:**
```bash
sudo chown -R SameerChawan:SameerChawan /opt/apps/annapurna/.git
```

---

## 12. Cost Breakdown

| Item | Monthly Cost |
|------|-------------|
| MilesWeb VPS (SM-L2) | ₹749 |
| Domain (merasahayak-ai.in) | ~₹70 |
| Cloudflare | Free |
| Supabase | Free tier |
| OpenRouter | Pay-per-use |
| **Total** | **~₹820/mo** |

### VPS Capacity

| Resource | Total | Used | Available |
|----------|-------|------|-----------|
| RAM | 8 GB | 1.2 GB | 6.6 GB |
| CPU | 2 cores | 0.2 | 1.8 cores |
| Disk | 99 GB | 8.9 GB | 85 GB |
| **Client capacity** | | | **15-20 clients** |

---

## 13. Pending Items

### High Priority
- [ ] Google My Business — register for local search
- [ ] Get 2 reviews from existing customers
- [ ] WhatsApp Business API integration

### Medium Priority
- [ ] Set up Zoho Mail for business email
- [ ] Bundle offer ("2kg for ₹475")
- [ ] Create pamphlet/standee design for retail partner
- [ ] Print pamphlets (500 units)

### Low Priority
- [ ] Move inline JS to separate files (cleaner CSP)
- [ ] Add `.js` file for admin panel logic
- [ ] Set up automated backups to external storage

---

## Access Credentials

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| VPS SSH | ssh SameerChawan@103.160.106.84 | SameerChawan | Key-only |
| Annapurna Admin | https://annapurna.merasahayak-ai.in/admin | NayanaChawan | Nayana@2471 |
| n8n Editor | https://n8n.merasahayak-ai.in | (from database) | (from database) |
| Dashboard | https://dashboard.merasahayak-ai.in | admin | Sameer@2026 |
| Supabase | https://supabase.com/dashboard | (your account) | (your account) |
| Cloudflare | https://dash.cloudflare.com | (your account) | (your account) |
| GitHub | https://github.com/SameerChawan | (your account) | (your account) |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Main application entry point |
| `views/index.ejs` | Public homepage (bilingual) |
| `views/admin.ejs` | Admin dashboard |
| `views/login.ejs` | Admin login page |
| `public/sitemap.xml` | XML sitemap for search engines |
| `lib/supabase.js` | Supabase client initialization |
| `lib/openrouter.js` | OpenRouter AI client |
| `agents/order.js` | AI order parsing agent |
| `agents/marketing.js` | AI marketing content generator |
| `docker-compose.yml` | Docker container configuration |
| `.env` | Environment variables (never commit) |
| `.env.example` | Template for environment variables |

---

*Document generated: 2026-07-28*
*Last deployment: 2026-07-28 14:53 IST*
