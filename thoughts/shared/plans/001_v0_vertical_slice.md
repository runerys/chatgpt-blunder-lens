# blunder-lens v0 vertical slice — implementation plan

## Overview

Build the smallest working slice: a local MCP server with one tool (`show_position`) that causes ChatGPT to render a chessboard widget inside the conversation. The stack is TypeScript throughout, using npm workspaces, the MCP SDK, and React/Vite.

## Current state

Empty repo. Only documentation files exist (`PROJECT.md`, `README.md`, `.github/copilot-instructions.md`).

## Desired end state

1. `npm run dev` from the repo root starts both the MCP server and the Vite widget dev server.
2. The MCP server exposes `http://localhost:8787/mcp`.
3. Connecting ChatGPT Developer Mode to `https://<tunnel>/mcp` and prompting "Show the standard chess starting position" causes a chessboard to appear in the conversation.
4. The chessboard correctly renders highlights, arrows, last move, and a caption when provided.
5. `npm run typecheck` passes with zero errors across all three workspaces.

## What we are NOT doing

- PGN parsing
- Stockfish / engine analysis
- Authentication / OAuth
- User accounts or persistence
- Multiple boards or variation trees
- Move navigation or drag-and-drop
- Production deployment
- Public app directory submission

---

## Phase 1 — Monorepo scaffold and shared types

### Overview

Create the npm workspaces root, three package stubs, and the shared TypeScript types. Everything else depends on this.

### Changes required

#### 1. Root `package.json`

**File**: `package.json`

```json
{
  "name": "blunder-lens",
  "private": true,
  "workspaces": ["shared", "server", "web"],
  "scripts": {
    "typecheck": "npm run typecheck --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "dev": "concurrently \"npm run dev -w server\" \"npm run dev -w web\""
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.5.0"
  }
}
```

#### 2. Root `tsconfig.json`

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

#### 3. `shared` package

**File**: `shared/package.json`

```json
{
  "name": "@blunder-lens/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "*"
  }
}
```

**File**: `shared/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**File**: `shared/src/index.ts`

Export all types from `board-state.ts`.

**File**: `shared/src/board-state.ts`

Exact types from PROJECT.md:

```ts
export type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
export type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
export type Square = `${File}${Rank}`;

export interface BoardMove {
  from: Square;
  to: Square;
}

export interface BoardArrow {
  from: Square;
  to: Square;
  label?: string;
}

export interface ShowPositionInput {
  fen?: string;
  orientation?: "white" | "black";
  caption?: string;
  highlights?: Square[];
  arrows?: BoardArrow[];
  lastMove?: BoardMove | null;
}

export interface BoardState {
  fen: string;
  orientation: "white" | "black";
  caption: string;
  highlights: Square[];
  arrows: BoardArrow[];
  lastMove: BoardMove | null;
}
```

#### 4. `.gitignore`

```
node_modules/
dist/
.env
.env.local
```

### Success criteria

- [ ] `npm install` from root succeeds
- [ ] `npm run typecheck -w shared` passes with zero errors
- [ ] `@blunder-lens/shared` can be imported by server and web via workspace reference

---

## Phase 2 — MCP server with `show_position` tool

### Overview

Implement the Node.js MCP server. It exposes HTTP transport on `/mcp`, registers the `show_position` tool, validates input using `chess.js`, and returns `BoardState` as `structuredContent`.

### SDK

Use the official TypeScript MCP SDK plus the MCP Apps helpers:

- `@modelcontextprotocol/sdk` — MCP server and HTTP transport
- `@modelcontextprotocol/ext-apps` — `registerAppResource`, `registerAppTool`, `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server`
- `zod` — input schema validation for tool arguments

Do not look for a separate OpenAI SDK.

### Changes required

#### 1. `server/package.json`

```json
{
  "name": "@blunder-lens/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch dist/index.js",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@blunder-lens/shared": "*",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@modelcontextprotocol/ext-apps": "^1.0.0",
    "chess.js": "^1.0.0",
    "dotenv": "^16.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "*"
  }
}
```

#### 2. `server/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

#### 3. `server/.env.example`

```
PORT=8787
PUBLIC_BASE_URL=https://<dev-tunnel-host>
```

This file is committed. The actual `.env` is not.

#### 4. `server/src/index.ts`

