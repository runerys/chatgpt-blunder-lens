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
