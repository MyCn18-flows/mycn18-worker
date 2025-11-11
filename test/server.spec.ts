import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { FlowDocument, FlowPayload, LogStatus } from '../src/types';

// Importamos las funciones reales. Vitest las reemplazará con las mocks.
// Usaremos estas referencias para obtener las versiones mockeadas con vi.mocked().
import { getFlowDocument, logExecution } from '../src/db';
import { dispatchActionAsynchronously } from '../src/action';
import { resolveUserSecrets } from '../src/secrets';
import { executeUserScript } from '../src/runtime';
import { logger } from '../src/logger';

// --- DEFINICIÓN DE MOCKS (FACTORY FUNCTIONS PARA EVITAR HOISTING) ---
// Definimos los mocks DENTRO de la función factory de vi.mock.
vi.mock('../src/db', () => ({
  getFlowDocument: vi.fn(),
  logExecution: vi.fn(),
}));
vi.mock('../src/action', () => ({
  dispatchActionAsynchronously: vi.fn(),
}));
vi.mock('../src/secrets', () => ({
  resolveUserSecrets: vi.fn(),
}));
vi.mock('../src/runtime', () => ({
  executeUserScript: vi.fn(),
}));
vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    executionLog: vi.fn(),
    initializeDatabaseLogging: vi.fn(), 
  },
}));

// Import the server after mocks are set up
import server, { initializeLogger } from '../src/server';


// --- REFERENCIAS MOCKEADAS (Usando vi.mocked() para rastreo) ---
// Se deben definir DESPUÉS de las importaciones y de los vi.mock().
// These will be initialized in beforeEach to avoid hoisting issues.
let mockedLogExecution: ReturnType<typeof vi.fn>;
let mockedGetFlowDocument: ReturnType<typeof vi.fn>;
let mockedDispatchActionAsynchronously: ReturnType<typeof vi.fn>;
let mockedExecuteUserScript: ReturnType<typeof vi.fn>;
let mockedResolveUserSecrets: ReturnType<typeof vi.fn>;
let mockedLoggerInfo: ReturnType<typeof vi.fn>;
let mockedLoggerWarn: ReturnType<typeof vi.fn>;
let mockedLoggerError: ReturnType<typeof vi.fn>;
let mockedLoggerExecutionLog: ReturnType<typeof vi.fn>;
let mockedLoggerInitializeDatabaseLogging: ReturnType<typeof vi.fn>;