- Load `.env`
- Create MCP server with HTTP transport on `${PORT}/mcp`
- Use `registerAppResource` from `@modelcontextprotocol/ext-apps/server` to register the widget HTML resource
- Use `registerAppTool` from `@modelcontextprotocol/ext-apps/server` to register the `show_position` tool with its UI resource reference
- Widget resource is served from `web/dist/` (built Vite output); see Phase 3 and Phase 4

#### 5. `server/src/tools/show-position.ts`

Input validation and normalization logic:

- Accept `ShowPositionInput`
- If `fen` is omitted or equals `"startpos"`, substitute the standard starting FEN
- Validate FEN using `chess.js` (`new Chess(fen)` — throws on invalid)
- Validate each square in `highlights`, `arrows.from`, `arrows.to`, `lastMove.from`, `lastMove.to` against the `Square` type pattern (`/^[a-h][1-8]$/`)
- Validate `caption` length ≤ 240 chars; reject with a clear error if exceeded. Do not truncate.
- Apply all defaults (empty arrays, `null`, `"white"`)
- Return `BoardState`
- Return `BoardState` as `structuredContent` in the tool result

Error responses must use MCP error format with a human-readable message.

### Success criteria

- [ ] `npm run typecheck -w server` passes with zero errors
- [ ] Server starts on port 8787 without errors
- [ ] `POST /mcp` responds to a minimal tool call `{}` with a valid `BoardState` containing the starting FEN
- [ ] Invalid FEN is rejected with a clear error message
- [ ] Caption > 240 chars is rejected with a clear error message
- [ ] Invalid square name is rejected with a clear error message

---

## Phase 3 — React/Vite chessboard widget

### Overview

Build the widget that renders a `BoardState`. It runs as a Vite dev server during development and builds to static HTML for production hosting.

### Chessboard component

Use `react-chessboard`. It supports:
- FEN rendering
- `customSquareStyles` for highlights
- `customArrows` for arrows
- `arePiecesDraggable={false}` to disable drag-and-drop

If `customArrows` rendering proves awkward for the annotation use case, replace the board with a CSS grid + absolute-positioned SVG overlay layer. Arrows matter more than drag-and-drop.

### Changes required

#### 1. `web/package.json`

```json
{
  "name": "@blunder-lens/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@blunder-lens/shared": "*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "react-chessboard": "^4.0.0",
    "chess.js": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "*",
    "vite": "^5.0.0"
  }
}
```

#### 2. `web/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

#### 3. `web/vite.config.ts`

Standard React plugin config.

#### 4. `web/index.html`

Standard Vite entry with `<script type="module" src="/src/main.tsx">`.

#### 5. `web/src/main.tsx`

Mount `<App />` to `#root`.

#### 6. `web/src/App.tsx`

Receive board state through the MCP Apps bridge. The bridge delivers tool results as JSON-RPC 2.0 messages over `postMessage`. Listen for `ui/notifications/tool-result` and read `BoardState` from `params.structuredContent`:

```ts
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg?.method === "ui/notifications/tool-result") {
    const boardState: BoardState = msg.params.structuredContent;
    // update state
  }
});
```

- If no message received yet, show the standard starting position as a placeholder
- Pass current `BoardState` to `<ChessBoard />`
- Do not fetch the MCP server directly from the widget

#### 7. `web/src/ChessBoard.tsx`

Props: `BoardState`

Renders:
- Chessboard from `fen` using the chosen component
- Board flipped when `orientation === "black"`
- Highlighted squares from `highlights`
- Arrows from `arrows`
- Last move highlight from `lastMove` (distinct color from `highlights`)
- Caption below the board if non-empty

### Success criteria

- [ ] `npm run typecheck -w web` passes with zero errors
- [ ] `npm run dev -w web` serves the widget at `http://localhost:5173`
- [ ] The widget displays the starting position by default
- [ ] Passing a `BoardState` with highlights, arrows, lastMove, and a caption via the bridge renders them correctly
- [ ] Board flips when `orientation` is `"black"`

---

## Phase 4 — UI resource registration and ChatGPT wiring

### Overview

Build the widget, let the MCP server register and serve it as an MCP Apps UI resource, and wire the tool descriptor so ChatGPT loads the iframe when `show_position` is called.

### Widget build approach

Do not use Vite HMR inside ChatGPT. The Vite dev server is for local browser development only.

For ChatGPT integration:

