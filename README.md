# StudioBook — Studio 8Teen Photography Services

Full-stack capstone: React + Supabase + Cloudinary + Vercel.

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4
- **Backend:** Supabase (Auth, PostgreSQL, RLS, Edge Functions)
- **Images:** Cloudinary CDN (portfolio, client galleries, payment proofs)
- **Deploy:** Vercel

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run migrations: `supabase db push` (or paste SQL from `supabase/migrations/` in SQL Editor)
3. Run seed: paste `supabase/seed.sql` in SQL Editor
4. Create admin user in Auth with metadata: `{ "full_name": "Admin", "role": "admin" }`

### 2. Cloudinary

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Create unsigned upload preset `studiobook_uploads` with folder `studiobook/`

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in Supabase + Cloudinary keys
npm install
npm run dev
```

### 4. Vercel

1. Import repo, set root directory to `frontend/`
2. Add env vars from `.env.example`
3. Deploy — `vercel.json` handles SPA routing

## Features

- Online booking with calendar & availability heatmap
- Payment inside booking (QR + screenshot upload, downpayment/full)
- Admin verification workflow
- Client portfolio gallery (admin uploads post-shoot)
- Public portfolio, mood boards, checklists, pose gallery
- FAQ chatbot, notifications, insight reports
- QR booking verification

## Demo Script

1. Client registers → books session → uploads payment proof
2. Admin verifies payment → booking confirmed
3. Admin uploads client gallery photos → client views in Portfolio sidebar
4. FAQ chatbot on homepage; reports in admin dashboard
