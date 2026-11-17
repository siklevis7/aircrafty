// Safe localStorage wrapper: storage can be unavailable (private mode, blocked).
const PREFIX = 'aircrafty:';

export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

/** Tracks which parts a student has opened, per aircraft. */
export function createProgress(aircraftId) {
  const key = `${aircraftId}:explored`;
  const seen = new Set(store.get(key, []));
  return {
    has: (id) => seen.has(id),
    add(id) {
      if (seen.has(id)) return false;
      seen.add(id);
      store.set(key, [...seen]);
      return true;
    },
    count: () => seen.size,
    reset() { seen.clear(); store.set(key, []); },
  };
}
