# SVG Fallback for Universal MCP Clients

## Overview

`show_position` currently returns only structured JSON (`structuredContent: BoardState`). ChatGPT renders the widget as an iframe using `window.openai.toolOutput`, but all other MCP clients (VS Code Copilot, Claude.ai, etc.) show no visual output at all.

The MCP spec supports `{ type: "image", data: "<base64>", mimeType: "..." }` items in the `content` array. Most AI clients render these as inline images. This plan adds a server-side SVG board renderer so every MCP client gets a visual chessboard, while the ChatGPT iframe flow is completely unchanged.

## Current State Analysis

- `server/src/tools/show-position.ts` — validates input, returns `BoardState`. No rendering.
- `server/src/index.ts` — tool handler returns `{ content: [{ type: "text", text: "Rendering chess board." }], structuredContent: boardState }`.
- `chess.js` is already a dependency (`server/package.json`). Its `board()` method returns an 8×8 array of piece positions directly from a FEN string — no additional parsing needed.
- No new dependencies are required. SVG is a string; `Buffer.from().toString("base64")` is built into Node.

## `includeSvg` Design Decision

SVG generation is cheap (< 1 ms, pure string ops, ~15 KB base64), but ChatGPT users already have the iframe widget and get no benefit from the image item. Rather than server-side client detection, we expose an optional `includeSvg` parameter:

- **Default: `true`** — all clients get an inline board image with no configuration.
- **ChatGPT** reads the tool description and sets `includeSvg: false` on its own, since it knows it has the widget. The model is smart enough to self-select.
- No env vars, no headers, no detection logic. The model decides.

The parameter lives only in the Zod schema in `index.ts`. It is **not** added to `ShowPositionInput` or `BoardState` — it is a transport concern, not a board-state concern.

## Desired End State

1. Every `show_position` call with `includeSvg` omitted or `true` includes an `image/svg+xml` item in `content`.
2. Calls with `includeSvg: false` return only `{ type: "text" }` in `content` (ChatGPT path).
3. The SVG faithfully renders the FEN position with: board squares, coordinate labels, pieces (Unicode chess symbols), highlighted squares, last-move squares, and arrows with arrowheads.
4. Caption appears below the board when non-empty.
5. Orientation (`white`/`black`) flips the board correctly.
6. The `structuredContent: BoardState` contract is unchanged.
7. `npm run typecheck` passes with zero errors.
8. Smoke-test: `curl ... | jq '.result.content[0].type'` returns `"image"` and the base64 decodes to valid SVG.

## What We Are NOT Doing

- No drag/drop or interactivity in the image (static SVG only).
- Arrow labels are not rendered in the SVG (they are a ChatGPT-widget-only feature).
- No new npm packages. No canvas, Puppeteer, Playwright, or headless browser.
- No changes to `BoardState` types, `ShowPositionInput`, or the shared package.
- No changes to the ChatGPT widget (`web/`).
- No changes to the MCP resource registration.
- No server-side client detection — the calling model decides via `includeSvg`.

## Implementation Approach

One new file (`render-svg.ts`) exports a single pure function. The tool handler in `index.ts` calls it after `showPosition()` succeeds and prepends the image item to `content`.

The SVG uses an 800×800 coordinate space for the board (100px per square) plus a 100px caption strip below, giving a `viewBox="0 0 800 900"`. All rendering is done with basic SVG primitives — `<rect>`, `<text>`, `<line>`, and `<marker>`.

---

## Phase 1: `render-svg.ts` — Pure SVG Generator

### Overview

Create `server/src/tools/render-svg.ts` that converts a `BoardState` to an SVG string. No side effects, no I/O.

### Changes Required

#### 1. New file `server/src/tools/render-svg.ts`