describe('server', () => {
  const app = new Hono();
  
  // Use the exported fetch handler directly for testing
  app.post('/api/webhook/:flowId', async (c) => {
    const response = await server.fetch(c.req.raw);
    return response;
  });
  app.get('/health', async (c) => {
    const response = await server.fetch(c.req.raw);
    return response;
  });

  const mockFlow: FlowDocument = {
    flowId: 'testFlow123',
    userId: 'user123',
    flowName: 'Test Flow Name', // Added flowName
    isActive: true,
    userCode: 'return "hello";',
    secretReferences: { API_KEY: 'projects/1/secrets/my-api-key/versions/latest' },
    actionUrl: 'https://example.com/action',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Initialize mocked references inside beforeEach to avoid hoisting issues
    // and get the actual mock instances from the hoisted vi.mock calls.
    mockedGetFlowDocument = vi.mocked(getFlowDocument);
    mockedLogExecution = vi.mocked(logExecution);
    mockedDispatchActionAsynchronously = vi.mocked(dispatchActionAsynchronously);
    mockedResolveUserSecrets = vi.mocked(resolveUserSecrets);
    mockedExecuteUserScript = vi.mocked(executeUserScript);
    
    mockedLoggerInfo = vi.mocked(logger).info;
    mockedLoggerWarn = vi.mocked(logger).warn;
    mockedLoggerError = vi.mocked(logger).error;
    mockedLoggerExecutionLog = vi.mocked(logger).executionLog;
    mockedLoggerInitializeDatabaseLogging = vi.mocked(logger).initializeDatabaseLogging;

    // Limpiar las referencias mockeadas de las dependencias clave
    mockedLogExecution.mockClear(); 
    mockedGetFlowDocument.mockClear();
    mockedDispatchActionAsynchronously.mockClear();
    mockedResolveUserSecrets.mockClear();
    mockedExecuteUserScript.mockClear();
    mockedLoggerInfo.mockClear();
    mockedLoggerWarn.mockClear();
    mockedLoggerError.mockClear();
    mockedLoggerExecutionLog.mockClear();
    
    // Call the explicit initialization function
    initializeLogger();
    
    // Default mock implementations
    mockedLogExecution.mockResolvedValue(undefined); 
    mockedGetFlowDocument.mockResolvedValue(mockFlow);
    mockedResolveUserSecrets.mockResolvedValue({ API_KEY: 'resolved_api_key', FLOW_ID: 'testFlow123' });
    mockedExecuteUserScript.mockResolvedValue({ success: true, result: 'script_result' });
    mockedDispatchActionAsynchronously.mockResolvedValue({ success: true });
  });

  it('should initialize database logging on server start', () => {
    // This test assumes initializeLogger is called in beforeEach
    expect(mockedLoggerInitializeDatabaseLogging).toHaveBeenCalledTimes(1);
    expect(mockedLoggerInitializeDatabaseLogging).toHaveBeenCalledWith(logExecution);
  });

  it('should return 400 if request body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/webhook/testFlow123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json', // Invalid JSON
    });
    const res = await app.request(req);

    expect(res.status).toBe(400); // Bad Request
    const body = await res.json();
    expect(body.status).toBe('rejected');
    expect(body.message).toContain('Failed to parse request body');
    expect(mockedLoggerError).toHaveBeenCalledWith(
      'Failed to parse request body as JSON',
      expect.any(Error),
      expect.objectContaining({ flowId: 'testFlow123' })
    );
      expect(mockedLoggerExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: 'testFlow123',
          userId: 'unknown', // Ensure userId is 'unknown' for this case
          flowName: 'unknown', // Added flowName
          status: LogStatus.FAIL,
          error: expect.stringContaining('Failed to parse request body'),
        })
      );
  });

  it('should return 404 if flow is not found or inactive', async () => {
    mockedGetFlowDocument.mockResolvedValue(null);

    const req = new Request('http://localhost/api/webhook/nonExistentFlow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.request(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.status).toBe('rejected');
      expect(mockedLoggerExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: 'nonExistentFlow',
          userId: 'unknown', // Ensure userId is 'unknown' for this case
          flowName: 'unknown', // Added flowName
          status: LogStatus.FAIL,
          error: expect.stringContaining('not found'),
        })
      );
  });

  it('should execute user script and dispatch action on success', async () => {
    const testPayload: FlowPayload = { data: 'some_data' };
    const req = new Request('http://localhost/api/webhook/testFlow123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });
    const res = await app.request(req);

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe('completed_and_dispatched');
    expect(body.result).toBe('script_result');

    expect(mockedGetFlowDocument).toHaveBeenCalledWith('testFlow123');
    expect(mockedResolveUserSecrets).toHaveBeenCalledWith(mockFlow.secretReferences);
    expect(mockedExecuteUserScript).toHaveBeenCalledWith(
      mockFlow.userCode,
      testPayload,
      expect.objectContaining({ API_KEY: 'resolved_api_key', FLOW_ID: 'testFlow123' })
    );
    expect(mockedDispatchActionAsynchronously).toHaveBeenCalledWith(mockFlow, 'script_result');
    expect(mockedLoggerExecutionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        flowId: 'testFlow123',
        userId: 'user123',
        flowName: mockFlow.flowName, // Added flowName
        status: LogStatus.SUCCESS,
        result: 'script_result',
        actionStatus: 202,
      })
    );
  });

  it('should return 500 if secret resolution fails', async () => {
    mockedResolveUserSecrets.mockRejectedValue(new Error('Secret resolution failed'));

    const req = new Request('http://localhost/api/webhook/testFlow123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.request(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.message).toContain('Secret resolution failed');
      expect(mockedLoggerExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: 'testFlow123',
          userId: 'user123',
          flowName: mockFlow.flowName, // Added flowName
          status: LogStatus.FAIL,
          error: expect.stringContaining('Secret resolution failed'),
        })
      );
  });

  it('should return 500 if user script fails', async () => {
    mockedExecuteUserScript.mockResolvedValue({ success: false, error: 'Script failed' });

    const req = new Request('http://localhost/api/webhook/testFlow123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.request(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('failed');
    expect(body.message).toContain('Script failed');
      expect(mockedLoggerExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: 'testFlow123',
          userId: 'user123',
          flowName: mockFlow.flowName, // Added flowName
          status: LogStatus.FAIL,
          error: 'Script failed',
        })
      );
  });

  it('should return 500 if action dispatch fails', async () => {
    mockedDispatchActionAsynchronously.mockResolvedValue({ success: false, error: 'Dispatch error' });

    const req = new Request('http://localhost/api/webhook/testFlow123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await app.request(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.status).toBe('dispatch_failed');
    expect(body.message).toContain('Dispatch error');
      expect(mockedLoggerExecutionLog).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: 'testFlow123',
          userId: 'user123',
          flowName: mockFlow.flowName, // Added flowName
          status: LogStatus.ACTION_FAIL,
          error: expect.stringContaining('Dispatch error'),
          actionStatus: 500,
        })
      );
  });

  it('/health endpoint should return OK', async () => {
    const req = new Request('http://localhost/health');
    const res = await app.request(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('OK');
  });

  it('should log request and response info', async () => {
    const testPayload: FlowPayload = { data: 'some_data' };
    const req = new Request('http://localhost/api/webhook/testFlow123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });
    await app.request(req);

    expect(mockedLoggerInfo).toHaveBeenCalledWith(
      'Request received',
      expect.objectContaining({ method: 'POST', url: 'http://localhost/api/webhook/testFlow123' })
    );
    expect(mockedLoggerInfo).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({ method: 'POST', url: 'http://localhost/api/webhook/testFlow123', status: 202 })
    );
  });
});
