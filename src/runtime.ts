import { VM, VMScript } from 'vm2';
import { FlowPayload, FlowSecrets, ExecutionResult } from './types.js';
import { safeHttpClient } from './safe-mods/http.js';
import { logger } from './logger.js';
import { safeModuleResolver, initializeUserModules, InjectedModule } from './safe-mods/resolver.js';

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
    secrets: FlowSecrets,
    userModulesToInject: Record<string, InjectedModule> // Nuevo parámetro
): Promise<ExecutionResult> => {
    // Configuración del logger seguro para el sandbox
    const sandboxedLogger = {
        info: (message: string, context?: Record<string, unknown>) => logger.info(`[USER_SCRIPT] ${message}`, context),
        warn: (message: string, context?: Record<string, unknown>) => logger.warn(`[USER_SCRIPT] ${message}`, context),
        error: (message: string, error?: Error | unknown, context?: Record<string, unknown>) => logger.error(`[USER_SCRIPT] ${message}`, error, context),
    };

    // Initialize user modules for this execution
    initializeUserModules(userModulesToInject);

    // 1. Configuración del Sandbox
    const vm = new VM({
        timeout: 5000,      // **CRÍTICO:** Límite estricto de 5 segundos de ejecución.
        allowAsync: true,   // Permite usar 'await' en el script del usuario.
        
        // Variables globales que el script puede acceder
        sandbox: {
            payload: payload,       // Datos de entrada del webhook
            env: secrets,           // Secrets inyectados como variables de entorno
            console: sandboxedLogger, // Usar el logger seguro en lugar del console directo
            http: safeHttpClient,
            // Inyectar funciones de timer para código asíncrono
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
        },
        
        // Configuración de Seguridad de Módulos (Lista Blanca)
        // @ts-expect-error - 'require' es una opción de vm2 válida pero no incluida en sus tipos oficiales.
        require: {
            external: true, // Must be true to use custom resolver
            builtin: [],     // Does not allow native Node modules by default
            custom: safeModuleResolver, // Here the whitelisting logic is injected
            root: './',
        }
    });

    try {
        // Envolver el código del usuario en una IIFE asíncrona para poder usar 'await' y 'return'.
        const wrappedCode = `(async () => { ${userCode} })()`;
        
        // Crear el script (opcional pero ayuda a optimizar la ejecución en VM2)
        const script = new VMScript(wrappedCode);

        // Ejecución
        const result = await vm.run(script);
        
        // El script se ejecutó sin errores y retornó un valor
        return { success: true, result };
        
    } catch (error: Error | unknown) {
        // Captura errores de sintaxis, timeouts, o excepciones dentro del script
        const errorMessage = error instanceof Error? error.message : String(error);
        
        return { success: false, error: errorMessage };
    }
};
