# hapi web

`hapi-web` — React 19 PWA for remote-controlling Cursor Agent sessions through the hub from a phone, tablet, or browser. Built with Vite, TanStack Router + Query, Tailwind v4, and `vite-plugin-pwa`.

## Install / Dev / Build

From the repo root:

```bash
bun install
```

Dev server (Vite on `127.0.0.1:5173`, proxies API + SSE to a hub on `127.0.0.1:3006`):

```bash
cd web && bun run dev
```

Production bundle (output: `web/dist/`):

```bash
cd web && bun run build
```

The single-exe build (`bun run build:single-exe` from the repo root) embeds the
contents of `web/dist/` into the hub binary so the PWA is served at the hub URL
directly — no separate static host required.

## `bun run` scripts

Sourced verbatim from `web/package.json`.

| Script      | Command                                          | Purpose                                                   |
| ----------- | ------------------------------------------------ | --------------------------------------------------------- |
| `dev`       | `vite`                                           | Vite dev server with HMR.                                 |
| `build`     | `vite build && cp dist/index.html dist/404.html` | Production bundle + SPA-friendly 404 fallback.            |
| `typecheck` | `tsc --noEmit`                                   | Strict TS check of `web/src/`.                            |
| `preview`   | `vite preview`                                   | Serve the built bundle locally.                           |
| `test`      | `vitest run`                                     | Run the Vitest suite once.                                |

## Key modules

| Path                  | Role                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `src/main.tsx`        | React root + service worker registration.                                       |
| `src/App.tsx`         | App shell — providers, auth gate.                                               |
| `src/router.tsx`      | TanStack Router tree.                                                           |
| `src/sw.ts`           | Custom service-worker logic (workbox precaching + runtime routing).             |
| `src/routes/`         | Page-level route components (`sessions/`, `settings/`).                         |
| `src/components/`     | Reusable UI — `SessionChat`, `SessionList`, `AssistantChat/`, `ToolCard/`, etc. |
| `src/hooks/`          | React hooks — `queries/` (TanStack Query), `mutations/`, `useSSE`, `useAuth`.   |
| `src/chat/`           | Chat reducer + normalizers (turn hub stream events into a displayable timeline).|
| `src/api/`            | API client against the hub (`api/client.ts`).                                   |
| `src/lib/`            | App-context-aware helpers (query client, i18n, fuzzy match, message window).    |
| `src/types/`, `src/utils/` | Shared types and generic helpers.                                          |

## Tests

```bash
cd web && bun run test
```

Runs Vitest with jsdom + `@testing-library/react`. Co-located `*.test.ts` /
`*.test.tsx` per repo convention. Cross-runner rule: `web/` is Vitest-only —
do not import from `bun:test` here.

## PWA notes

- `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'`; the
  service worker (`src/sw.ts`) uses workbox for precaching and runtime
  routing.
- In single-exe deployments the hub serves `web/dist/` directly, so the PWA
  installs from the same Tailscale URL the hub binds to (see the root
  [README quickstart](../README.md#quickstart)).
- Static PWA assets (icons, manifest fragments) live under `web/public/`.
