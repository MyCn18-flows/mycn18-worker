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
 * Estructura de un Flow Document almacenado en Firestore.
 * El motor Orchestrator solo necesita estos campos.
 */
export type FlowDocument = {
    userId: string;
    flowId: string;
    isActive: boolean;
    userCode: string;           // El código TS/JS a ejecutar
    secrets: FlowSecrets;       // Las credenciales/variables de entorno
    actionUrl: string;          // El Webhook de salida (a dónde enviar el resultado)
    createdAt: Date;
    updatedAt: Date;
};


/**
 * 
 */
export enum LogStatus {
    SUCCESS = 'SUCCESS',
    FAIL = 'FAIL',
    TIMEOUT = 'TIMEOUT',
    ACTION_FAIL = 'ACTION_FAIL'
}

/**
 * Estructura de un log de ejecución almacenado en Firestore.
 * Esto se usa para auditoría, debugging y facturación.
 */
export type ExecutionLog = {
    flowId: string;
    userId: string;
    status: LogStatus;
    durationMs: number;
    timestamp: Date;
    payload: FlowPayload; // Para auditoría
    result?: unknown; // Si fue SUCCESS
    error?: string; // Si fue FAIL/TIMEOUT
    actionStatus?: number; // Status code del webhook de salida
};