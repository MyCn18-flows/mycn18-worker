import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowDocument } from '../src/types';
import { logger } from '../src/logger';
import { Queue } from 'bullmq'; // Import for type information and vi.mocked
import IORedis from 'ioredis'; // Import for type information and vi.mocked

// Mock the logger
vi.mock('../src/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        executionLog: vi.fn(),
        initializeDatabaseLogging: vi.fn(),
    },
}));

// Define mock functions at the top level of the test file
const mockedQueueAdd = vi.fn();
class MockQueue {
    constructor() {}
    add = mockedQueueAdd;
}

class MockIORedis {
    constructor() {}
    // Add any methods that BullMQ might call on the connection object
}

// Mock BullMQ
vi.mock('bullmq', () => ({
    Queue: vi.fn(() => new MockQueue()),
}));

// Mock ioredis
vi.mock('ioredis', () => ({
    default: vi.fn(() => new MockIORedis()),
}));

// Import the actual function to be tested
import { dispatchActionAsynchronously } from '../src/action';


describe('action module functions', () => {
    let mockedLoggerError: ReturnType<typeof vi.fn>;

    const mockFlow: FlowDocument = {
        flowId: 'testFlow123',
        userId: 'user123',
        flowName: 'Test Flow',
        isActive: true,
        userCode: 'return "hello";',
        secretReferences: {},
        actionUrl: 'https://example.com/action',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const mockResult = { status: 'success', data: 'processed' };

    beforeEach(() => {
        vi.clearAllMocks();

        process.env.REDIS_CONNECTION_URL = 'redis://localhost:6379';

        // Clear mocks for constructors and their methods
        vi.mocked(Queue).mockClear(); // Clear the Queue constructor mock
        vi.mocked(IORedis).mockClear(); // Clear the IORedis constructor mock
        mockedQueueAdd.mockClear();

        // Reset mock implementations for each test
        mockedQueueAdd.mockResolvedValue(undefined);

        mockedLoggerError = vi.mocked(logger).error;
    });

    it('should successfully dispatch an action to BullMQ', async () => {
        const result = await dispatchActionAsynchronously(mockFlow, mockResult);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        expect(vi.mocked(IORedis)).toHaveBeenCalledTimes(1); // Check IORedis constructor call
        expect(mockedQueueAdd).toHaveBeenCalledTimes(1);
        expect(mockedQueueAdd).toHaveBeenCalledWith('dispatch-action', expect.objectContaining({
            flowId: mockFlow.flowId,
            actionUrl: mockFlow.actionUrl,
            userId: mockFlow.userId,
            result: mockResult,
        }), expect.any(Object));
    });

    it('should return success: false and log an error if dispatch fails', async () => {
        mockedQueueAdd.mockRejectedValueOnce(new Error('BullMQ add failed'));

        const result = await dispatchActionAsynchronously(mockFlow, mockResult);

        expect(result.success).toBe(false);
        expect(result.error).toContain('BullMQ add failed');
        expect(vi.mocked(IORedis)).toHaveBeenCalledTimes(1); // Check IORedis constructor call
        expect(mockedQueueAdd).toHaveBeenCalledTimes(1);
        expect(mockedLoggerError).toHaveBeenCalledWith(
            expect.stringContaining('BullMQ add failed'),
            expect.any(Error)
        );
    });
});
