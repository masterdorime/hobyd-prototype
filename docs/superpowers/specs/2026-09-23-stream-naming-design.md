# Stream naming — design spec (2026-09-23)

## Problem
Every new stream is titled "HOBYD Live" and uncategorized. Lobby rows are
indistinguishable; the category gate can only be opened after entering the room.

## Decision (approved)
Name + category are captured **upfront** in a shared `GoLiveDialog`, used by
both creation surfaces (header Go Live, mobile BottomNav Go Live). Owners can
rename/recategorize later via an owner-only settings route and a preview
title-edit row on the sell page.

## Changes
1. `lib/rooms.ts` — `validateRoomTitle(v)` pure (trim, 1–80 chars);
   `buildRoomRow` accepts optional `category` (validated, else omitted).
2. `POST /api/rooms` — accepts `{ title, category? }`; invalid category → null
   (room still opens; gate unchanged). Title validated server-side, falls back
   to "HOBYD Live" on empty.
3. `POST /api/rooms/[id]/settings` (new, owner-only) — partial update of
   `{ title?, category? }`; 401/403/404/400 paths mirror the old category route.
4. **Delete** `app/api/rooms/[id]/category/route.ts`; live-page `pickCategory`
   calls `/settings` with `{ category }` instead (same UX, one route).
5. `components/GoLiveDialog.tsx` (new, shared) — title `FieldInput` +
   category radio (`CATEGORIES`) + Cancel / Create-and-go. Backdrop click and
   Escape close. Empty title → inline `titleRequired` error, no POST.
   On success pushes `/${locale}/live/${id}`.
6. `Chrome.tsx` + `BottomNav.tsx` — Go Live buttons open the dialog instead of
   POSTing directly. Logged-out BottomNav still links to login.
7. Sell page — after a successful listing, the "Listed" row gains an inline
   title input + save (PATCHes via `/settings`), so the preview room is
   renameable without entering it.
8. i18n — `streamTitle`, `titleRequired`, `createAndGo` in EN + ID.

## Invariants
- Open creation unchanged: any signed-in user, still opens as `preview`.
- No new columns (title + category exist). No DELETE route (still YAGNI).
- RLS untouched; service_role only in routes. One topic per component untouched.
