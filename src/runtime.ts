import { VM, VMScript } from 'vm2';
import { FlowPayload, FlowSecrets, ExecutionResult } from './types'; // Ahora incluye ExecutionResult
import { logger } from './logger';

/**
 * Lista blanca de módulos que el script del usuario tiene permitido importar.
 * Esta lista está pre-instalada en la imagen de Docker.
 */
const ALLOWED_MODULES = ['axios', 'lodash', 'moment', 'ts-pattern'];

/**
 * Ejecuta el código del usuario dentro de un entorno seguro y aislado (sandbox).
 * @param userCode - El script del usuario a ejecutar.
 * @param payload - Los datos del webhook.
 * @param secrets - Las variables de entorno para el script.
 * @returns Un objeto ExecutionResult indicando éxito o fracaso.
 */
export const executeUserScript = async (
    userCode: string,
    payload: FlowPayload,
    secrets: FlowSecrets
): Promise<ExecutionResult> => {
    // Cargar los módulos permitidos directamente en el sandbox para evitar `require.mock`
    // y reducir la superficie de ataque.
    const sandboxedModules: Record<string, any> = {};
    for (const mod of ALLOWED_MODULES) {
        try {
            sandboxedModules[mod] = require(mod);
        } catch (error) {
            logger.error(`[SANDBOX] Failed to load whitelisted module '${mod}'`, error);
            // Si un módulo no se puede cargar, no lo inyectamos.
        }
    }

    // 1. Configuración del Sandbox
    const vm = new VM({
        timeout: 5000,      // **CRÍTICO:** Límite estricto de 5 segundos de ejecución.
        allowAsync: true,   // Permite usar 'await' en el script del usuario.
        
        // Variables globales que el script puede acceder
        sandbox: {
            payload: payload,   // Datos de entrada del webhook
            env: secrets,       // Secrets inyectados como variables de entorno
            console: console,   // Permite al usuario hacer logging
            ...sandboxedModules // Inyección directa de módulos permitidos
        },
        
        // Configuración de Seguridad de Módulos (Lista Blanca)
        // Deshabilitamos 'external' y 'mock' para forzar la inyección directa.
        require: {
            external: false, // No permite require() externo
            builtin: ['util', 'events'], // Módulos nativos de Node permitidos (minimalista)
            root: './',
            // mock ya no es necesario aquí, los módulos se inyectan en sandbox
        }
    } as any);

    try {
        // Envolver el código del usuario en una IIFE asíncrona para poder usar 'await' y 'return'.
        const wrappedCode = `(async () => { ${userCode} })()`;
        
        // Crear el script (opcional pero ayuda a optimizar la ejecución en VM2)
        const script = new VMScript(wrappedCode);

        // Ejecución
        const result = await vm.run(script);
        
        // El script se ejecutó sin errores y retornó un valor
        return { success: true, result };
        
    } catch (err: any) {
        // Captura errores de sintaxis, timeouts, o excepciones dentro del script
        const errorMessage = err?.message ?? String(err);
        
        // Limpiamos la referencia a la VM por seguridad después de un fallo
        (vm as any).dispose(); 
        
        return { success: false, error: errorMessage };
    }
};
