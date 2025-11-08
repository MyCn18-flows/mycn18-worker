import { FlowDocument } from './types';

// El 'fetch' nativo de Node.js está disponible en versiones recientes (Node 18+)
// Esto mantiene la imagen limpia sin dependencias como 'axios'.

/**
 * Envía el resultado final de la ejecución de un flujo a la URL de acción del usuario.
 * Esta función cierra el ciclo de la automatización (Entrada -> Lógica -> Salida).
 * @param flow El FlowDocument que contiene la actionUrl.
 * @param result El resultado retornado por el script del usuario.
 */
export async function sendActionWebhook(flow: FlowDocument, result: unknown): Promise<{ success: boolean; status?: number; error?: string }> {
    const { actionUrl, flowId } = flow;

    if (!actionUrl) {
        console.warn(`[Flow ${flowId}] Action URL is not defined. Skipping webhook.`);
        return { success: true, status: 204 }; // No Content
    }

    try {
        console.log(`[Flow ${flowId}] Sending action webhook to: ${actionUrl}`);
        
        // 1. Configuración de la Solicitud
        const response = await fetch(actionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Opcional: Podrías añadir un header secreto aquí para que el usuario valide
                // que la solicitud realmente viene de ScriptFlow.
                'X-ScriptFlow-ID': flowId,
            },
            body: JSON.stringify({
                flowId: flowId,
                status: 'completed',
                result: result,
                timestamp: new Date().toISOString(),
            }),
            // 2. Timeout de la Solicitud (CRÍTICO para evitar bloqueos)
            // Limitamos la llamada de salida a 10 segundos.
            signal: AbortSignal.timeout(10000), 
        });

        // 3. Manejo de la Respuesta
        if (response.ok) {
            console.log(`[Flow ${flowId}] Action webhook successful. Status: ${response.status}`);
            return { success: true, status: response.status };
        } else {
            const errorText = await response.text();
            console.error(`[Flow ${flowId}] Action webhook failed. Status: ${response.status}. Body: ${errorText}`);
            return { success: false, status: response.status, error: `Remote server returned status ${response.status}` };
        }

    } catch (error: any) {
        // Captura errores de red, DNS o el timeout (AbortSignal)
        const errorMessage = error.name === 'TimeoutError' ? 'Action Webhook Timed Out (10s limit).' : error.message;
        
        console.error(`[Flow ${flowId}] Network error sending action webhook: ${errorMessage}`);
        
        // **PENDIENTE:** Aquí implementaríamos el logging de fallos (Issue #13)
        
        return { success: false, error: errorMessage };
    }
}