import { Client } from 'pg';
import { FlowDocument, ExecutionLog } from './types.js';
import { logger } from './logger.js';

// -------------------------------------------------------------
// 0. CONFIGURACIÓN
// -------------------------------------------------------------

// DATABASE_URL will be read when getDbClient is called

// -------------------------------------------------------------
// 1. FUNCIÓN DE CONEXIÓN
// -------------------------------------------------------------

/**
 * Crea y conecta un nuevo cliente de PostgreSQL.
 * En un entorno serverless, creamos una conexión por cada invocación.
 * @returns Una instancia del cliente de PostgreSQL conectado.
 */
const getDbClient = async (): Promise<Client> => {
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        const errorMessage = 'DATABASE_URL environment variable is not set.';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    const client = new Client({
        connectionString: DATABASE_URL,
    });
    try {
        await client.connect();
        return client;
    } catch (error) {
        logger.error('Failed to connect to the database:', error);
        throw error;
    }
};

// -------------------------------------------------------------
// 2. FUNCIONES DE LECTURA DE FLUJOS (Orquestación)
// -------------------------------------------------------------

/**
 * Recupera un documento de flujo por su flowId desde PostgreSQL.
 * @param flowId - El ID del flujo a buscar.
 * @returns El FlowDocument si se encuentra y está activo, o null.
 */
export const getFlowDocument = async (flowId: string): Promise<FlowDocument | null> => {
    const client = await getDbClient();
    try {
        const query = {
            text: 'SELECT * FROM flows WHERE "flowId" = $1 AND "isActive" = true',
            values: [flowId],
        };
        const res = await client.query(query);

        if (res.rows.length > 0) {
            // Mapeo manual para asegurar la estructura correcta del tipo
            const row = res.rows[0];
            const flowDocument: FlowDocument = {
                userId: row.userId,
                flowId: row.flowId,
                flowName: row.flowName, // Added flowName
                isActive: row.isActive,
                userCode: row.userCode,
                secretReferences: row.secretReferences,
                actionUrl: row.actionUrl,
                createdAt: new Date(row.createdAt),
                updatedAt: new Date(row.updatedAt),
            };
            return flowDocument;
        }
        return null; // El flujo no existe o está inactivo
    } catch (error) {
        logger.error(`Error fetching flow ${flowId} from PostgreSQL:`, error, { flowId });
        return null; // Error de conexión o de lectura
    } finally {
        await client.end();
    }
};

// -------------------------------------------------------------
// 3. FUNCIONES DE REGISTRO (LOGGING)
// -------------------------------------------------------------

/**
 * Registra un evento completo de ejecución en la tabla 'execution_logs' de PostgreSQL.
 * @param logData - Los datos del log a registrar.
 */
export const logExecution = async (logData: ExecutionLog): Promise<void> => {
    const client = await getDbClient();
    try {
        const query = {
            text: `INSERT INTO execution_logs ("flowId", "userId", "flowName", status, "durationMs", timestamp, payload, result, error, "actionStatus")
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            values: [
                logData.flowId,
                logData.userId,
                logData.flowName, // Added flowName
                logData.status,
                logData.durationMs,
                logData.timestamp,
                logData.payload,
                logData.result,
                logData.error,
                logData.actionStatus,
            ],
        };
        await client.query(query);
    } catch (error) {
        logger.error(`CRITICAL: Failed to save execution log for ${logData.flowId}:`, error, { flowId: logData.flowId });
        // En un escenario real, esto debería ir a un sistema de errores de emergencia.
    } finally {
        await client.end();
    }
};
