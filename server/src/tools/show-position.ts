import { Chess } from "chess.js";
import type { BoardState, ShowPositionInput, Square } from "@blunder-lens/shared";

const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const SQUARE_RE = /^[a-h][1-8]$/;

function isValidSquare(s: string): s is Square {
  return SQUARE_RE.test(s);
}

export class ShowPositionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShowPositionError";
  }
}

export function showPosition(input: ShowPositionInput): BoardState {
  // Resolve FEN
  let fen: string;
  if (!input.fen || input.fen === "startpos") {
    fen = STARTING_FEN;
  } else {
    try {
      const chess = new Chess(input.fen);
      fen = chess.fen();
    } catch {
      throw new ShowPositionError(`Invalid FEN: "${input.fen}"`);
    }
  }

  // Validate orientation
  const orientation: "white" | "black" = input.orientation ?? "white";

  // Validate caption
  const caption = input.caption ?? "";
  if (caption.length > 240) {
    throw new ShowPositionError(
      `Caption is ${caption.length} characters; maximum is 240.`
    );
  }

  // Validate highlights
  const highlights: Square[] = [];
  for (const sq of input.highlights ?? []) {
    if (!isValidSquare(sq)) {
      throw new ShowPositionError(`Invalid square in highlights: "${sq}"`);
    }
    highlights.push(sq);
  }

  // Validate arrows
  const arrows = [];
  for (const arrow of input.arrows ?? []) {
    if (!isValidSquare(arrow.from)) {
      throw new ShowPositionError(
        `Invalid square in arrow.from: "${arrow.from}"`
      );
    }
    if (!isValidSquare(arrow.to)) {
      throw new ShowPositionError(`Invalid square in arrow.to: "${arrow.to}"`);
    }
    arrows.push({ from: arrow.from, to: arrow.to, ...(arrow.label !== undefined ? { label: arrow.label } : {}) });
  }

  // Validate lastMove
  let lastMove: BoardState["lastMove"] = null;
  if (input.lastMove != null) {
    if (!isValidSquare(input.lastMove.from)) {
      throw new ShowPositionError(
        `Invalid square in lastMove.from: "${input.lastMove.from}"`
      );
    }
    if (!isValidSquare(input.lastMove.to)) {
      throw new ShowPositionError(
        `Invalid square in lastMove.to: "${input.lastMove.to}"`
      );
    }
    lastMove = { from: input.lastMove.from, to: input.lastMove.to };
  }

  return { fen, orientation, caption, highlights, arrows, lastMove };
}
