# Session handover — blunder-lens v0 vertical slice

## Plan file
`thoughts/shared/plans/001_v0_vertical_slice.md`

## Status

### Phase 1 — Monorepo scaffold and shared types ✅
All files in place. `npm run typecheck -w shared` passes.

### Phase 2 — MCP server ✅ (code complete, not runtime-verified yet)
Files created:
- `server/tsconfig.json` — with `references: [../shared]`
- `server/.env.example`
- `server/src/tools/show-position.ts` — validates FEN via chess.js, normalises BoardState
- `server/src/index.ts` — Node http server on PORT (default 8787), `/mcp` via StreamableHTTPServerTransport (stateless), `/widget/*` static file serving from `web/dist/`, registers MCP resource + `show_position` tool

Key implementation notes:
- `RESOURCE_URI_META_KEY` and `RESOURCE_MIME_TYPE` are imported from `@modelcontextprotocol/ext-apps` (the root export — there is NO `/server` sub-export in the installed 0.1.0 package)
- `mcpServer.registerTool` returns `structuredContent: boardState` + `_meta: { [RESOURCE_URI_META_KEY]: WIDGET_URL }` in the tool result
- Transport is stateless (`sessionIdGenerator: undefined`); a new transport instance is created per request

### Phase 3 — React/Vite widget ✅ (code complete, not runtime-verified yet)
Files created:
- `web/tsconfig.json`
- `web/vite.config.ts`
- `web/index.html`
- `web/src/main.tsx`
- `web/src/App.tsx` — uses `useApp` + `McpUiToolResultNotificationSchema` from `@modelcontextprotocol/ext-apps/react`
- `web/src/ChessBoard.tsx` — `react-chessboard`, highlights, arrows, lastMove, caption, orientation flip

### Phase 4 — UI resource registration ✅ (wired into Phase 2 server)
- Resource registered at `${PUBLIC_BASE_URL}/widget/` with `mimeType: RESOURCE_MIME_TYPE`
- Tool result includes `_meta[RESOURCE_URI_META_KEY]` pointing to widget URL

### Phase 5 — Integration test through tunnel ❌ NOT STARTED

## Typecheck status
`npm run typecheck` (all workspaces) — **passes with zero errors**

## What needs to happen next

1. **Build and smoke-test the server** (now easiest from VS Code Remote WSL):
   ```bash
   npm run build -w shared
   npm run build -w server
   npm run start -w server
   # In another terminal:
   curl -X POST http://localhost:8787/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"show_position","arguments":{}}}'
   # Expect: BoardState JSON with starting FEN in structuredContent
   ```

2. **Test the widget locally**:
   ```bash
   npm run dev -w web
   # Open http://localhost:5173 — should show starting position chessboard
   ```

3. **Build the widget and test it served from the server**:
   ```bash
   npm run build -w web
   # Then with server running: open http://localhost:8787/widget/
   ```

4. **Phase 5 — tunnel test**:
   - Copy `server/.env.example` → `server/.env`
   - Start a Microsoft Dev Tunnel on port 8787
   - Set `PUBLIC_BASE_URL=https://<tunnel-host>` in `server/.env`
   - Restart server: `npm run start -w server`
   - In ChatGPT Developer Mode, add connector: `https://<tunnel-host>/mcp`
   - Test prompts from plan Phase 5

## Known issues / things to watch
- `server/src/index.ts` creates a new `McpServer` instance at module load and calls `mcpServer.server.connect(transport)` per request. The MCP SDK's `McpServer` wraps a `Server`; verify that calling `.connect()` multiple times on the same underlying `Server` is safe for stateless mode. If not, create a new `McpServer` per request.
- `@modelcontextprotocol/ext-apps` version 0.1.0 is installed. The plan referenced a `/server` sub-export that does not exist — the actual helpers (`RESOURCE_URI_META_KEY`, `RESOURCE_MIME_TYPE`) come from the root `.` export.
- `web/src/App.tsx` imports `McpUiToolResultNotificationSchema` from `@modelcontextprotocol/ext-apps/react` — verify this export exists at runtime (it re-exports from `../app` which re-exports from `./types`).

## File tree (new files only)
```
server/
  tsconfig.json
  .env.example
  src/
    index.ts
    tools/
      show-position.ts
web/
  index.html
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    ChessBoard.tsx
shared/
  tsconfig.json   ← added "composite": true
```