```ts
import { Chess } from "chess.js";
import type { BoardState, Square } from "@blunder-lens/shared";

// ── Constants ──────────────────────────────────────────────────────────────

const SQUARE_SIZE = 100;
const BOARD_SIZE = SQUARE_SIZE * 8; // 800
const CAPTION_HEIGHT = 100;
const TOTAL_HEIGHT = BOARD_SIZE + CAPTION_HEIGHT; // 900

const LIGHT = "#f0d9b5";
const DARK = "#b58863";
const HIGHLIGHT_COLOR = "rgba(255,215,0,0.5)";
const LAST_MOVE_COLOR = "rgba(20,150,255,0.4)";
const ARROW_COLOR = "rgba(0,0,200,0.7)";
const CAPTION_COLOR = "#333333";
const LABEL_COLOR = "#888888";

const PIECE_UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

// ── Coordinate helpers ─────────────────────────────────────────────────────

// Returns top-left SVG pixel of a square name, given orientation.
function squareToXY(sq: Square, orientation: "white" | "black"): { x: number; y: number } {
  const fileIndex = sq.charCodeAt(0) - 97; // 'a'=0 … 'h'=7
  const rankIndex = parseInt(sq[1], 10) - 1; // '1'=0 … '8'=7
  if (orientation === "white") {
    return { x: fileIndex * SQUARE_SIZE, y: (7 - rankIndex) * SQUARE_SIZE };
  } else {
    return { x: (7 - fileIndex) * SQUARE_SIZE, y: rankIndex * SQUARE_SIZE };
  }
}

function squareCenter(sq: Square, orientation: "white" | "black"): { cx: number; cy: number } {
  const { x, y } = squareToXY(sq, orientation);
  return { cx: x + SQUARE_SIZE / 2, cy: y + SQUARE_SIZE / 2 };
}

// ── SVG helpers ────────────────────────────────────────────────────────────

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Main export ────────────────────────────────────────────────────────────

export function renderBoardSvg(state: BoardState): string {
  const { fen, orientation, highlights, lastMove, arrows, caption } = state;
  const chess = new Chess(fen);
  const board = chess.board(); // board[rowIdx][colIdx], rowIdx 0 = rank 8

  const parts: string[] = [];

  // 1. Board squares
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isLight = (row + col) % 2 === 0;
      // In chess.js board(): row 0 = rank 8 (top in white orientation), col 0 = file a
      // SVG position depends on orientation
      const svgX = orientation === "white" ? col * SQUARE_SIZE : (7 - col) * SQUARE_SIZE;
      const svgY = orientation === "white" ? row * SQUARE_SIZE : (7 - row) * SQUARE_SIZE;
      parts.push(rect(svgX, svgY, SQUARE_SIZE, SQUARE_SIZE, isLight ? LIGHT : DARK));
    }
  }

  // 2. Last-move highlight (behind piece, above board color)
  if (lastMove) {
    for (const sq of [lastMove.from, lastMove.to] as Square[]) {
      const { x, y } = squareToXY(sq, orientation);
      parts.push(rect(x, y, SQUARE_SIZE, SQUARE_SIZE, LAST_MOVE_COLOR));
    }
  }

  // 3. Highlights
  for (const sq of highlights) {
    const { x, y } = squareToXY(sq, orientation);
    parts.push(rect(x, y, SQUARE_SIZE, SQUARE_SIZE, HIGHLIGHT_COLOR));
  }

  // 4. Pieces
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = board[row][col];
      if (!cell) continue;
      const key = `${cell.color}${cell.type.toUpperCase()}`;
      const glyph = PIECE_UNICODE[key];
      if (!glyph) continue;
      const svgX = orientation === "white" ? col * SQUARE_SIZE : (7 - col) * SQUARE_SIZE;
      const svgY = orientation === "white" ? row * SQUARE_SIZE : (7 - row) * SQUARE_SIZE;
      const cx = svgX + SQUARE_SIZE / 2;
      const cy = svgY + SQUARE_SIZE * 0.72; // baseline offset for chess glyphs
      parts.push(
        `<text x="${cx}" y="${cy}" font-size="72" text-anchor="middle" font-family="serif" fill="#222">${glyph}</text>`
      );
    }
  }

  // 5. Arrows
  if (arrows.length > 0) {
    const SHORTEN = 18; // px to pull back from target center so arrowhead is visible
    const arrowDefs = `<defs>
  <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
    <path d="M0,0 L0,6 L6,3 z" fill="${ARROW_COLOR}"/>
  </marker>
