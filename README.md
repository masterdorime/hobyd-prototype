# HOBYD — Live Auction Marketplace for Collectors

**HOBYD = HOBBY + BID**

A live-auction marketplace prototype built for collectors and hobby communities, combining real-time auctions, live video, chat, bidding, and checkout into one mobile-first experience.

> **Discover. Watch. Bid. Collect.**

---

## Overview

HOBYD is a live-commerce marketplace prototype designed around collectible and hobby communities.

Instead of treating auctions as static listings, HOBYD combines:

* Live auction rooms
* Real-time bidding
* Live video
* Community chat
* Auction timers
* Automatic auction closing
* Checkout and payment flow
* Seller and buyer experiences

The prototype currently focuses on **Pokemon TCG as the initial beachhead market**, while keeping the underlying architecture flexible enough to support other collectible categories.

---

## Core User Flow

```text
Discover
   ↓
Enter Live Room
   ↓
Watch Stream
   ↓
Browse Items
   ↓
Chat / Bid
   ↓
Auction Closes
   ↓
Order Created
   ↓
Payment
   ↓
Seller Handoff
```

---

## Product Scope

### Buyer

Buyers can:

* Browse active auction rooms
* Enter live rooms
* Watch sellers stream
* View auction items
* Place bids
* Follow bid activity in real time
* Participate in chat
* Win auction items
* Complete checkout
* Track order status

### Seller

Sellers can:

* Create auction rooms
* Configure auction items
* Start live sessions
* Stream through LiveKit
* Run multiple items inside a room
* Receive bids in real time
* Manage auction progression
* Close auctions
* Process resulting orders

---

## Auction System

HOBYD currently supports two auction modes.

### Soft Close

The auction receives additional time when a qualifying bid arrives near the end.

Current prototype configuration:

```text
Extension window: 10 seconds
Extension amount: 10 seconds
Maximum extensions: 5
```

Example:

```text
Auction
00:08
   ↓
New qualifying bid
   ↓
Timer extends
   ↓
00:18
```

The purpose is to reduce last-second timing issues while keeping the auction mechanism deterministic.

### Sudden Death

The auction ends when the timer reaches zero.

No additional extension is applied.

```text
00:03
00:02
00:01
00:00
 ↓
Auction closes
```

---

## Realtime Architecture

HOBYD uses separate services for different realtime responsibilities.

```text
                    ┌─────────────────┐
                    │     Browser     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
       ┌─────────────┐              ┌─────────────┐
       │   Next.js   │              │   LiveKit   │
       │ Application │              │ Live Video  │
       └──────┬──────┘              └─────────────┘
              │
              ▼
       ┌─────────────┐
       │  Supabase   │
       │ Auth / DB   │
       │ Realtime    │
       └──────┬──────┘
              │
              ▼
       ┌─────────────┐
       │ PostgreSQL  │
       └─────────────┘
```

### LiveKit

Used for:

* Seller video
* Viewer streams
* Room connections
* Real-time media transport

### Supabase

Used for:

* Authentication
* PostgreSQL database
* Realtime subscriptions
* Storage
* Server-side database operations

### Midtrans

Used for:

* Payment integration
* Sandbox payment testing
* Order/payment state transitions

The current pilot uses sandbox infrastructure rather than production payment processing.

---

## Auction Integrity

Critical auction operations are handled server-side rather than trusting the browser.

Important operations include:

```text
place_bid()
close_item()
```

The server validates:

* User authorization
* Auction state
* Bid amount
* Current highest bid
* Auction timer
* Extension limits
* Duplicate operations
* Rate limits

The browser is treated as an interface, not as the source of truth for auction state.

---

## Data Model

The current system is centered around several primary entities.

```text
profiles
   │
   ├── rooms
   │      │
   │      └── items
   │             │
   │             └── bids
   │
   └── orders
```

### Profiles

Stores user identity and account-related information.

### Rooms

Represents a live auction session.

A room can contain multiple auction items.

### Items

Represents individual products being auctioned.

### Bids

Stores bid activity associated with an item.

### Orders

Represents the resulting purchase after an auction is won.

### Chat Messages

Stores messages sent inside live auction rooms.

---

## Security Model

Sensitive operations follow a server-side authorization path:

```text
Browser
   ↓
Next.js Route Handler
   ↓
Authorization
   ↓
Validation
   ↓
Supabase Service Role
   ↓
PostgreSQL
```

The Supabase service-role key is never exposed to the browser.

Environment secrets are kept server-side.

The system also validates auction operations on the server to prevent clients from directly manipulating critical auction state.

---

## Tech Stack

### Frontend

| Technology     | Purpose               |
| -------------- | --------------------- |
| Next.js 16     | Application framework |
| React 19       | UI architecture       |
| TypeScript     | Static typing         |
| Tailwind CSS 4 | Styling               |
| Motion         | UI animation          |

### Backend / Infrastructure

| Technology       | Purpose                             |
| ---------------- | ----------------------------------- |
| Supabase         | Auth, PostgreSQL, Realtime, Storage |
| PostgreSQL       | Primary database                    |
| LiveKit          | Real-time video                     |
| Midtrans Sandbox | Payment integration                 |
| Vercel           | Deployment                          |

### Testing

| Technology    | Purpose               |
| ------------- | --------------------- |
| Vitest        | Automated testing     |
| TypeScript    | Static validation     |
| ESLint        | Code quality          |
| Next.js Build | Production validation |

---

## Internationalization

HOBYD supports:

```text
/id
/en
```

The interface is designed around a centralized localization system so that product copy and UI text can be maintained independently from presentation logic.

---

## Mobile-First UX

The interface is designed primarily around mobile usage.

Important interaction priorities include:

