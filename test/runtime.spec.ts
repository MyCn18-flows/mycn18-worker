import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeUserScript } from '../src/runtime';
import { logger } from '../src/logger';

// Mock the logger to capture output
vi.mock('../src/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        executionLog: vi.fn(),
        initializeDatabaseLogging: vi.fn(),
    },
}));

describe('executeUserScript', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should execute user code successfully and return a result', async () => {
        const userCode = 'return payload.value + env.SECRET_KEY;';
        const payload = { value: 10 };
        const secrets = { SECRET_KEY: 'abc' };
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe('10abc');
        }
    });

    it('should handle async user code', { timeout: 1000 }, async () => {
        const userCode = 'await new Promise(resolve => setTimeout(resolve, 100)); return "async_done";';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe('async_done');
        }
    });

    it('should return an error for invalid user code (syntax error)', async () => {
        const userCode = 'return (1 + 2'; 
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toMatch(/SyntaxError|Unexpected/);
        }
    });

    it('should return an error for timeout', { timeout: 6000 }, async () => {
        const userCode = 'while(true) {}'; // Infinite loop
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('Script execution timed out');
        }
    });

    it('should allow requiring whitelisted community modules (e.g., lodash)', async () => {
        const userCode = 'const _ = require("lodash"); return _.isString("hello");';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe(true);
        }
    });

    it('should allow requiring user-injected modules', async () => {
        const userCode = 'const myUtils = require("my-utils"); return myUtils.add(2, 3);';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {
            'my-utils': {
                add: (a: number, b: number) => a + b,
                subtract: (a: number, b: number) => a - b,
            },
        };

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe(5);
        }
    });

    it('should prevent requiring non-whitelisted or non-injected modules', async () => {
        const userCode = 'require("fs");'; // Forbidden module
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain("Module 'fs' is not allowed or not found.");
        }
    });

    it('should allow access to safeHttpClient for HTTP requests', async () => {
        const userCode = 'return typeof http.get;';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe('function');
        }
    });

    it('should not allow access to process object', async () => {
        const userCode = 'return process.env;';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toContain('process is not defined');
        }
    });

    it('should use the sandboxed logger for console output', async () => {
        const userCode = 'console.info("Test log from sandbox"); return "logged";';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        expect(logger.info).toHaveBeenCalledWith('[USER_SCRIPT] Test log from sandbox', undefined);
    });

    it('should prevent access to global objects like window or document', async () => {
        const userCode = 'return typeof window;';
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe('undefined');
        }

        const userCode2 = 'return typeof document;';
        const result2 = await executeUserScript(userCode2, payload, secrets, userModulesToInject);
        expect(result2.success).toBe(true);
        if (result2.success) {
            expect(result2.result).toBe('undefined');
        }
    });

    it('should prevent prototype pollution attempts', async () => {
        const userCode = `
            Object.prototype.polluted = "I am polluted";
            return {}.polluted;
        `;
        const payload = {};
        const secrets = {};
        const userModulesToInject = {};

        const result = await executeUserScript(userCode, payload, secrets, userModulesToInject);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.result).toBe('I am polluted');
        }

        expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
        expect(Object.getOwnPropertyDescriptor(Object.prototype, 'polluted')).toBeUndefined();
    });
});
