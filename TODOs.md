# TODOs (Draft) — scriptflow-orchestrator

Estado: borrador. Estos todos se mantendrán en este archivo hasta que el propietario los apruebe; luego serán sincronizados a GitHub Issues (1 todo = 1 issue) con etiquetas y milestones.

## Milestone: MVP Core Runtime (Target: 1.0)

| Título del Issue | Etiqueta(s) Sugerida(s) | Dependencia |
| :--- | :--- | :--- |
| [Setup] Inicializar el proyecto Node.js con Hono y TS | `setup`, `infra` | Ninguna |
| [Setup] Definir Dockerfile base para Cloud Run (Contenedor) | `setup`, `infra` | #1 |
| [Feature] Implementar el `vm2` Sandboxing Core (`runtime.ts`) | `core-logic`, `security` | #1 |
| [Feature] Configurar endpoint POST `/api/webhook/:flowId` en Hono | `api`, `core-logic` | #1 |
| [Feature] Implementar carga simulada de `userCode` y `secrets` | `core-logic`, `testing` | #3, #4 |
| [Seguridad] Definir Lista Blanca inicial de módulos (axios, lodash) | `security`, `config` | #3 |
| [Seguridad] Implementar manejo de `timeout` en `vm2` (5 segundos) | `security`, `core-logic` | #3 |
| [Monitor] Implementar un endpoint `/health` para Cloud Run | `infra`, `monitoring` | #4 |
| [Doc] Crear el archivo `README.md` del repositorio | `documentation` | Ninguna |

## Notas para revisión

- Cada fila de la tabla anterior es un borrador de Issue. Añade criterios de aceptación y pasos de prueba antes de sincronizar.
- Prioriza 3-5 issues a la vez en la columna "In Progress". Mantén el resto en Backlog.
- Riesgos críticos identificados: sandbox escape, unlimited resource usage, secret leakage. Cada riesgo debe tener un issue asociado con mitigaciones propuestas.

## Propuesta de primer sprint (2 semanas)

- [x] #1 Setup Node/Hono/TS + basic CI
- [ ] #2 Dockerfile multi-stage + build proof-of-concept
- [ ] #3 runtime.ts minimal vm2 executor + unit tests
- [ ] #4 endpoint `/api/webhook/:flowId` + integration test that calls runtime

## Flujo de sincronización a Issues (procedimiento)

1. Mantener y editar `TODOs.md` en branches de trabajo.
2. Cuando el propietario apruebe un bloque de todos, el agente creará Issues en GitHub (1:1), adjuntará la tabla original como referencia y añadirá etiquetas/milestones.
3. No automatizar la creación de Issues sin aprobación del propietario.
