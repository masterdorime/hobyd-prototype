# HOBYD — Live Auction Pilot MVP

Live-auction pilot: sellers stream via LiveKit, buyers bid in realtime
(Supabase), winners pay via QRIS (Midtrans sandbox). UI in Indonesian and
English (`/id`, `/en`), mobile-first responsive.

## Run

```bash
cp .env.example .env.local   # fill all 12 values — see docs/SETUP.md §6
npm install
npm run dev                  # http://localhost:3000/id
```

Full setup (Supabase SQL apply + Storage + Auth, LiveKit Cloud, Midtrans
sandbox + webhook URL, all env values and where to get each one, post-deploy
seed + acceptance): **[docs/SETUP.md](docs/SETUP.md)**.

## Deploy

1. Push branch `hobyd-mvp` to GitHub.
2. [vercel.com/new](https://vercel.com/new) → Import repo (Next.js preset).
3. Set all 12 env vars from `.env.example` (Production) — names + sources in docs/SETUP.md §6.
4. Deploy, then set the Midtrans notification URL to
   `https://<your-app>.vercel.app/api/orders/webhook`.

```bash
npx vercel --prod            # or dashboard import (see docs/SETUP.md §5)
```

## Verify

```bash
npx vitest run     # unit suite (must be ALL PASS)
npx tsc --noEmit   # types clean
npx next build     # production build
```

Queued live verifications (need backends — not runnable without secrets):
Supabase `schema.sql` apply incl. `place_bid`/`close_item` + RLS
no-client-writes probe (`docs/SETUP.md` §1.3), and the Task 8 acceptance run
against the prod URL (`docs/SETUP.md` §8: seller listing, bids, last-10s
extend, cap/429/double-close checks, QR 5:00, mock-confirm, expiry, ID+EN
toggle, two-client race smoke).

Note: orders `expired` is terminal — an unpaid order stays `expired` and the
seller relists as a new item; `cancelled` is reserved for explicit manual
seller cancel.
