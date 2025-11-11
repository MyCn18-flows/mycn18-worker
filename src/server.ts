import { Hono } from 'hono';
import { FlowPayload, FlowSecrets, ExecutionResult, ExecutionLog, LogStatus } from './types.js'; 
import { dispatchActionAsynchronously } from './action.js'; 
import { resolveUserSecrets } from './secrets.js';
import { executeUserScript } from './runtime.js'; 
import { getFlowDocument, logExecution } from './db.js'; 
import { logger } from './logger.js';

const app = new Hono();
const PORT = process.env.PORT || 8080; 

export function initializeLogger() {
    logger.initializeDatabaseLogging(logExecution);
}

app.use('*', async (c, next) => {
    logger.info(`Request received`, { method: c.req.method, url: c.req.url });
    await next();
    logger.info(`Request completed`, { method: c.req.method, url: c.req.url, status: c.res.status });
});

app.post('/api/webhook/:flowId', async (c) => {
    const startTime = performance.now(); 
    const flowId = c.req.param('flowId');
    let userId: string = 'unknown';

    let payload: FlowPayload;
    try {
        payload = (await c.req.json()) as FlowPayload;
    } catch (e: unknown) {
        logger.error('Failed to parse request body as JSON', e, { flowId });
        payload = {};
        logger.executionLog({
            flowId,
            userId,
            flowName: 'unknown',
            status: LogStatus.FAIL,
            durationMs: performance.now() - startTime,
            timestamp: new Date(),
            payload: {},
            error: `Failed to parse request body as JSON: ${e instanceof Error ? e.message : String(e)}`
        });
        return c.json({ status: 'rejected', flowId: flowId, message: `Failed to parse request body: ${e instanceof Error ? e.message : String(e)}` }, 400);
    }
    
    const flow = await getFlowDocument(flowId);
    userId = flow ? flow.userId : 'unknown';

    if (!flow || !flow.isActive) {
        const message = `Flow ${flowId} not found, inactive, or DB connection failed.`;

        logger.executionLog({
            flowId,
            userId,
            flowName: flow?.flowName || 'unknown',
            status: LogStatus.FAIL,
            durationMs: performance.now() - startTime,
            timestamp: new Date(),
            payload,
            error: message
        });

        return c.json({ status: 'rejected', flowId: flowId, message }, 404);
    }

    const { userCode, secretReferences, flowName } = flow;
    
    let resolvedSecrets: FlowSecrets;
    try {
        resolvedSecrets = await resolveUserSecrets(secretReferences);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.executionLog({
            flowId,
            userId,
            flowName,
            status: LogStatus.FAIL,
            durationMs: performance.now() - startTime,
            timestamp: new Date(),
            payload,
            error: `Secret resolution failed: ${errorMessage}`
        });
        return c.json({ status: 'failed', flowId: flowId, message: `Secret resolution failed: ${errorMessage}` }, 500);
    }
    
    const executionSecrets: FlowSecrets = { 
        ...resolvedSecrets, 
        FLOW_ID: flowId, 
    };
    
    const executionResult: ExecutionResult = await executeUserScript(
        userCode,
        payload,
        executionSecrets,
        {}
    );

    const durationMs = performance.now() - startTime;
    let finalStatus: ExecutionLog['status'] = executionResult.success ? LogStatus.SUCCESS : LogStatus.FAIL;

    
    if (executionResult.success) {
        const dispatchStatus = await dispatchActionAsynchronously(flow, executionResult.result); 
        
        if (!dispatchStatus.success) {
            finalStatus = LogStatus.ACTION_FAIL; 
            
            logger.error(`Action dispatch failed for flow ${flowId}`, new Error(dispatchStatus.error), { flowId, userId, flowName, result: executionResult.result });
            
            logger.executionLog({
                flowId,
                userId,
                flowName,
                status: finalStatus,
                durationMs,
                timestamp: new Date(),
                payload,
                result: executionResult.result,
                error: `Action Dispatch Error: ${dispatchStatus.error}`,
                actionStatus: 500,
            });

            return c.json({ 
                status: 'dispatch_failed', 
                flowId: flowId, 
                message: `Failed to queue action: ${dispatchStatus.error}` 
            }, 500); 
        }

        logger.executionLog({
            flowId,
            userId,
            flowName,
            status: LogStatus.SUCCESS, 
            durationMs,
            timestamp: new Date(),
            payload,
            result: executionResult.result,
            actionStatus: 202,
        });

        return c.json({ 
            status: 'completed_and_dispatched', 
            flowId: flowId, 
            message: 'Script executed successfully. Action dispatched to task queue.',
            result: executionResult.result 
        }, 202); 
        
    } else {
        logger.error(`Execution failure for flow ${flowId}`, new Error(executionResult.error), { flowId, userId, flowName });
        
        if (executionResult.error.toLowerCase().includes('timeout')) {
            finalStatus = LogStatus.TIMEOUT;
        }
        
        logger.executionLog({
            flowId,
            userId,
            flowName,
            status: finalStatus,
            durationMs,
            timestamp: new Date(),
            payload,
            error: executionResult.error
        });

        return c.json({ 
            status: 'failed', 
            flowId: flowId,
            message: `Execution Error: ${executionResult.error}`
        }, 500); 
    }
});

app.get('/health', (c) => c.text('OK', 200));

logger.info(`MyCn18 Orchestrator initialized. Listening on port ${PORT}`);

export default {
    port: PORT,
    fetch: app.fetch,
};
