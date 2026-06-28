# blunder-lens project notes

Give ChatGPT a chessboard — and a better view of your blunders.

## Purpose

`blunder-lens` is a private ChatGPT app for visualizing and discussing chess positions inside ChatGPT conversations.

The motivating problem is that chess discussion in plain text is hard to follow when the user does not easily visualize positions mentally.

The app should make the conversation visual.

## Product thesis

The app is not trying to be another Lichess or Chess.com analysis board.

The product value is:

> A conversational chess discussion where the board follows the conversation.

The user should be able to paste or discuss a game or position and ask natural questions such as:

- What is black threatening here?
- Why was this move inaccurate?
- Show this position.
- What should I have seen?
- Mark the weak squares.
- Show the alternative idea on the board.

## Core framing

`blunder-lens` is a stateless visual instrument for the conversation, not a chess app with its own memory.

The board should not become a mini-Lichess in v0.

The app should be more like a visual sense for ChatGPT:

- ChatGPT handles explanation.
- ChatGPT handles alternatives and choices in the chat.
- The widget renders one position with optional visual annotations.
- The server validates and normalizes the request.
- The app does not maintain a hidden current game or current board.

## MVP

The MVP is not PGN import, Stockfish, or game play.

The first MVP is:

> ChatGPT calls a private app tool and a chessboard appears inside the conversation.

Initial vertical slice:

1. User asks ChatGPT to show a chess position.
2. ChatGPT calls the MCP tool `show_position`.
3. The MCP server returns structured board state.
4. The ChatGPT iframe widget renders the board.

## v0 features

- Show the standard starting position if no FEN is provided.
- Show arbitrary valid FEN.
- Support board orientation.
- Support optional highlighted squares.
- Support optional arrows.
- Support optional last move.
- Show a short caption.

## v0 tool

The first tool is:

```text
show_position
```

Purpose:

```text
Render exactly one chessboard state with optional visual annotations so ChatGPT can explain chess positions visually inside the conversation.
```

The chat handles:

- Candidate moves
- Choices
- Comparisons
- Pedagogical flow
- Natural-language interaction

The widget handles:

- Board rendering
- Highlights
- Arrows
- Last-move indication
- Caption display

## State model

v0 must be stateless.

Every `show_position` call must contain enough information to render the requested board.

The server must not rely on:

- Hidden conversation state
- Session state
- Previously called tools
- A stored current board
- A stored current game

The server may validate and normalize input, but it must not maintain hidden app state in v0.

Later versions may introduce explicit state handles such as `gameId` or `boardId`, but not implicit server state.

## Authoritative data

The FEN is authoritative.

The widget must render the exact position described by `fen`.

`lastMove`, `highlights`, and `arrows` are annotations only.

Annotations must not modify the position.

## Interaction model

In v0, the widget does not need to send interactions back to ChatGPT.

In a later v0.5, widget interactions may report user intent, but must not become the source of truth.

Potential future events:

```ts
type WidgetEvent =
  | { type: "square_selected"; square: Square; currentFen: string }
  | { type: "arrow_selected"; from: Square; to: Square; currentFen: string }
  | { type: "annotation_selected"; id: string; currentFen: string }
  | { type: "request_explanation"; topic: "position" | "lastMove" | "highlightedSquares"; currentFen: string };
```

Every event should include enough context to be understood standalone.

Conceptually, a widget event is equivalent to the user writing the same choice or question directly in chat.

## JSON contract

### TypeScript model

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
  fen?: string; // valid FEN or "startpos"; defaults to the standard starting position
  orientation?: "white" | "black"; // defaults to "white"
  caption?: string; // max 240 chars
  highlights?: Square[];
  arrows?: BoardArrow[];
  lastMove?: BoardMove | null;
}

export interface BoardState {
  fen: string; // normalized valid FEN; never "startpos"
  orientation: "white" | "black";
  caption: string;
  highlights: Square[];
  arrows: BoardArrow[];
  lastMove: BoardMove | null;
}
```

### Input semantics

`ShowPositionInput`:

```json
{
  "fen": "string | optional",
  "orientation": "white | black | optional",
  "caption": "string | optional",
  "highlights": ["e4", "d5"],
  "arrows": [
    {
      "from": "g1",
      "to": "f3",
      "label": "optional string"
    }
  ],
  "lastMove": {
    "from": "e2",
    "to": "e4"
  }
}
```

Rules:

- `fen` is optional.
- If `fen` is omitted or equals `"startpos"`, normalize to the standard chess starting FEN.
- Output must never contain `"startpos"` as FEN.
- `orientation` defaults to `"white"`.
- `caption` defaults to empty string.
- `highlights` defaults to empty array.
- `arrows` defaults to empty array.
- `lastMove` defaults to `null`.
- Reject invalid FEN.
- Reject invalid square names.
- Reject `caption` longer than 240 characters. Do not truncate silently.
- Do not include `undefined` in output.
- Use empty arrays and `null`.

### Normalized output example

Input:

```json
{}
```

Output:

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "orientation": "white",
  "caption": "",
  "highlights": [],
  "arrows": [],
  "lastMove": null
}
```

