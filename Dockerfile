# -----------------------------------------------------------------
# ETAPA 1: BUILD (Compila TypeScript)
# -----------------------------------------------------------------
# Usamos una imagen de Node.js robusta para la compilación
FROM node:20-slim AS builder

# 1. Configuración y Copia
WORKDIR /app
# Copiamos package.json y package-lock.json primero para cachear las dependencias
COPY package*.json ./

# 2. Instalación de Dependencias
# Instalamos dependencias, incluyendo las de desarrollo, para transpilar
# (Necesitamos typescript, ts-node, etc.)
RUN npm install

# 3. Copia del Código Fuente y Compilación
# Copiamos todo el código fuente (TypeScript)
COPY . .
# Transpilamos TypeScript a JavaScript puro
RUN npx tsc

# -----------------------------------------------------------------
# ETAPA 2: PRODUCCIÓN (Ejecución Optimizada)
# -----------------------------------------------------------------
# Usamos una imagen base extremadamente ligera para la ejecución final.
# Esto reduce el tamaño de la imagen final de ~1GB a ~150MB.
FROM gcr.io/distroless/nodejs20-slim

# 1. Configuración
WORKDIR /app

# 2. Copia de Artefactos de la Etapa de Build
# Copiamos solo los archivos necesarios de la etapa 'builder'
# - package.json (para saber qué ejecutar)
# - node_modules (dependencias de producción)
# - dist/ (código JS transpilado y mapeado)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 3. Configuración de Seguridad y Entrada
# Cloud Run inyecta la variable PORT automáticamente.
ENV PORT 8080
ENV NODE_ENV production

# Crear un usuario no-root para mayor seguridad
USER nonroot

# Comando de Ejecución: Inicia el servidor Hono compilado
# Asumimos que la compilación genera un archivo dist/server.js que exporta el handler.
CMD ["node", "dist/server.js"]
