<!--
Keep this file concise (20-50 lines). It guides AI coding agents to quickly become productive in this repository.
This repo currently contains no source files (only .git/). The instructions therefore focus on
how to discover important project structure once files are added and on repository-specific
merge/authoring rules for generated changes.
-->

# Copilot instructions for scriptflow-core-orquestrator

Repository state: currently empty (only .git present). When source files are added, follow
the steps below to discover architecture, workflows, and conventions.

1. Quick repository scan (required)
   - Look for these top-level files/dirs and treat them in priority order: `README.md`,
     `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Makefile`, `Dockerfile`,
     `src/`, `cmd/`, `services/`, `internal/`, `.github/workflows/`.
   - If multiple `package.json` or `pyproject.toml` are present, it's a monorepo — inspect
     each package folder for its own build/test scripts.

2. Understand the big picture (how to infer architecture)
   - Service boundaries: detect sibling folders under `services/` or `packages/` that contain
     their own manifest files (e.g. `services/foo/package.json` or `services/bar/pyproject.toml`).
   - Entrypoints: prefer `src/index.ts`, `src/main.ts`, `main.py`, or `cmd/*/main.go` to find
     runtime wiring and external API surfaces.
   - Orchestrator intent: repository name includes "orquestrator" — expect message flows,
     jobs, or workflow definitions. Look for queue clients, scheduler code, or files named
     `orchestrator`, `workflow`, `scheduler`, or `executor`.

3. Developer workflows (what to run)
   - If `package.json` exists: run `npm ci` then `npm test` and `npm run build` (use PowerShell).
   - If `pyproject.toml` exists: create venv, `pip install -r requirements.txt` or `pip install .`,
     then `pytest -q`.
   - If `.github/workflows/` exists, inspect workflow YAMLs to learn CI steps, linters and test commands.

4. Project-specific conventions (what to preserve)
   - Preserve any `CHANGELOG.md` and versioning scheme found in manifests; prefer existing
     script or workflow for releases.
   - Use existing code style tools and linters discovered in the repo (`.eslintrc`, `pyproject.toml` settings).
   - Respect per-package scripts in monorepos; do not centralize commands unless repo already does.

5. Integrations and cross-component patterns to look for
   - Dockerfiles, `k8s/` or `deploy/` directories indicate containerized deployment.
   - `terraform/`, `helm/`, or `charts/` indicate IaC integrations.
   - Messaging infra: search for imports/usages of `kafka`, `rabbitmq`, `nats`, `sqs`, `redis`.

6. PR & edit rules for AI agents
   - Keep changes minimal and atomic. Add tests for any non-trivial logic change when the project
     already includes tests.
   - If updating configuration or CI, mirror the repository's existing style and keep one logical
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
