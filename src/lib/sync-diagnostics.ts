import { appendFileSync } from 'node:fs';

const SYNC_DIAGNOSTICS_LOG_PATH = "K:\\Antigravity Projects\\Dayan App\\tmp\\sync-diagnostics.log";

export function appendSyncDiagnostic(message: string) {
  try {
    appendFileSync(SYNC_DIAGNOSTICS_LOG_PATH, message);
  } catch (error) {
    console.error("[sync-diagnostics] Failed to append log:", error);
  }
}

export function appendSyncTrace(label: string, payload: unknown) {
  appendSyncDiagnostic(`[TRACE] ${label}: ${JSON.stringify(payload)}\n`);
}

export function getSyncDiagnosticsLogPath() {
  return SYNC_DIAGNOSTICS_LOG_PATH;
}
