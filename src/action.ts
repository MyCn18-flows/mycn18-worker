import { FlowDocument } from './types';

// Usamos una variable global para cachear el cliente de Cloud Tasks una vez que se inicializa.
// Usamos 'any' para evitar el error de tipado antes de la importación dinámica.
let taskClient: any = null; 

// -------------------------------------------------------------------------
// CONFIGURACIÓN (Debe estar definida en las variables de entorno)
// -------------------------------------------------------------------------
const PROJECT_ID = process.env.CLOUD_TASKS_PROJECT_ID;
const LOCATION = process.env.CLOUD_TASKS_LOCATION; 
const QUEUE_NAME = process.env.CLOUD_TASKS_QUEUE_NAME; 
const ACTION_HANDLER_URL = process.env.CLOUD_RUN_ACTION_HANDLER_URL; 

if (!PROJECT_ID || !LOCATION || !QUEUE_NAME || !ACTION_HANDLER_URL) {
    console.error("CRITICAL: Cloud Tasks configuration is incomplete. Action dispatch will fail.");
}

// -------------------------------------------------------------------------
// FUNCIÓN ASÍNCRONA DE DESPACHO
// -------------------------------------------------------------------------

/**
 * Delega el envío del resultado del flujo a una cola de tareas (Google Cloud Tasks).
 * @param flow El documento de flujo completo.
 * @param result El resultado retornado por el script del usuario.
 * @returns El estado de la PUESTA EN COLA (asíncrona).
 */
export const dispatchActionAsynchronously = async (
    flow: FlowDocument, 
    result: unknown
): Promise<{ success: boolean, error?: string }> => {

    // Comprobación de configuración crítica
    if (!PROJECT_ID || !LOCATION || !QUEUE_NAME || !ACTION_HANDLER_URL) {
        return { success: false, error: "Cloud Tasks configuration is missing." };
    }
    
    // ** SOLUCIÓN AL ERROR TS1479: Inicialización dinámica **
    if (!taskClient) {
        try {
            // Importación dinámica asíncrona de la librería ESM
            const { CloudTasksClient } = await import('@google-cloud/tasks');
            taskClient = new CloudTasksClient();
            console.log("Cloud Tasks Client initialized dynamically.");
        } catch (error) {
            const initError = `Failed to dynamically initialize Cloud Tasks client: ${error}`;
            console.error(`[TASKS_ERROR] ${initError}`);
            return { success: false, error: initError };
        }
    }
    // ** FIN SOLUCIÓN **

    // Payload que se enviará al Action Handler (servicio de Cloud Run separado)
    const taskPayload = {
        flowId: flow.flowId,
        actionUrl: flow.actionUrl,
        userId: flow.userId,
        result: result,
    };
    
    // Ruta completa de la cola de tareas
    const parentPath = taskClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);

    const task: any = {
        parent: parentPath,
        task: {
            httpRequest: {
                httpMethod: 'POST',
                url: ACTION_HANDLER_URL, 
                // El cuerpo debe ser codificado en base64 para Cloud Tasks
                body: Buffer.from(JSON.stringify(taskPayload)).toString('base64'),
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        },
    };

    try {
        await taskClient.createTask(task);
        console.log(`[TASKS] Action for flow ${flow.flowId} successfully queued to ${QUEUE_NAME}.`); 
        return { success: true };
    } catch (error) {
        const errorMessage = `Failed to queue task: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[TASKS_ERROR] ${errorMessage}`);
        return { success: false, error: errorMessage };
    }
};

// Función obsoleta mantenida para compatibilidad de importaciones
export const sendActionWebhook = async (): Promise<any> => {
    console.warn("WARNING: sendActionWebhook is deprecated. The orchestrator should use dispatchActionAsynchronously.");
    return { success: false, error: "Deprecated function called." };
};