</defs>`;
    parts.push(arrowDefs);
    for (const arrow of arrows) {
      const { cx: x1, cy: y1 } = squareCenter(arrow.from as Square, orientation);
      const { cx: x2, cy: y2 } = squareCenter(arrow.to as Square, orientation);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;
      const ex = x2 - (dx / len) * SHORTEN;
      const ey = y2 - (dy / len) * SHORTEN;
      parts.push(
        `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${ARROW_COLOR}" stroke-width="8" stroke-linecap="round" marker-end="url(#arrowhead)"/>`
      );
    }
  }

  // 6. Coordinate labels
  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const fileLabels = orientation === "white" ? FILES : [...FILES].reverse();
  const rankLabels = orientation === "white" ? [...RANKS].reverse() : RANKS;

  for (let i = 0; i < 8; i++) {
    // File labels along bottom edge
    const fx = i * SQUARE_SIZE + SQUARE_SIZE / 2;
    parts.push(
      `<text x="${fx}" y="${BOARD_SIZE - 4}" font-size="14" text-anchor="middle" fill="${LABEL_COLOR}" font-family="sans-serif">${fileLabels[i]}</text>`
    );
    // Rank labels along left edge
    const ry = i * SQUARE_SIZE + SQUARE_SIZE / 2 + 5;
    parts.push(
      `<text x="6" y="${ry}" font-size="14" text-anchor="start" fill="${LABEL_COLOR}" font-family="sans-serif">${rankLabels[i]}</text>`
    );
  }

  // 7. Caption
  if (caption) {
    const escaped = esc(caption);
    // Wrap long captions at ~80 chars per line using tspan elements
    const words = escaped.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > 80 && current.length > 0) {
        lines.push(current.trim());
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) lines.push(current.trim());

    const lineHeight = 22;
    const totalTextH = lines.length * lineHeight;
    const startY = BOARD_SIZE + (CAPTION_HEIGHT - totalTextH) / 2 + lineHeight;

    const tspans = lines
      .map((line, i) => `<tspan x="400" dy="${i === 0 ? 0 : lineHeight}">${line}</tspan>`)
      .join("");
    parts.push(
      `<text x="400" y="${startY}" font-size="18" text-anchor="middle" fill="${CAPTION_COLOR}" font-family="sans-serif">${tspans}</text>`
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_SIZE} ${TOTAL_HEIGHT}" width="${BOARD_SIZE}" height="${TOTAL_HEIGHT}">`,
    ...parts,
    `</svg>`,
  ].join("\n");
}
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck -w server` passes with zero errors.

#### Manual Verification:
- [ ] The function can be called with `{ fen: "startpos FEN", orientation: "white", highlights: [], arrows: [], lastMove: null, caption: "" }` and returns a string starting with `<svg`.
- [ ] The string is valid SVG (paste into browser, all 32 pieces visible in starting position).

---

## Phase 2: Wire SVG into `show_position` Tool Response

### Overview

Modify the tool handler in `server/src/index.ts` to:
1. Add `includeSvg?: boolean` to the Zod input schema with a description that tells ChatGPT to pass `false`.
2. Conditionally call `renderBoardSvg` and prepend the image content item.

### Changes Required

#### 1. Import `renderBoardSvg` in `server/src/index.ts`

Add to the existing imports near the top of the file:

```ts
import { renderBoardSvg } from "./tools/render-svg.js";
```

#### 2. Add `includeSvg` to the Zod input schema

In the `showPositionInputSchema` object, add:

```ts
includeSvg: z.boolean().optional().describe(
  "Whether to include an SVG board image in the response. "
  + "Defaults to true — omit this parameter unless you are running inside ChatGPT with the chessboard widget available, "
  + "in which case set includeSvg: false (the widget renders the position; the image is redundant)."
),
```

#### 3. Replace the tool handler's `content` in the success path

**Current code** (inside the `async (args) => {` handler):
```ts
return {
  content: [{ type: "text", text: "Rendering chess board." }],
  structuredContent: boardState as unknown as Record<string, unknown>,
};
```

**New code**:
```ts
const contentItems: Array<{ type: string; [key: string]: unknown }> = [];
if (args.includeSvg !== false) {
  const svg = renderBoardSvg(boardState);
  const b64 = Buffer.from(svg).toString("base64");
  contentItems.push({ type: "image", data: b64, mimeType: "image/svg+xml" });
}
contentItems.push({ type: "text", text: "Rendering chess board." });
return {
  content: contentItems,
  structuredContent: boardState as unknown as Record<string, unknown>,
};
```

### Success Criteria

#### Automated Verification:
- [x] `npm run typecheck` (all workspaces) passes with zero errors.
- [x] `npm run build -w server` compiles without errors.

#### Manual Verification (smoke test):
```bash
# Terminal 1
npm run build -w server && node server/dist/index.js

# Terminal 2
curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"show_position","arguments":{}}}' \
  | jq '.result.content[0].type'
