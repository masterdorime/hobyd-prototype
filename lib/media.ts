// lib/media.ts — camera/mic failure classification (pure, tested).
// getUserMedia-style errors carry a `name`; the UI maps each class to its
// own hint instead of blaming permissions for missing/busy hardware.
export type MediaFailure = "blocked" | "nodevice" | "inuse";

export function classifyMediaError(err: unknown): MediaFailure {
  const name =
    err instanceof DOMException
      ? err.name
      : typeof err === "object" && err !== null
        ? (err as { name?: unknown }).name
        : undefined;
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "nodevice";
  if (name === "NotReadableError" || name === "AbortError") return "inuse";
  return "blocked";
}
