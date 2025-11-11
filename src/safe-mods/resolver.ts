// Define a type for the modules that can be injected
export type InjectedModule = Record<string, unknown>;

let userModules: Record<string, InjectedModule> = {};

/**
 * Initializes the userModules map for a specific execution.
 * This should be called at the beginning of each script execution.
 * @param modules The map of user modules to make available.
 */
export function initializeUserModules(modules: Record<string, InjectedModule>): void {
    userModules = modules;
}

/**
 * Statically defined community modules that are pre-approved.
 * These modules are loaded directly by the orchestrator and passed into the sandbox.
 * IMPORTANT: Only add modules here that are safe and necessary.
 */
import _ from 'lodash'; // Import lodash using ES Module syntax

const communityModules: Record<string, InjectedModule> = {
    'lodash': _, // Use the ES Module import
    // 'axios-retry': require('axios-retry'), // Example: axios-retry - This would need to be imported similarly if used
    // Add other pre-approved community modules here
};

/**
 * Custom module resolver for vm2.
 * It checks against a whitelist of community modules and user-provided modules.
 * @param moduleName The name of the module being required.
 * @returns The module content if found and allowed.
 * @throws Error if the module is not allowed.
 */
export function safeModuleResolver(moduleName: string): InjectedModule {
    // 1. Check Community Modules
    if (communityModules[moduleName]) {
        return communityModules[moduleName];
    }

    // 2. Check User Modules
    if (userModules[moduleName]) {
        return userModules[moduleName];
    }

    // 3. If not found in either, throw an error
    throw new Error(`Module '${moduleName}' is not allowed or not found.`);
}
