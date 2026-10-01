## Overview

**HOBYD = HOBBY + BID**

HOBYD is a live-auction marketplace prototype built for collectors and hobby communities.

It combines **real-time auctions, live video, community chat, bidding, and checkout** into one mobile-first experience.

**Live prototype:** https://hobyd-prototype.vercel.app

The project is built with:

* **Next.js 16** + **React 19** + **TypeScript**
* **Tailwind CSS 4** for the interface
* **Supabase** for authentication, PostgreSQL, Realtime, and storage
* **LiveKit** for real-time live video
* **Midtrans Sandbox** for payment integration
* **Vitest** for automated testing
* **Vercel** for deployment

### Core Experience

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

Rather than treating auctions as static listings, HOBYD is designed around the interaction that happens during a live sale: watching the seller, seeing items presented in context, communicating with the community, and participating in real-time bidding.

The current prototype focuses on **Pokemon TCG as the initial beachhead market**, while keeping the underlying architecture flexible enough to support other collectible categories.

### Technology at a Glance

| Layer          | Technology            |
| -------------- | --------------------- |
| Framework      | Next.js 16            |
| UI             | React 19              |
| Language       | TypeScript            |
| Styling        | Tailwind CSS 4        |
| Database       | PostgreSQL / Supabase |
| Authentication | Supabase Auth         |
| Realtime Data  | Supabase Realtime     |
| Live Video     | LiveKit               |
| Payments       | Midtrans Sandbox      |
| Testing        | Vitest                |
| Deployment     | Vercel                |

### Prototype

**Live:** https://hobyd-prototype.vercel.app

The prototype currently demonstrates the core live-auction experience, including auction rooms, realtime bidding, chat, auction timing, checkout, and the supporting seller/buyer flows.