1. Build the widget: `npm run build -w web` → outputs to `web/dist/`
2. The MCP server serves `web/dist/` as static assets
3. Register the built `index.html` as the MCP Apps UI resource
4. Test in ChatGPT through the tunnel

### Changes required

#### 1. `server/src/index.ts` — serve static widget assets

Serve `web/dist/` as static files on the same HTTP server (e.g. via a static middleware on the existing Express/Hono/Node HTTP instance). No separate port needed.

#### 2. UI resource registration

Use `registerAppResource` from `@modelcontextprotocol/ext-apps/server`:

```ts
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

registerAppResource(server, {
  uri: `${PUBLIC_BASE_URL}/widget/`,
  mimeType: RESOURCE_MIME_TYPE, // "text/html;profile=mcp-app"
  // _meta.ui.csp set below
});
```

#### 3. Tool registration

Use `registerAppTool` from `@modelcontextprotocol/ext-apps/server` to declare the `show_position` tool with a reference to the registered UI resource. The SDK links the tool and the resource in the tool descriptor metadata.

#### 4. CSP via `_meta.ui.csp`

CSP for the widget resource is declared in the resource metadata using `_meta.ui.csp`, not via HTTP headers.

Start maximally restrictive for v0:

```ts
_meta: {
  ui: {
    csp: {
      // add connectDomains only if widget needs to fetch anything
      // add resourceDomains only if widget loads external assets
      // do not add frameDomains unless widget embeds sub-iframes
    }
  }
}
```

Bundle all widget code and assets. Do not load external scripts, fonts, or stylesheets in v0.

### Success criteria

- [ ] `show_position` tool descriptor includes the UI resource metadata
- [ ] ChatGPT Developer Mode loads the connector without errors
- [ ] Calling `show_position` from ChatGPT renders the widget iframe
- [ ] The widget receives and displays the `BoardState` from the tool result

---

## Phase 5 — Integration test through tunnel

### Overview

End-to-end verification through Microsoft Dev Tunnel.

### Steps

1. Build the widget: `npm run build -w web`
2. Start the MCP server: `npm run start -w server` (serves widget from `web/dist/` on port 8787)
3. Expose port 8787 via Microsoft Dev Tunnel
4. Set `PUBLIC_BASE_URL=https://<tunnel-host>` in `server/.env`
5. Configure ChatGPT Developer Mode connector: `https://<tunnel-host>/mcp`
6. Test prompts:
   - "Show the standard chess starting position." — expect starting FEN, no annotations
   - "Show the position after 1. e4, with an arrow from e2 to e4 and the caption 'After 1.e4'." — expect annotated position
   - "Show the position with orientation black." — expect flipped board

### Success criteria

- [ ] ChatGPT Developer Mode connects to the tunnel without errors
- [ ] All three test prompts render correct boards
- [ ] Invalid input (bad FEN, bad square) returns a clear error in the chat
- [ ] Caption > 240 chars returns a clear error in the chat
- [ ] No tunnel URL or machine-specific value is committed to git

---

## Testing strategy

### Type checking

```
npm run typecheck
```

Runs across all three workspaces. Must pass with zero errors.

### Manual validation (per phase)

Each phase has its own success criteria checklist above.

### No automated test framework in v0

Do not add Jest, Vitest, or similar in v0 unless the tool validation logic grows complex enough to justify it.
The type system and manual integration testing are sufficient for the first vertical slice.

---

## Resolved implementation choices

| Decision | Choice |
|---|---|
| MCP SDK | `@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps` + `zod` |
| UI resource helpers | `registerAppResource`, `registerAppTool`, `RESOURCE_MIME_TYPE` from `@modelcontextprotocol/ext-apps/server` |
| Rendering model | Registered MCP Apps UI resource; widget served from `web/dist/` |
| Tool output format | `structuredContent` in tool result |
| Widget input | `window.addEventListener("message")` → `ui/notifications/tool-result` → `params.structuredContent` |
| Transport | HTTP MCP endpoint at `/mcp` via Dev Tunnel |
| CSP | `_meta.ui.csp` in resource metadata; bundle all assets; no external fetching |
| Dev widget | Vite dev server for local browser work; built bundle for ChatGPT testing |
| State | None |

---

## Implementation sequence

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Each phase should be verified before starting the next.
Do not start Phase 4 until Phase 2 and Phase 3 both pass their success criteria independently.
