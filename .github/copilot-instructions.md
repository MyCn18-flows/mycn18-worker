<!--
Concise guide (20-50 lines) to help AI agents and new contributors become productive quickly.
This repository currently contains the initial skeleton for the ScriptFlow / Flow Weaver orchestrator.
The document includes a discovery checklist plus project-specific guidance for the ScriptFlow / Flow Weaver initiative.
Keep this file up-to-date: summarize the project's mission, next milestones, and how todos map
to GitHub Issues (only sync to Issues after human approval).
-->

# Copilot instructions for scriptflow-orchestrator (ScriptFlow / Flow Weaver)

Project snapshot
- Name: scriptflow-orchestrator (aka ScriptFlow / Flow Weaver)
- Mission: secure, fast, and cost-efficient serverless runtime that allows users to inject
  TypeScript/JS logic into automation workflows.
- Core design choices: build-time dependency installation (faster cold starts) and a minimal audited sandbox (vm2).
- Current State: Prototipo / MVP temprano. Es un scaffold funcional que permite ejecutar código de usuario en un runtime TypeScript mínimamente viable.

Required discovery checklist
- Inspect top-level files/folders: `README.md`, `package.json`, `tsconfig.json`, `Dockerfile`, `src/`, `.github/workflows/`, `TODOs.md`.
- Identify runtime entrypoints: `src/server.ts` (Hono server), `src/runtime.ts` (VM2 executor).
- Understand data flow: `src/db.ts` (Firestore for flows/logs), `src/secrets.ts` (Google Secret Manager), `src/action.ts` (Google Cloud Tasks for async actions).

Project-specific patterns to preserve
- Build-time deps: install whitelist deps during the Docker build stage and COPY only `dist` + required `node_modules` to final image.
- Sandbox: use `vm2` with enforced timeouts (5s) and memory limits; white-list builtin and external modules. Avoid direct host `require(mod)` mapping.
- Separation of concerns: orchestration (auth, webhooks, flow selection) is decoupled from the VM-runner; designed to be extractable as `scriptflow-vm-runner`.
- Secrets management: utilize Google Secret Manager for sensitive data; do not accept secrets in request bodies for production flows.

Developer workflows (examples)
- Install & Build (PowerShell): `npm ci; npm run build`.
- Development (PowerShell): `npm run dev`.
- Run locally (PowerShell): `npm start`.
- Build for Cloud Run: validate multi-stage Dockerfile installs whitelist deps during build stage and produces a minimal final image.

Working rules for AI agents
- Maintain the 2–3 line project summary at the top of this file reflecting current milestone.
- Keep changes minimal, add tests for non-trivial logic, and prefer small, reviewable PRs.
- Draft todos must live in `TODOs.md` at repo root. Only convert to GitHub Issues after explicit owner approval. When syncing, create one issue per todo with labels and acceptance criteria.
- Prioritize security hardening, automated testing, and CI/CD implementation.

If stuck
- Create an exploratory branch and open a draft PR with `README.change.md` describing assumptions and discovery steps; request review from the owner.

Want more detail?
- Refer to `TODOs.md` for the current development plan and issues.
    <!--
    Concise guide (20-50 lines) to help AI agents and new contributors become productive quickly.
    This repository currently contains only a `.git/` folder. The document includes a discovery
    checklist plus project-specific guidance for the ScriptFlow / Flow Weaver initiative. Keep
    this file up-to-date: summarize the project's mission, next milestones, and how todos map
    to GitHub Issues (only sync to Issues after human approval).
    -->

    # Copilot instructions for scriptflow-orchestrator (ScriptFlow / Flow Weaver)

    Project snapshot
    - Name: scriptflow-orchestrator (aka ScriptFlow / Flow Weaver)
    - Mission: secure, fast, and cost-efficient serverless runtime that allows users to inject
      TypeScript/JS logic into automation workflows. Core design choices: build-time dependency
      installation (faster cold starts) and a minimal audited sandbox (vm2).

    Required discovery checklist (when sources appear)
    - Inspect top-level files/folders: `README.md`, `package.json`, `tsconfig.json`, `Dockerfile`, `src/`, `cmd/`, `services/`, `.github/workflows/`.
    - Identify runtime entrypoints: `src/server.ts`, `src/runtime.ts`, `src/index.ts`, or `cmd/*/main.*`.
    - If you find multiple manifests (e.g., `packages/*/package.json`), treat this as a monorepo and inspect per-package build/test scripts.

    Project-specific patterns to preserve
    - Build-time deps: install whitelist deps during the Docker build stage and COPY only `dist` + required `node_modules` to final image.
    - Sandbox: use `vm2` (or equivalent) with enforced timeouts and memory limits; white-list builtin and external modules.
    - Separation of concerns: orchestration (auth, webhooks, flow selection) should remain decoupled from the VM-runner; extractable as `scriptflow-vm-runner`.

    Developer workflows (examples — adapt after discovering files)
    - Node/TS (PowerShell): `npm ci; npm test; npm run build`.
    - Build for Cloud Run: validate multi-stage Dockerfile installs whitelist deps during build stage and produces a minimal final image.

    Working rules for AI agents
    - Maintain the 2–3 line project summary at the top of this file reflecting current milestone.
    - Keep changes minimal, add tests for non-trivial logic, and prefer small, reviewable PRs.
    - Draft todos must live in `TODOs.md` at repo root. Only convert to GitHub Issues after explicit owner approval. When syncing, create one issue per todo with labels and acceptance criteria.

    If stuck
    - Create an exploratory branch and open a draft PR with `README.change.md` describing assumptions and discovery steps; request review from the owner.

    Want more detail?
    - Tell the agent which primary language/framework and CI you plan to use and attach main source files; the agent will expand this guide with concrete commands and examples.
