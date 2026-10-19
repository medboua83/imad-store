# 🌙 Imad Store — عماد ستور

## Project Overview & Features

**Imad Store** is a full-stack, luxury e-commerce platform built for Moroccan women shopping for hijabs, niqabs, abayas, and modest fashion accessories.

The platform is designed with an elegant, high-end aesthetic and supports **three languages** — Arabic (RTL), French, and English — making it accessible to the full Moroccan and diaspora market.

> **"Imad"** means *support* in Arabic — the brand embodies the radiance of modest beauty.

### Key Highlights

- 🌍 **Trilingual** — Arabic (RTL), French, English with automatic browser detection
- 💳 **Dual Payment** — Online card (Stripe) + Cash on Delivery (COD)
- 💬 **WhatsApp-first** — floating button on all pages, pre-filled messages per language
- 📱 **Web + Mobile** — Next.js web app and React Native / Expo mobile app
- 🛡️ **Admin Panel** — Separate dashboard to manage products, orders, and customers
- 🇲🇦 **Morocco-ready** — MAD currency, local addresses, CMI payment option

---

## ✨ Features

### 🛍️ Customer Storefront

- Elegant homepage with hero, featured products, and category grid
- Full product catalogue with filters (category, color, size, price range)
- Product detail page with multi-image gallery, color picker, size guide
- Persistent cart with slide-in drawer (Zustand + localStorage)
- Guest checkout — no account required
- 2-step checkout: address → payment method selection
- Order tracking and history in personal account

### 💳 Payments

- **Online** — Stripe card payment with 3D Secure support
- **Cash on Delivery** — order confirmed, paid at the door
- Automatic order confirmation email (Resend)
- WhatsApp confirmation link after every order

### 💬 WhatsApp Support

- Floating WhatsApp button (gold, animated pulse) on every page
- Pre-filled messages in the customer's chosen language (FR / AR / EN)
- Product-specific inquiry links
- COD order follow-up link

### 👩‍💼 Admin Dashboard (`admin.imad-store.ma`)

- Revenue & orders overview
- Full product CRUD with multi-image upload (Supabase Storage)
- Order management with status updates (Pending → Confirmed → Shipped → Delivered)
- Customer list with order history
- Store settings (WhatsApp number, shipping cost, COD toggle)

### 📱 Mobile App

- Available on iOS & Android (Expo / EAS Build)
- Push notifications for order status updates
- Same features as the web store

---

## 🛠️ Tech Stack & Dependencies

| Layer | Technology |
|-------|-----------|
| **Web Frontend** | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Framer Motion |
| **Mobile App** | React Native, Expo SDK 51, NativeWind |
| **State Management** | Zustand |
| **Backend** | Node.js, Express.js, Prisma ORM |
| **Database** | PostgreSQL (Supabase) |
| **File Storage** | Supabase Storage (product images) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Payments** | Stripe · CMI Maroc (optional) |
| **Email** | Resend |
| **i18n** | next-intl (ar · fr · en) |
| **Fonts** | Cormorant Garamond · DM Sans · Amiri (Arabic) |
| **Deployment** | Vercel (web) · Railway (backend) · EAS (mobile) |
| **CI/CD** | GitHub Actions |
| **HTTP Client** | Axios |
| **Date Handling** | Day.js |
| **Form Validation** | Zod |

---

