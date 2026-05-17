// error-log.ts
// A fail-close mitigation: logs errors to disk when Langfuse tracing fails.
// This ensures errors are recorded, searchable, and not lost.

import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_ERROR_LOG_DIR = path.join(os.homedir(), '.pi', 'agent', 'sessions');
const ERROR_LOG_FILE_NAME = 'langfuse-errors.jsonl';
const MAX_LOG_LINES = 1000; // Keep last 1000 errors

interface LangfuseErrorRecord {
    timestamp: string;
    traceId?: string;
    turnIndex?: number;
    errorMessage: string;
    payloadSnippet?: string;
}

export function logLangfuseError(
    config: { host: string }, 
    error: unknown, 
    context: { traceId?: string; turnIndex?: number; payload?: unknown },
    logDir?: string // Optional: for testing
) {
    try {
        const targetDir = logDir || DEFAULT_ERROR_LOG_DIR;
        const logFile = path.join(targetDir, ERROR_LOG_FILE_NAME);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const record: LangfuseErrorRecord = {
            timestamp: new Date().toISOString(),
            traceId: context.traceId,
            turnIndex: context.turnIndex,
            errorMessage: error instanceof Error ? error.message : String(error),
            payloadSnippet: context.payload ? JSON.stringify(context.payload).substring(0, 500) : undefined
        };

        // Append to JSONL
        fs.appendFileSync(logFile, JSON.stringify(record) + '\n');

        // Simple rotation: keep last MAX_LOG_LINES
        const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
        if (lines.length > MAX_LOG_LINES) {
            const trimmed = lines.slice(-MAX_LOG_LINES).join('\n') + '\n';
            fs.writeFileSync(logFile, trimmed);
        }

    } catch (e) {
        // Absolute fail-open: if we can't even write to disk, warn in console
        console.error("Langfuse: CRITICAL - Failed to write error log", e);
    }
}