### Annotated output example

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
  "orientation": "white",
  "caption": "After 1. e4, White controls central squares and opens lines for the bishop and queen.",
  "arrows": [
    {
      "from": "e2",
      "to": "e4",
      "label": "1.e4"
    }
  ],
  "highlights": ["e4", "d5", "f5"],
  "lastMove": {
    "from": "e2",
    "to": "e4"
  }
}
```

## Later features

After the first vertical slice works:

1. Show arbitrary FEN.
2. Add better visual styling.
3. Add widget-to-chat events.
4. Load PGN statelessly by sending PGN and move index.
5. Navigate to move by returning a new board state.
6. Highlight last move.
7. Mark squares and arrows from model explanations.
8. Return legal moves.
9. Add simple game-playing mode.
10. Add Stockfish only after the conversation-board loop feels useful.

## Design principles

- Keep v0 brutally small.
- The app owns board validation.
- ChatGPT explains; the app validates.
- Prefer visual explanations over long text.
- Avoid building a general chess platform.
- Avoid premature persistence.
- Avoid premature authentication.
- Avoid premature engine analysis.
- Do not add OpenAI API calls from this app in v0. ChatGPT is already the model.

## Architecture direction

Use TypeScript across the repo.

Suggested structure:

```text
server/
  src/
    index.ts
    tools/
    resources/

web/
  src/
    App.tsx
    ChessBoard.tsx

shared/
  src/
    board-state.ts
```

Recommended libraries:

- Node.js
- TypeScript
- React
- Vite
- chess.js
- A React chessboard component, unless drawing the board manually is simpler for the first version

## Development tunnel

During development, expose the local MCP server using Microsoft Dev Tunnel.

The ChatGPT Developer Mode connector/app should point to the public HTTPS tunnel URL for the MCP endpoint.

The tunnel URL should not be committed to git.

## ChatGPT Apps rendering model

Use the official ChatGPT Apps SDK / MCP Apps UI model.

The selected rendering approach is:

1. The MCP server registers a UI resource/template for the chessboard widget.
2. The `show_position` tool descriptor points to that UI resource using Apps SDK/MCP Apps metadata.
3. The `show_position` tool returns `BoardState` as `structuredContent`.
4. ChatGPT loads the registered widget resource in an iframe.
5. The widget receives tool results through the MCP Apps bridge and renders from `structuredContent`.

Do not encode board state into widget URLs.
Do not use base64 URL parameters for BoardState.
Do not rely on ChatGPT instructions to construct widget URLs.
Do not build a separate frontend-backend fetch protocol in v0.

The widget renders from the latest tool result.

## MCP transport

Use HTTP transport for ChatGPT integration.

Local development endpoint:

```text
http://localhost:${PORT}/mcp
```

ChatGPT Developer Mode endpoint:

```text
https://<dev-tunnel-host>/mcp
```

Do not use stdio transport. stdio does not work through an HTTPS tunnel.

Do not hardcode the HTTP vs SSE implementation detail unless the chosen SDK requires it.
Specify the endpoint as an HTTP MCP endpoint and let the SDK negotiate the transport layer.

## Monorepo structure

Use npm workspaces.

Root `package.json` declares workspaces and owns common scripts (`typecheck`, `lint`, `build`).

```text
package.json        ← workspace root
server/
  package.json
  src/
    index.ts
    tools/
    resources/
web/
  package.json
  src/
    App.tsx
    ChessBoard.tsx
shared/
  package.json
  src/
    board-state.ts
```

`server` and `web` consume `shared` as a workspace dependency.
Do not use `npm link`, symlinks, or path aliases as substitutes.

## Chessboard component

Arrows and square highlights are the primary visual feature of v0.
Drag-and-drop is a non-goal.

Prefer a lightweight React chessboard component that supports:

- FEN rendering
- Custom square overlays (highlights)
- Custom arrow rendering

If arrow or overlay rendering requires significant workarounds, draw the board manually as a CSS grid with an SVG overlay layer.

Do not invest time in drag-and-drop interaction.

## Configuration and environment variables

Required environment variables:

```text
PORT=8787
PUBLIC_BASE_URL=https://<dev-tunnel-host>
```

`PUBLIC_BASE_URL` is used for MCP app metadata, UI resource URIs, and CSP headers when absolute URLs are required.

Do not introduce a separate `WIDGET_BASE_URL`. The server hosts both the MCP endpoint and the widget UI resource unless the SDK explicitly requires them to be separate.

Store environment variables in a local `.env` file. Add `.env` to `.gitignore`. Do not commit tunnel URLs or machine-specific values.

## CSP and UI resource registration

The widget HTML resource must be registered as an MCP app UI resource with the server.

Use MIME type:

```text
text/html;profile=mcp-app
```

The `show_position` tool descriptor must include the metadata that points ChatGPT to the registered UI resource.

Keep CSP as restrictive as possible while allowing bundled widget assets.

Bundle all widget dependencies. Do not load external scripts, fonts, or stylesheets from CDNs in v0.

Do not open CORS broadly. The widget receives board state through the MCP Apps bridge, not by fetching the server directly.

## ChatGPT Developer Mode setup

Manual steps to connect the local server to ChatGPT:

1. Start the local MCP server (`npm run dev` from `server/`).
2. Expose it through Microsoft Dev Tunnel.
3. In ChatGPT Developer Mode, configure the connector with:
   ```
   https://<dev-tunnel-host>/mcp
   ```
4. No OAuth or authentication in v0.
5. Refresh the connector in ChatGPT after any change to tool schemas, resource metadata, or tool descriptors.
6. Verify integration with the prompt:
   ```
   Show the standard chess starting position.
   ```

Do not commit the tunnel URL. Do not hardcode it in any source file.