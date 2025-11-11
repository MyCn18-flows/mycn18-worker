import { FlowSecrets } from './types.js';
import { logger } from './logger.js';

/**
 * Resuelve los secrets del usuario. En esta arquitectura, esta función es un "passthrough".
 * Se asume que los secretos ya vienen resueltos desde la capa de control (API de gestión, etc.).
 * No se realiza ninguna llamada a servicios externos de gestión de secretos.
 *
 * @param flowSecrets - Los secrets definidos en el documento de flujo.
 * @returns Una promesa que se resuelve con el mismo objeto de secrets.
 */
export const resolveUserSecrets = async (flowSecrets: FlowSecrets): Promise<FlowSecrets> => {
    logger.info('Resolving user secrets (passthrough).');
    // Devuelve directamente los secretos, ya que se asume que están resueltos.
    return Promise.resolve(flowSecrets);
};
