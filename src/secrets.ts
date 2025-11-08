import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { FlowSecrets } from './types'; 

// --- Configuración y Clientes ---

// El cliente de Secret Manager se inicializa automáticamente usando las credenciales
// del entorno (la Cuenta de Servicio de Cloud Run).
const client = new SecretManagerServiceClient();

// Expresión regular para validar y extraer el nombre del recurso de GSM.
// Acepta 'latest' o un número de versión.
const GSM_RESOURCE_REGEX = /^projects\/[^\/]+\/secrets\/[^\/]+\/versions\/(latest|\d+)$/;

// --- Funciones Internas ---

/**
 * Accede y recupera el valor de un secret de Google Secret Manager.
 * @param secretResourceName El nombre completo del recurso GSM (ej: projects/123/secrets/key/versions/latest).
 * @returns El valor del secret como string.
 */
async function getSecretFromGSM(secretResourceName: string): Promise<string> {
    try {
        const [version] = await client.accessSecretVersion({
            name: secretResourceName,
        });

        const secretValue = version.payload?.data?.toString();
        
        if (!secretValue) {
            throw new Error(`GSM returned empty data for ${secretResourceName}`);
        }

        return secretValue;
    } catch (error) {
        console.error(`GSM_ERROR: Failed to access secret ${secretResourceName}. Ensure IAM permissions are set.`, error);
        throw new Error(`Failed to resolve secret ${secretResourceName}`);
    }
}

// --- Función Principal ---

/**
 * Resuelve y recupera todos los secrets del usuario de Google Secret Manager (GSM).
 * Solo los valores que coinciden con el formato GSM URI se resuelven.
 * Todos los demás valores se pasan directamente.
 * * @param flowSecrets - Los secrets definidos en el documento de flujo.
 * @returns Los secrets con sus valores reales obtenidos de GSM o pasados directamente.
 */
export async function resolveUserSecrets(flowSecrets: FlowSecrets): Promise<FlowSecrets> {
    const secretKeys = Object.keys(flowSecrets);
    
    // Usamos Promise.all para resolver todos los secrets en paralelo
    const resolutionPromises = secretKeys.map(async (key) => {
        const value = flowSecrets[key];

        // 1. Validar si el valor es un recurso GSM
        if (value && GSM_RESOURCE_REGEX.test(value)) {
            try {
                // Si es un recurso GSM válido, lo resolvemos
                const secretValue = await getSecretFromGSM(value);
                return [key, secretValue];
            } catch (error) {
                // Si la resolución falla, el flujo debe abortar por seguridad
                console.error(`SECURITY_CRITICAL: Flow aborted due to failure resolving secret ${key}.`);
                throw error; 
            }
        }
        
        // 2. Si no es un recurso GSM, lo pasamos directamente
        return [key, value];
    });

    try {
        const resolvedEntries = await Promise.all(resolutionPromises);
        
        // Convertir el array de [key, value] de vuelta a un objeto FlowSecrets
        const resolvedSecrets: FlowSecrets = Object.fromEntries(resolvedEntries);

        // Retornamos el objeto de secrets limpio y resuelto
        return resolvedSecrets;
    } catch (error) {
        // Propagar cualquier error de resolución crítica
        throw error;
    }
}