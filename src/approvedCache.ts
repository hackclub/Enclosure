// Tiny client-side cache for the approved-projects list.
//
// Stale-while-revalidate: components render the cached list instantly (no
// spinner) on repeat visits, then fetch fresh in the background and update.
// Paired with the CDN Cache-Control on /api/approved, the network round-trip is
// usually fast anyway — this just removes the perceived wait on navigation.

const CACHE_KEY = "enclosure:approved-projects:v1";

export function getCachedApproved<T = any>(): T[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.projects) ? parsed.projects : null;
  } catch {
    return null;
  }
}

export function setCachedApproved(projects: any[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), projects }));
  } catch {
    // ignore quota / disabled storage
  }
}
