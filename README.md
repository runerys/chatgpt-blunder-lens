# blunder-lens

Give ChatGPT a chessboard — and a better view of your blunders.

`blunder-lens` is a private ChatGPT app for visualizing chess positions inside ChatGPT conversations.

The goal is not to build a full chess platform. The goal is to let ChatGPT discuss chess while a real board follows the conversation.

## Status

Experimental. Private development app.

## Product idea

Plain-text chess discussion is hard to follow when the user does not easily visualize positions mentally.

`blunder-lens` gives the conversation a visual layer:

- ChatGPT explains.
- The app renders one chess position.
- The board can show highlights, arrows, last move, and a caption.
- The app remains stateless.

## First goal

Render a single chess position inside ChatGPT through a custom app/MCP server.

## Planned stack

- TypeScript
- Node.js
- React
- Vite
- chess.js
- ChatGPT Apps SDK / MCP
- Microsoft Dev Tunnel for local HTTPS development

## First vertical slice

- MCP server exposes `show_position`
- Tool accepts a FEN or defaults to the standard starting position
- Tool returns a normalized shared `BoardState`
- React widget renders the board
- Widget supports optional highlights, arrows, last move, and caption
- ChatGPT Developer Mode can call the tool through an HTTPS tunnel

## Non-goals

For now, do not build:

- Public app directory submission
- User accounts
- Database
- Stockfish
- Game-playing mode
- PGN parsing
- Multiple boards
- Candidate move selector
- Variation tree
- Move navigation
- Drag/drop moves
- Authentication
- Production deployment

These may come later, but not before the first vertical slice works.

## State model

`blunder-lens` should be stateless by design.

The ChatGPT conversation owns the pedagogical flow.
The user owns choices and intent.
The app renders one board state.
The MCP server validates and normalizes input, but does not remember hidden state.

The FEN is authoritative.

## Development tunnel

During development, expose the local MCP server using Microsoft Dev Tunnel.

The ChatGPT Developer Mode app should point to the public HTTPS tunnel URL for the MCP endpoint.

Do not commit tunnel URLs or machine-specific values.
