import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowDocument, ExecutionLog, LogStatus } from '../src/types';
import { logger } from '../src/logger';
import { Client } from 'pg'; // Keep import for type information

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
const mockConnect = vi.fn();
const mockQuery = vi.fn();
const mockEnd = vi.fn();

// Mock the 'pg' module
vi.mock('pg', () => {
    // Define MockClient as a class to properly mock a constructor
    class MockClient {
        constructor() {
            // No-op constructor for the mock
        }
        connect = mockConnect;
        query = mockQuery;
        end = mockEnd;
    }

    return {
        Client: MockClient, // Return the MockClient class directly
    };
});

// Import the actual functions to be tested
import { getFlowDocument, logExecution } from '../src/db';


describe('db module functions', () => {
    let mockedLoggerError: ReturnType<typeof vi.fn>;

    const mockFlow: FlowDocument = {
        flowId: 'testFlow123',
        userId: 'user123',
        flowName: 'Test Flow',
        isActive: true,
        userCode: 'return "hello";',
        secretReferences: { API_KEY: 'resolved_api_key' },
        actionUrl: 'https://example.com/action',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        vi.clearAllMocks();

        process.env.DATABASE_URL = 'postgresql://user:password@host:port/database';

        // Clear mocks for the top-level functions
        mockConnect.mockClear();
        mockQuery.mockClear();
        mockEnd.mockClear();

        // Reset mock implementations for each test
        mockConnect.mockResolvedValue(undefined);
        mockEnd.mockResolvedValue(undefined);
        mockQuery.mockResolvedValue({ rows: [] });
        
        mockedLoggerError = vi.mocked(logger).error;
    });

    describe('getFlowDocument', () => {
        it('should return a FlowDocument if found and active', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    userId: mockFlow.userId,
                    flowId: mockFlow.flowId,
                    flowName: mockFlow.flowName,
                    isActive: mockFlow.isActive,
                    userCode: mockFlow.userCode,
                    secretReferences: mockFlow.secretReferences,
                    actionUrl: mockFlow.actionUrl,
                    createdAt: mockFlow.createdAt.toISOString(),
                    updatedAt: mockFlow.updatedAt.toISOString(),
                }],
            });

            const result = await getFlowDocument('testFlow123');

            expect(mockConnect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
                text: 'SELECT * FROM flows WHERE "flowId" = $1 AND "isActive" = true',
                values: ['testFlow123'],
            }));
            expect(mockEnd).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockFlow);
        });

        it('should return null if flow is not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const result = await getFlowDocument('nonExistentFlow');

            expect(mockConnect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockEnd).toHaveBeenCalledTimes(1);
            expect(result).toBeNull();
        });

        it('should log an error and return null if fetching flow fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB fetch error'));

            const result = await getFlowDocument('testFlow123');

            expect(mockConnect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockEnd).toHaveBeenCalledTimes(1);
            expect(mockedLoggerError).toHaveBeenCalledWith(
                expect.stringContaining('DB fetch error'),
                expect.any(Error),
                expect.objectContaining({ flowId: 'testFlow123' })
            );
            expect(result).toBeNull();
        });
    });

    describe('logExecution', () => {
        const mockLog: ExecutionLog = {
            flowId: 'logFlow123',
            userId: 'logUser123',
            flowName: 'Test Log Flow',
            status: LogStatus.SUCCESS,
            durationMs: 100,
            timestamp: new Date(),
            payload: { key: 'value' },
            result: 'script_output',
            error: undefined,
            actionStatus: 200,
        };

        it('should successfully log an execution', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] }); // Successful insert

            await logExecution(mockLog);

            expect(mockConnect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
                text: 'INSERT INTO execution_logs',
                values: [
                    mockLog.flowId,
                    mockLog.userId,
                    mockLog.flowName,
                    mockLog.status,
                    mockLog.durationMs,
                    mockLog.timestamp,
                    mockLog.payload,
                    mockLog.result,
                    mockLog.error,
                    mockLog.actionStatus,
                ],
            }));
            expect(mockEnd).toHaveBeenCalledTimes(1);
        });

        it('should log a critical error if logging fails', async () => {
            mockQuery.mockRejectedValueOnce(new Error('Log save error'));

            await logExecution(mockLog);

            expect(mockConnect).toHaveBeenCalledTimes(1);
            expect(mockQuery).toHaveBeenCalledTimes(1);
            expect(mockEnd).toHaveBeenCalledTimes(1);
            expect(mockedLoggerError).toHaveBeenCalledWith(
                expect.stringContaining('Log save error'),
                expect.any(Error),
                expect.objectContaining({ flowId: mockLog.flowId })
            );
        });
    });
});