* Large bidding controls
* Clear auction state
* Persistent current bid
* Visible timer
* Fast room entry
* Minimal navigation
* Real-time chat
* Clear checkout state

The auction interface prioritizes information required during a live sale rather than presenting every possible feature simultaneously.

---

## Project Structure

```text
.
├── app/
│   ├── [locale]/
│   ├── api/
│   └── ...
│
├── components/
│   ├── auction/
│   ├── auth/
│   ├── chat/
│   ├── checkout/
│   ├── live/
│   ├── room/
│   └── ui/
│
├── lib/
│   ├── auction/
│   ├── auth/
│   ├── payments/
│   ├── supabase/
│   └── ...
│
├── supabase/
│   ├── migrations/
│   └── functions/
│
├── tests/
│
├── docs/
│
├── proposal/
│
├── AGENTS.md
├── package.json
├── next.config.ts
└── ...
```

---

## Environment Variables

Create a local environment file containing the required service credentials.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=

SELLER_ALLOWLIST=

MAX_SNIPING_EXTENSIONS=5
PAYMENT_WINDOW_SEC=300
EXTENSION_WINDOW_SEC=10
EXTENSION_ADD_SEC=10
```

### Important

The following variables must remain server-side:

```text
SUPABASE_SERVICE_ROLE_KEY
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
MIDTRANS_SERVER_KEY
```

Never expose them through client-side code or `NEXT_PUBLIC_*` variables.

---

## Getting Started

### Requirements

* Node.js
* npm
* Supabase project
* LiveKit project
* Midtrans Sandbox account

### Install

```bash
git clone https://github.com/masterdorime/hobyd-prototype.git

cd hobyd-prototype

npm install
```

Create your environment file:

```bash
cp .env.example .env.local
```

Fill in the required credentials.

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## Validation

Before creating a production build, run:

```bash
npx vitest run
```

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

```bash
npm run build
```

A successful validation should pass:

```text
Tests
  ↓
TypeScript
  ↓
Lint
  ↓
Production Build
```

---

## Payment Flow

The prototype uses Midtrans Sandbox for payment testing.

The general flow is:

```text
Auction Won
    ↓
Order Created
    ↓
Payment Window
    ↓
Midtrans
    ↓
Payment Confirmation
    ↓
Order Updated
```

The current pilot also contains QRIS-related fixtures/mock confirmation where required for testing the checkout experience.

Production payment infrastructure requires additional webhook verification, fraud handling, reconciliation, and operational monitoring.

---

## Deployment

The application can be deployed through Vercel.

General deployment flow:

```text
Git Repository
      ↓
Vercel
      ↓
Environment Variables
      ↓
Production Build
      ↓
Live Application
```

Required production configuration includes:

* Supabase credentials
* LiveKit credentials
* Midtrans credentials
* Production environment variables
* Midtrans webhook configuration
* Database migrations

---

## Current Limitations

HOBYD is currently a **pilot MVP / prototype**.

The implementation does not yet represent a production-scale marketplace.

Areas requiring further development include:

* Full seller verification
* Marketplace moderation
* Fraud detection
* Counterfeit detection
* Dispute resolution
* Advanced seller reputation
* Production payment reconciliation
* Background job infrastructure
* Advanced observability
* Large-scale realtime load testing
* Operational alerting
* Comprehensive abuse prevention
* Production-grade auction auditing

These are intentionally outside the current prototype scope.

---

## Product Principles

### 01 — Auction state belongs to the server

The browser should never be trusted as the source of truth for:

* Highest bid
* Auction status
* Winner
* Timer state
* Payment state

### 02 — Realtime should feel immediate

Bid updates, timer changes, chat, and room activity should propagate quickly enough to support live interaction.

### 03 — Complexity should stay underneath the interface

The underlying system may involve multiple services, realtime channels, database functions, and payment states.

The user-facing experience should remain simple.

### 04 — Build around collector behavior

The product is designed around the context in which collectors discover, evaluate, discuss, and purchase items.

### 05 — Prototype honestly

Features that are mocked, sandboxed, or incomplete should remain clearly separated from production-ready functionality.

---

## Roadmap

### Auction

* [x] Real-time bidding
* [x] Soft-close auction mode
* [x] Sudden-death auction mode
* [x] Maximum extension limits
* [x] Server-side bid validation
* [x] Server-side auction closing
* [ ] Advanced auction analytics
* [ ] Auction audit history

### Live Commerce

* [x] LiveKit integration
* [x] Live rooms
* [x] Room chat
* [x] Auction item management
* [ ] Multi-camera support
* [ ] Advanced stream moderation

### Marketplace

* [x] Order creation
* [x] Checkout flow
* [x] Payment sandbox
* [ ] Seller verification
* [ ] Buyer/seller reputation
* [ ] Dispute system
* [ ] Marketplace moderation
* [ ] Production payment reconciliation

### Infrastructure

* [x] Supabase
* [x] Server-side authorization
* [x] Database functions
* [x] Vercel deployment
* [ ] Background jobs
* [ ] Observability
* [ ] Production load testing
* [ ] Automated operational alerts

---

## Documentation

Additional project documentation is available inside:

```text
docs/
```

Setup information:

```text
docs/SETUP.md
```

Agent/development instructions:

```text
AGENTS.md
```

Product proposal material:

```text
proposal/
```

---

## Status

**Current status: Pilot MVP**

HOBYD is an actively developed prototype exploring the intersection of:

```text
Collectibles
    +
Live Commerce
    +
Real-Time Auctions
    +
Community
```

The current implementation prioritizes proving the core auction and live-room experience before expanding into the broader marketplace infrastructure.

---

## License

This repository is a prototype project.

Unless otherwise stated, the project's source code, branding, product assets, and original visual materials should not be redistributed or commercially reused without permission.

Third-party dependencies remain subject to their respective licenses.
