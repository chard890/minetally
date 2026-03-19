import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const SYNC_DIAGNOSTICS_LOG_PATH = process.env.NODE_ENV === 'production'
  ? join(tmpdir(), 'sync-diagnostics.log')
  : join(process.cwd(), 'tmp', 'sync-diagnostics.log');

function ensureLogDirectory() {
  try {
    mkdirSync(dirname(SYNC_DIAGNOSTICS_LOG_PATH), { recursive: true });
  } catch {
    // Ignore directory creation failures and let append attempt report the issue.
  }
}

export function appendSyncDiagnostic(message: string) {
  try {
    ensureLogDirectory();
    appendFileSync(SYNC_DIAGNOSTICS_LOG_PATH, message);
  } catch (error) {
    console.error("[sync-diagnostics]", message.trim(), error);
  }
}

export function appendSyncTrace(label: string, payload: unknown) {
  appendSyncDiagnostic(`[TRACE] ${label}: ${JSON.stringify(payload)}\n`);
}

export function getSyncDiagnosticsLogPath() {
  return SYNC_DIAGNOSTICS_LOG_PATH;
}
