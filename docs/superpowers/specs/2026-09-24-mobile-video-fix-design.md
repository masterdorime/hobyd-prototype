# Mobile→mobile black video + landscape full-bleed — design spec (2026-09-24)

## Symptoms (live-fire, two phones)
- Mobile streamer → mobile viewer: everything works **except video**
  (chat, countdown, viewer count, item card all live). Desktop→mobile and
  mobile→desktop are fine.
- Mobile viewer of a landscape desktop stream: video pinned to a top strip
  with a dead black void below, top edge sliding under browser chrome.

## Analysis
Signaling is proven healthy (join + Realtime all work), so the fault is in
the media: the mobile publisher captured at up to 1080p (the SDK default),
which some subscribing phones cannot decode — desktops power through, hence
the exact device matrix observed.

## Changes
1. **Publish capped at 720p** (`VideoPresets.h720` in `createLocalVideoTrack`).
   Plenty for live-shopping cards; any phone can decode it.
2. **Stream diagnostics** (`?debug=1`): `LiveVideo onEvent` plumbing reports
   publisher capture settings (`WxH@fps`, facing) and subscriber events
   (`subscribed`, remote mute/unmute, `first-frame WxH`, join counts) to a
   small fixed readout. Invisible unless the query flag is set. If black
   video persists after the cap, one repro with this on pinpoints the layer.
3. **Full-bleed mobile viewer** (`bleed` prop): the viewer frame goes
   `h-full w-full object-cover` inside the fixed full-screen box — landscape
   fills edge-to-edge (sides cropped, TikTok-style), killing both the black
   void and the chrome overlap. Portrait streams already behaved this way.
4. **Double-audio guard** (`audioMuted` prop): the background viewer instance
   mutes its attached remote audio while the fullscreen overlay plays.

## Invariants
- Desktop, theater, publisher flow, and all topics untouched.
- No new env, tables, columns, or routes.
