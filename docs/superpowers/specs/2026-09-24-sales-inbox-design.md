# Seller sales inbox — design spec (2026-09-24)

## Problem
The winner's WhatsApp lands in `orders.winner_contact`, but the seller's only
path to it is noticing a closed item → "See result" → win page. No inbox, no
post-stream discovery — and non-allowlisted owners get 403 on the win page.

## Decision (approved): seller orders inbox
A "Sales" page listing everything the signed-in user sold, with winner
contact + tap-to-chat per row.

## Changes
1. `GET /api/orders/sales` (new) — ownership-scoped: my rooms → their items
   with orders, merged server-side. Any signed-in user (open creation means
   anyone can sell), no allowlist. Tested (401, empty, join shape).
2. `app/[locale]/sales/page.tsx` (new) — NeuCard rows: 16:9 thumb, title,
   price, order-status badge, winner name (profiles, Leaderboard pattern),
   contact + wa.me button (or `noContactYet`), paid/created date.
3. Nav — header "Sales" link (signed-in, desktop) + sell-page link under the
   heading (covers mobile). Keys: `sales`, `noSales`, `noContactYet` (EN+ID).

## Invariants
- Sellers see only their own rooms' orders (ownership IS the check).
- RLS untouched; service_role only in the route. No new columns/tables.
- The win-page 403 for non-allowlisted owners is unchanged (separate fix,
  still open).
