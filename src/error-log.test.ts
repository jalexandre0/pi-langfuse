import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logLangfuseError } from './error-log.js';

const TEST_LOG_DIR = path.join(os.tmpdir(), 'pi-langfuse-test-logs');
const TEST_LOG_FILE = path.join(TEST_LOG_DIR, 'langfuse-errors.jsonl');

describe('error-log', () => {
    beforeEach(() => {
        // Clean up before each test
        if (fs.existsSync(TEST_LOG_FILE)) {
            fs.unlinkSync(TEST_LOG_FILE);
        }
        if (fs.existsSync(TEST_LOG_DIR)) {
            fs.rmdirSync(TEST_LOG_DIR);
        }
    });

    it('should write error record to disk', () => {
        const config = { host: 'http://test.com' };
        const error = new Error('Test Error');
        
        logLangfuseError(config, error, { traceId: 'trace-1', turnIndex: 1 }, TEST_LOG_DIR);

        expect(fs.existsSync(TEST_LOG_FILE)).toBe(true);
        const content = fs.readFileSync(TEST_LOG_FILE, 'utf-8');
        const record = JSON.parse(content.trim());
        
        expect(record.timestamp).toBeDefined();
        expect(record.errorMessage).toBe('Test Error');
        expect(record.traceId).toBe('trace-1');
        expect(record.turnIndex).toBe(1);
    });

    it('should handle errors without traceId', () => {
        const config = { host: 'http://test.com' };
        const error = new Error('Test Error 2');
        
        logLangfuseError(config, error, {}, TEST_LOG_DIR);

        const content = fs.readFileSync(TEST_LOG_FILE, 'utf-8');
        const record = JSON.parse(content.trim());
        
        expect(record.traceId).toBeUndefined();
        expect(record.errorMessage).toBe('Test Error 2');
    });

    it('should truncate payload snippet', () => {
        const config = { host: 'http://test.com' };
        const error = new Error('Payload Error');
        const largePayload = { data: 'x'.repeat(10000) };
        
        logLangfuseError(config, error, { payload: largePayload }, TEST_LOG_DIR);

        const content = fs.readFileSync(TEST_LOG_FILE, 'utf-8');
        const record = JSON.parse(content.trim());
        
        // Should be around 500 chars
        expect(record.payloadSnippet.length).toBeLessThanOrEqual(550);
    });

    afterEach(() => {
        // Clean up after tests
        if (fs.existsSync(TEST_LOG_FILE)) {
            fs.unlinkSync(TEST_LOG_FILE);
        }
        if (fs.existsSync(TEST_LOG_DIR)) {
            fs.rmdirSync(TEST_LOG_DIR);
        }
    });
});
