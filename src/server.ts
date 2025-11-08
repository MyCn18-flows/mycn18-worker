import { Hono } from 'hono';
import { executeUserScript } from './runtime'; 
import { FlowPayload, FlowSecrets, ExecutionResult, ExecutionLog, LogStatus } from './types'; 
import { getFlowDocument, logExecution } from './db'; 
import { dispatchActionAsynchronously, sendActionWebhook } from './action'; 
import { resolveUserSecrets } from './secrets';
import { logger } from './logger';

// --- Configuración del Servidor ---
const app = new Hono();
const PORT = process.env.PORT || 8080; 

// Middleware para logs estructurados
app.use('*', async (c, next) => {
    logger.info(`Request received`, { method: c.req.method, url: c.req.url });
    await next();
    logger.info(`Request completed`, { method: c.req.method, url: c.req.url, status: c.res.status });
});

// --- Endpoint Principal del Webhook ---
app.post('/api/webhook/:flowId', async (c) => {
    const startTime = performance.now(); 
    const flowId = c.req.param('flowId');

    let payload: FlowPayload;
    try {
        payload = await c.req.json();
    } catch (e: any) {
        logger.error('Failed to parse request body as JSON', e, { flowId });
        payload = {};
    }

    // --- Lógica de Orquestación: Cargar y Validar ---

    // --- Lógica de Orquestación: Cargar y Validar ---
    
    const flow = await getFlowDocument(flowId);
    let userId: string = flow ? flow.userId : 'unknown';

    if (!flow || !flow.isActive) {
        const message = `Flow ${flowId} not found, inactive, or DB connection failed.`;
        logger.warn(message, { flowId, userId });
        
        // Registrar el intento fallido (asíncronamente)
        logger.executionLog({
            flowId,
            userId,
            status: LogStatus.FAIL,
            durationMs: performance.now() - startTime,
            payload,
            error: message
        });

        return c.json({ status: 'rejected', flowId: flowId, message }, 404);
    }

    const { userCode, secretReferences } = flow; // Usar secretReferences
    
    // 1. Resolución de Secrets
    let resolvedSecrets: FlowSecrets;
    try {
        resolvedSecrets = await resolveUserSecrets(secretReferences); // Pasar secretReferences
    } catch (error: any) {
        logger.error(`Failed to resolve secrets for flow ${flowId}`, error, { flowId, userId });
        logger.executionLog({
            flowId,
            userId,
            status: LogStatus.FAIL,
            durationMs: performance.now() - startTime,
            payload,
            error: `Secret resolution failed: ${error.message}`
        });
        return c.json({ status: 'failed', flowId: flowId, message: `Secret resolution failed: ${error.message}` }, 500);
    }
    
    // 2. Inyección de Secrets
    const executionSecrets: FlowSecrets = { 
        ...resolvedSecrets, 
        FLOW_ID: flowId, 
    };

    // --- Ejecución en la Caja de Arena ---
    
    const executionResult: ExecutionResult = await executeUserScript(
        userCode,
        payload,
        executionSecrets
    );

    // --- Manejo de Éxito o Fracaso ---
    const durationMs = performance.now() - startTime;
    let finalStatus: ExecutionLog['status'] = executionResult.success ? LogStatus.SUCCESS : LogStatus.FAIL;

    
    if (executionResult.success) {
        // 3. Delegar la Acción de Salida a la Cola de Tareas (Desacoplamiento)
        const dispatchStatus = await dispatchActionAsynchronously(flow, executionResult.result); 
        
        if (!dispatchStatus.success) {
            finalStatus = LogStatus.ACTION_FAIL; 
            
            // Loguear el fallo de puesta en cola (asíncronamente)
            logger.error(`Action dispatch failed for flow ${flowId}`, new Error(dispatchStatus.error), { flowId, userId, result: executionResult.result });
            logger.executionLog({
                flowId,
                userId,
                status: finalStatus,
                durationMs,
                payload,
                result: executionResult.result,
                error: `Action Dispatch Error: ${dispatchStatus.error}`,
                actionStatus: 500, // Error interno de infraestructura
            });

            // Retornamos 500 ya que es un fallo de infraestructura
            return c.json({ 
                status: 'dispatch_failed', 
                flowId: flowId, 
                message: `Failed to queue action: ${dispatchStatus.error}` 
            }, 500); 
        }

        // Éxito completo (Script OK y Tarea Queued OK)
        // Loguear el éxito (asíncronamente)
        logger.executionLog({
            flowId,
            userId,
            status: LogStatus.SUCCESS, 
            durationMs,
            payload,
            result: executionResult.result,
            actionStatus: 202, // 202 Accepted por la cola
        });

        // Respuesta inmediata al cliente de Webhook con 202 Accepted
        return c.json({ 
            status: 'completed_and_dispatched', 
            flowId: flowId, 
            message: 'Script executed successfully. Action dispatched to task queue.',
            result: executionResult.result 
        }, 202); 
        
    } else {
        // El script falló 
        logger.error(`Execution failure for flow ${flowId}`, new Error(executionResult.error), { flowId, userId });
        
        if (executionResult.error.toLowerCase().includes('timeout')) {
            finalStatus = LogStatus.TIMEOUT;
        }
        
        // Loguear el fallo de ejecución (asíncronamente)
        logger.executionLog({
            flowId,
            userId,
            status: finalStatus,
            durationMs,
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

// --- Endpoint de Salud ---
// --- Endpoint de Salud ---
app.get('/health', (c) => c.text('OK', 200));

// --- Exportación del Handler ---
logger.info(`ScriptFlow Orchestrator initialized. Listening on port ${PORT}`);

export default {
    port: PORT,
    fetch: app.fetch,
};
