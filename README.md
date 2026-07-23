<div align="center">
<img width="1200" height="475" alt="SooVoice Banner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# SooVoice - AI Voice Agent Platform

AI-powered voice assistant for merchants — handle customer calls, orders, and analytics with a customizable voice agent.

## Features

- **Voice AI Agent** — Gemini-powered real-time voice interactions
- **Dashboard** — Analytics, conversations, and order management
- **Integrations** — Shopify, Salla, Zid, WooCommerce, custom webhooks
- **Knowledge Base** — Upload documents to train your AI agent
- **Digital Menu** — QR-based tableside ordering system
- **Multi-language** — Arabic & English support
- **Super Admin Panel** — Merchant management, voice studio, system settings

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and fill in your keys:
   - `GEMINI_API_KEY` — Required for Gemini AI
   - `API_KEY` — For backend API authentication
   - `WEBHOOK_SECRET` — For webhook signature verification
3. Run the app:
   `npm run dev`

## Build

   `npm run build`

## Tech Stack

- React 19 + TypeScript + Vite
- Firebase (Auth + Firestore)
- Supabase (optional backend)
- Tailwind CSS v4
- Express.js (API server)
- Recharts (analytics)
