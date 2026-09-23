# Winner-drops-contact handover — design spec (2026-09-23)

## Problem
Post-payment, the app promised "the seller will contact you" with no channel
behind it: profiles hold only a display name, orders hold no contact info.

## Decision (approved): winner drops contact
The winner saves a WhatsApp number on the win page; the seller reads it from
the same win page (orders are viewable by winner or allowlisted seller, and
closed items already link "See result" → win page, so no new seller UI).

## Changes
1. `orders.winner_contact text nullable` (migration applied + schema.sql).
2. `lib/contact.ts` — `normalizeContact` (digits only), `validateContact`
   (8–15 digits), `waLink` (wa.me URL). Tested.
3. `POST /api/orders/[id]/contact` (new, winner-only) — 401/404/400/403
   paths; stores the raw trimmed number. Tested.
4. Win page — client-side `me` check: winner sees save form (or the saved
   number); non-winner viewers (i.e. the seller) see the number + tap-to-chat
   wa.me link. Keys: `winnerContact`, `contactSaved`, `chatWinner` (EN+ID).

## Invariants
- Only the winner can write; only winner/seller can read (existing order
  visibility, untouched).
- No new seller UI, no new tables, RLS untouched.