# Expected: "image"

curl -s -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"show_position","arguments":{}}}' \
  | jq -r '.result.content[0].data' | base64 -d | head -c 100
# Expected: starts with <svg
```

- [ ] Paste decoded SVG into a browser — starting position renders correctly.
- [ ] Call with `highlights`, `arrows`, `lastMove`, `caption` — all appear in the SVG.
- [ ] Call with `orientation: "black"` — board is flipped, a1 in top-right.

---

## Testing Strategy

### Unit-level (manual, no test runner required):

1. Render starting position (white orientation) → verify all 32 pieces visible.
2. Render `e4` position with `lastMove: { from: "e2", to: "e4" }` → e2 and e4 have blue tint.
3. Render with `highlights: ["e4", "d5"]` → those squares have gold tint.
4. Render with `arrows: [{ from: "e2", to: "e4" }]` → arrow visible on board.
5. Render with `orientation: "black"` → board flipped.
6. Render with long caption (>80 chars) → text wraps to multiple lines below board.
7. Render with `caption: ""` — no extra whitespace below board.
8. Render with `caption` containing `<>&` chars → HTML-escaped in SVG output.

### Regression:
- `structuredContent` shape is unchanged — existing ChatGPT widget must still work.
- The text content item is still present (second in array) so text-only clients still work.

## Performance Considerations

SVG generation is synchronous and CPU-only. For a 64-square board the string is roughly 8–12 KB. Base64 encoding adds ~33%. Total per-call overhead is negligible (< 1 ms on any modern CPU).

## Migration Notes

No existing data or clients need migration. ChatGPT ignores `content` when it renders the iframe; adding an `image` item before the `text` item does not break that flow.
- Orientering (`black`-nedenfra) støttes: roter koordinatene ved rendering
- Ingen eksterne fontavhengigheter — Unicode-tegn støttes i alle moderne renderers

## Akseptansekriterier

1. `npm run typecheck` passerer uten feil
2. Kall til `show_position` via VS Code Copilot Chat viser et synlig sjakkbrett inline
3. FEN-posisjon matcher brettet visuelt
4. Highlights og lastMove vises med korrekte farger
5. Piler tegnes mellom riktige ruter
6. Caption vises under brettet
7. `orientation: "black"` roterer brettet korrekt
8. ChatGPT-widget-flyten er upåvirket (eksisterende integrasjonstest bestått)

## Estimert omfang

| Del                  | Omfang         |
|----------------------|----------------|
| `render-svg.ts`      | ~250 linjer    |
| Endring i `index.ts` | ~5 linjer      |
| Tester               | ~50 linjer     |
| **Totalt**           | **~300 linjer**|

## Avhengigheter

- `chess.js` (allerede installert) — for `board()`-array fra FEN
- Node.js `Buffer` — for base64-encoding
- Ingen nye pakker

## Rekkefølge

1. Implementer `render-svg.ts` med brettruter og brikker
2. Legg til highlights og lastMove
3. Legg til piler
4. Legg til caption og koordinatlabels
5. Integrer i `show_position`-returverdi
6. Manuell visuell test via VS Code Copilot Chat
7. Skriv enhetstester for SVG-output
