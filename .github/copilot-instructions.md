# Copilot instructions for blunder-lens

This repository is `blunder-lens`.

It is a private ChatGPT app for visualizing chess positions inside ChatGPT conversations.

Core idea: give ChatGPT a chessboard.

## Current goal

Build the smallest possible vertical slice first:

1. A local TypeScript/Node MCP server.
2. One tool: `show_position`.
3. The tool returns structured board state for a single chess position.
4. A React/Vite widget renders that position as a chessboard inside ChatGPT.
5. The app works through a public HTTPS development tunnel.

Do not add PGN parsing, Stockfish, persistence, authentication, user accounts, multiplayer, or game-playing mode until the first vertical slice works.

## Architecture

Use:

- TypeScript throughout.
- Node.js for the MCP server.
- React + Vite + TypeScript for the iframe widget.
- Shared TypeScript types for board state.
- `chess.js` for chess rules, FEN, legal moves, and later PGN support.

Expected repo shape:

```text
server/
  src/

web/
  src/

shared/
  src/
```

The server owns validation and chess legality.

The model explains and discusses chess, but must not be treated as the rules engine.

## Product boundary

`blunder-lens` is a stateless visual instrument for ChatGPT, not a full chess app.

The chat handles:

- Candidate moves
- Choices
- Comparisons
- Pedagogical flow
- User decisions

The widget handles:

- Rendering one board state
- Highlighting squares
- Drawing arrows
- Showing last move
- Showing a caption

Do not build multiple boards, a candidate selector, variation tree, or move navigation in v0.

## State model

v0 must be stateless.

The MCP server must not rely on hidden conversation state, session state, or previously called tools to render a board.

Every `show_position` call must contain enough information to render the requested board.

`fen` is authoritative.

The server may validate and normalize input, but it must not maintain a hidden "current board" or "current game" in v0.

Later versions may introduce explicit state handles such as `gameId` or `boardId`, but not implicit server state.

Widget interactions may report user intent in a later version, but must not become the source of truth.

## JSON contract

The first MCP tool is `show_position`.

It renders exactly one chessboard state. It does not manage game trees, candidate choices, move navigation, or gameplay.

### TypeScript types

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
  fen?: string; // valid FEN or "startpos"; defaults to start position
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

### Semantics

- `fen` is authoritative.
- The widget must render the exact position described by `fen`.
- `lastMove`, `highlights`, and `arrows` are annotations only.
- Annotations must not modify the position.
- If input `fen` is omitted or equals `"startpos"`, normalize it to the standard chess starting FEN.
- Reject invalid FEN.
- Reject invalid square names.
- `orientation` defaults to `"white"`.
- `caption` defaults to empty string.
- `highlights` defaults to empty array.
- `arrows` defaults to empty array.
- `lastMove` defaults to `null`.
- Do not include `undefined` in output. Use empty arrays and `null`.

### Minimal input

```json
{}
```

### Normalized output

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

### Annotated example

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

## Development rules

- Keep changes small and reviewable.
- Prefer a working minimal implementation over broad architecture.
- Do not introduce databases, queues, cloud deployment, auth providers, or complex state management in v0.
- Do not add OpenAI API calls from this app in v0. ChatGPT is already the model; the app should expose tools and UI.
- Do not store secrets in the repository.
- Do not commit tunnel URLs or machine-specific values.
- Use environment variables or local config files ignored by git for local settings.
- Prefer clear names over clever abstractions.
- Avoid adding frameworks unless needed for the first vertical slice.

## Validation

For every meaningful change:

1. Run typecheck.
2. Run tests if present.
3. Run lint/format if configured.
4. Start the local server/widget if runtime behavior changed.
5. Report what passed or failed.

Do not claim the ChatGPT integration works until it has been tested through Developer Mode with the HTTPS tunnel.

## Non-goals for now

Do not implement:

- PGN parsing
- Stockfish
- Persistence
- Authentication
- User accounts
- Multiplayer
- Game-playing mode
- Public marketplace/app directory submission
- Multiple boards
- Candidate move selector
- Variation tree
- Move navigation
- Drag/drop moves
- Production deployment

## Suggested first Copilot task

Read `README.md`, `PROJECT.md`, and `.github/copilot-instructions.md`.

Create the initial TypeScript monorepo skeleton for `blunder-lens`.

Do not implement PGN parsing, Stockfish, persistence, auth, or gameplay.

Focus only on the first vertical slice:

- shared `BoardState` type
- Node/TypeScript MCP server with a `show_position` tool
- React/Vite widget that can render a FEN position
- support for highlights, arrows, lastMove, and caption
- npm scripts for typecheck and local development

Keep the implementation minimal and explain how to run it.
