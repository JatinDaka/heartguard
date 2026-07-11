import type { ScanResult } from './index';

const HISTORY_KEY = 'heartguard_scan_history';
const MAX_ENTRIES = 100;

/** Persist raw ScanResult, serialising the Date to ISO string */
export function saveScanToHistory(result: ScanResult): void {
  const existing = loadScanHistory();
  const entry = { ...result, date: (result.date instanceof Date ? result.date : new Date(result.date)).toISOString() };
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

/** Load and deserialise saved scan results (date string → Date object) */
export function loadScanHistory(): ScanResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    return parsed.map(r => ({ ...r, date: new Date(r.date) }));
  } catch {
    return [];
  }
}

/** Clear all stored scan history */
export function clearScanHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