## 📦 Setup & Installation

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+ (`npm install -g pnpm`)
- [Docker](https://docker.com/) (for local PostgreSQL)
- [Expo CLI](https://expo.dev/) (`npm install -g @expo/cli`) — for mobile

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/imad-store.git
cd imad-store
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start Local Database

```bash
docker-compose up -d
```

This starts a local PostgreSQL instance on port `5432`.

### 4. Configure Environment Variables

Copy the example files and fill in your values:

```bash
# Backend
cp backend/.env.example backend/.env

# Web frontend
cp apps/web/.env.example apps/web/.env.local

# Admin
cp admin/.env.example admin/.env.local
```

See [Environment Variables](#-environment-variables) for full details.

### 5. Run Database Migrations

```bash
cd backend
pnpm prisma migrate dev --name init
pnpm prisma db seed          # Seeds sample products & categories
```

### 6. Start All Services

From root — starts backend + web + admin in parallel:

```bash
pnpm dev
```

Or start individually:

```bash
pnpm --filter backend dev       # API → http://localhost:4000
pnpm --filter web dev           # Web → http://localhost:3000
pnpm --filter admin dev         # Admin → http://localhost:3001
```

---

## 🔐 Environment Variables Configuration

### Backend — `backend/.env`

```env
# Server
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/imad_store

# Auth
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Stripe (test mode is free)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=product-images

# Resend (Email)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@imad-store.ma

# WhatsApp
WHATSAPP_PHONE=212XXXXXXXXX
```

### Web Frontend — `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_WHATSAPP_NUMBER=212XXXXXXXXX
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Admin Panel — `admin/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

> 💡 **Important**: Replace all placeholder values (`xxxx`, `sk_test_...`, `eyJ...`, etc.) with your actual credentials from the respective dashboards (Supabase, Stripe, Resend, Twilio, etc.).

---

## ▶️ Running the Apps

### Web App

```bash
pnpm --filter web dev
```

Open [http://localhost:3000](http://localhost:3000)

| Route | Description |
|-------|-------------|
| `/fr` | Homepage (French) |
| `/ar` | Homepage (Arabic — RTL) |
| `/en` | Homepage (English) |
| `/fr/shop` | Product catalogue |
| `/fr/cart` | Shopping cart |
| `/fr/checkout` | Checkout |
| `/fr/account` | Customer account |
| `/fr/auth/login` | Login page |

### Admin Panel

```bash
pnpm --filter admin dev
```

Open [http://localhost:3001](http://localhost:3001)

Default admin credentials (after seeding):
- **Email:** `admin@imad-store.ma`
- **Password:** `Admin123!`

> 💡 The admin panel is a separate Next.js app — it runs independently of the customer storefront.
>
> ⚠️ Change these immediately in production.

### Mobile App

```bash
cd apps/mobile
pnpm start
```

- Scan the QR code with **Expo Go** (iOS / Android)
- Or press `a` for Android emulator, `i` for iOS simulator

### Backend API

```bash
pnpm --filter backend dev
```

API runs at [http://localhost:4000](http://localhost:4000)

Swagger docs: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

---

## 🌍 i18n — Languages

The app supports **3 languages** with automatic browser detection:

| Locale | Language | Direction | Font |
|--------|----------|-----------|------|
| `fr` | Français (default) | LTR | Cormorant Garamond + DM Sans |
| `ar` | العربية | **RTL** | Amiri / Noto Naskh Arabic |
| `en` | English | LTR | Cormorant Garamond + DM Sans |

### Switching Languages

Users switch language from the **Navbar** using the flag picker (🇫🇷 🇲🇦 🇬🇧). The preference is saved in a cookie.

### Adding Translations

Translation files are in `apps/web/messages/`:

```
messages/
├── fr.json     # French
├── ar.json     # Arabic
└── en.json     # English
```

To add a new key:

```json
// messages/fr.json
{ "mySection": { "myKey": "Ma valeur" } }

// messages/ar.json
{ "mySection": { "myKey": "قيمتي" } }

// messages/en.json
{ "mySection": { "myKey": "My value" } }
```

Usage in a component:

```tsx
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("mySection");
  return <p>{t("myKey")}</p>;
}
```

### RTL Layout

When locale is `ar`, the HTML root switches to `dir="rtl"`. Use Tailwind's `rtl:` variant for RTL-specific styles:

```tsx
<div className="ml-4 rtl:ml-0 rtl:mr-4">...</div>
```

---

## 💳 Payment Integration

### Online Payment — Stripe

1. Customer selects "Paiement en ligne" at checkout
2. Stripe Elements card form is mounted
3. Payment intent is created server-side: `POST /api/payments/create-intent`
4. Customer confirms payment
5. Stripe webhook fires → order marked `CONFIRMED`
6. Confirmation email + WhatsApp link sent automatically

**Test card numbers:**

| Card | Number |
|------|--------|
| Visa (success) | `4242 4242 4242 4242` |
| Requires auth | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 9995` |

Use any future expiry date, any 3-digit CVC.

### Cash on Delivery — COD

1. Customer selects "Paiement à la livraison"
2. Order is created with `paymentStatus: PENDING`
3. Admin receives an email notification
4. Admin confirms & ships the order
5. On delivery, admin marks order as `DELIVERED` + `PAID`

---

## 💬 WhatsApp Integration

The WhatsApp button is always visible — fixed bottom-right, gold color, animated pulse ring.

Messages are pre-filled in the customer's chosen language:

```
🇫🇷 "Bonjour, je voudrais plus d'informations sur vos produits 🌿"
🇲🇦 "السلام عليكم، أريد الاستفسار عن منتجاتكم 🌿"
🇬🇧 "Hello, I would like more information about your products 🌿"
```

After placing a COD order, a WhatsApp link appears so the customer can instantly confirm with the store.

To change the WhatsApp number:

```env
# backend/.env
WHATSAPP_PHONE=212XXXXXXXXX

# apps/web/.env.local
NEXT_PUBLIC_WHATSAPP_NUMBER=212XXXXXXXXX
```

---

## 🚢 Deployment

### Web — Vercel

```bash
# Install Vercel CLI
npm install -g vercel

cd apps/web
vercel --prod
```

Set environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Backend — Railway

1. Push to GitHub
2. Create a new Railway project → connect your repo
3. Set root directory to `backend/`
4. Add all environment variables
5. Railway auto-deploys on push to `main`

### Admin — Vercel (separate project)

```bash
cd admin
vercel --prod
```

Deploy to a subdomain: `admin.imad-store.ma`

### Mobile — EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

cd apps/mobile

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

Submit to stores:

```bash
eas submit --platform android
eas submit --platform ios
```

### Stripe Webhook (Production)

After deploying the backend, configure the Stripe webhook:

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://api.imad-store.ma/api/payments/webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the webhook secret → set as `STRIPE_WEBHOOK_SECRET` in backend env

---

## 📊 Database — Prisma

### Common Commands

```bash
cd backend

# Apply migrations
pnpm prisma migrate dev

# Open Prisma Studio (visual DB browser)
pnpm prisma studio

# Seed the database with sample data
pnpm prisma db seed

# Reset database (⚠️ destroys all data)
pnpm prisma migrate reset
```

### Main Models

| Model | Description |
|-------|-------------|
| `User` | Customers & admins |
| `Product` | Items with multilingual fields (FR/AR/EN) |
| `Category` | Hijab, Niqab, Abaya, Accessories |
| `ProductVariant` | Color + size combinations |
| `Order` | Customer orders |
| `OrderItem` | Line items within an order |
| `Address` | Delivery addresses |

---

## 🗺️ Roadmap

- [ ] CMI Maroc payment gateway (native Moroccan payment)
- [ ] Loyalty points system
- [ ] Product reviews & ratings
- [ ] Wishlist / saved items
- [ ] SMS order notifications (via Twilio or local provider)
- [ ] PWA support for the web app

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://conventionalcommits.org):

```
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    Formatting, no logic change
refactor: Code change, no feature/fix
test:     Adding tests
chore:    Build process, tooling
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

Built with ❤️ for Moroccan women

🌙 **Imad Store** — *الأناقة في كل خطوة*

</div>
## Installer le modèle pour une autre entreprise

Voir [le kit d’installation](docs/STORE_INSTALLATION_KIT.md) : archive de code, profil privé, identifiant indépendant, premier administrateur et raccordement au module CRM.
