import { Queue } from 'bullmq';
import * as IORedis from 'ioredis';
import { logger } from './logger.js';
import { FlowDocument } from './types.js';

// -------------------------------------------------------------------------
// CONFIGURACIÓN
// -------------------------------------------------------------------------

// REDIS_CONNECTION_URL and QUEUE_NAME will be read when initializeQueue is called
const QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'flow-actions'; // Keep QUEUE_NAME here as it's used in Queue constructor

// -------------------------------------------------------------------------
// INICIALIZACIÓN DE LA COLA
// -------------------------------------------------------------------------

let actionQueue: Queue | null = null;

/**
 * Inicializa la cola de BullMQ.
 * Se reutiliza la instancia de la cola si ya ha sido creada.
 * @returns La instancia de la cola de BullMQ.
 */
const initializeQueue = (): Queue => {
    if (actionQueue) {
        return actionQueue;
    }

    const REDIS_CONNECTION_URL = process.env.REDIS_CONNECTION_URL;
    if (!REDIS_CONNECTION_URL) {
        const errorMessage = "REDIS_CONNECTION_URL is not defined. Cannot initialize BullMQ queue.";
        logger.error(`CRITICAL: ${errorMessage}`);
        throw new Error(errorMessage);
    }

    try {
        // Se crea una instancia de IORedis para la conexión.
        // El `default` es necesario por la interoperabilidad entre ES Modules y CommonJS.
        const connection = new (IORedis as any).default(REDIS_CONNECTION_URL, {
            maxRetriesPerRequest: null, // Evita reintentos infinitos en serverless
            enableReadyCheck: false,
        });

        actionQueue = new Queue(QUEUE_NAME, {
            connection,
        });
        logger.info(`BullMQ queue "${QUEUE_NAME}" initialized.`);
        return actionQueue;
    } catch (error) {
        logger.error('Failed to initialize BullMQ queue:', error);
        throw error;
    }
};

// -------------------------------------------------------------------------
// FUNCIÓN DE DESPACHO
// -------------------------------------------------------------------------

/**
 * Delega el envío del resultado del flujo a una cola de BullMQ (Redis).
 * @param flow El documento de flujo completo.
 * @param result El resultado retornado por el script del usuario.
 * @returns El estado de la PUESTA EN COLA (asíncrona).
 */
export const dispatchActionAsynchronously = async (
    flow: FlowDocument,
    result: unknown
): Promise<{ success: boolean, error?: string }> => {
    try {
        const queue = initializeQueue();

        // Payload que se enviará al worker que procesa las acciones.
        const jobPayload = {
            flowId: flow.flowId,
            actionUrl: flow.actionUrl,
            userId: flow.userId,
            result: result,
        };

        // Añadimos el trabajo a la cola.
        // El nombre del trabajo puede ser descriptivo, ej: 'send-webhook'
        await queue.add('dispatch-action', jobPayload, {
            // Opciones del trabajo (reintentos, etc.)
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
        });

        logger.info(`[BULLMQ] Action for flow ${flow.flowId} successfully queued to "${QUEUE_NAME}".`);
        return { success: true };

    } catch (error) {
        const errorMessage = `Failed to queue task with BullMQ: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(`[BULLMQ_ERROR] ${errorMessage}`);
        return { success: false, error: errorMessage };
    }
};
