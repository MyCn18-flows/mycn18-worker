/**
 * Tipo genérico para la entrada de datos del Webhook.
 * Usamos Record<string, unknown> para permitir cualquier estructura JSON.
 */
export type FlowPayload = Record<string, unknown>;

/**
 * Tipo para las variables de entorno/secrets inyectadas en el script.
 * Deben ser solo strings para simular variables de entorno (ENV).
 */
export type FlowSecrets = Record<string, string>;

/**
 * Tipo de la respuesta devuelta por el motor executeUserScript.
 * Contiene el resultado final del script O el error de ejecución.
 */
export type ExecutionResult = {
    success: true;
    result: unknown; // El valor que retorna el script del usuario.
} | {
    success: false;
    error: string; // Mensaje de error (ej: timeout, error de sintaxis, etc.)
};


// -------------------------------------------------------------
// TIPOS PARA LA BASE DE DATOS Y ORQUESTACIÓN
// -------------------------------------------------------------

/**
 * Estructura de un Flow Document almacenado en PostgreSQL.
 * Los campos `secretReferences`, `userCode`, `actionUrl` se almacenan como JSONB.
 * El motor Orchestrator solo necesita estos campos.
 */
export type FlowDocument = {
    userId: string;
    flowId: string;
    flowName: string;           // Nombre del flujo para identificación
    isActive: boolean;
    userCode: string;           // El código TS/JS a ejecutar
    secretReferences: FlowSecrets; // Referencias a los secrets (ej: nombres de recursos de GSM)
    actionUrl: string;          // El Webhook de salida (a dónde enviar el resultado)
    createdAt: Date;
    updatedAt: Date;
};


/**
 * Estados posibles para el log de ejecución.
 */
export enum LogStatus {
    SUCCESS = 'SUCCESS',
    FAIL = 'FAIL',
    TIMEOUT = 'TIMEOUT',
    ACTION_FAIL = 'ACTION_FAIL'
}

/**
 * Estructura de un log de ejecución almacenado en PostgreSQL.
 * Se usan campos JSONB para `payload` y `result` para flexibilidad.
 * Esto se usa para auditoría, debugging y facturación.
 */
export type ExecutionLog = {
    flowId: string;
    userId: string;
    flowName: string; // Nombre del flujo para auditoría
    status: LogStatus;
    durationMs: number;
    timestamp: Date;
    payload: FlowPayload; // Para auditoría (JSONB)
    result?: unknown; // Si fue SUCCESS (JSONB)
    error?: string; // Si fue FAIL/TIMEOUT
    actionStatus?: number; // Status code del webhook de salida
};
