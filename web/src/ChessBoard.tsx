import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard/dist/chessboard/types/index.js";
import type { BoardState, BoardArrow } from "@blunder-lens/shared";
import "./ChessBoard.css";

interface Props {
  state: BoardState;
}

const HIGHLIGHT_COLOR = "rgba(255, 215, 0, 0.5)";
const LAST_MOVE_COLOR = "rgba(20, 150, 255, 0.4)";

function getSideToMove(fen?: string): "w" | "b" {
  if (!fen || fen === "startpos") return "w";
  const token = fen.trim().split(/\s+/)[1];
  return token === "b" ? "b" : "w";
}

export default function ChessBoard({ state }: Props) {
  const { fen, orientation, caption, highlights, arrows, lastMove } = state;

  const sideToMove = getSideToMove(fen);
  const sideToMoveLabel = sideToMove === "w" ? "Hvit i trekket" : "Svart i trekket";

  // Build customSquareStyles: highlights + lastMove (distinct color)
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  for (const sq of highlights) {
    customSquareStyles[sq] = { backgroundColor: HIGHLIGHT_COLOR };
  }
  if (lastMove) {
    customSquareStyles[lastMove.from] = { backgroundColor: LAST_MOVE_COLOR };
    customSquareStyles[lastMove.to] = { backgroundColor: LAST_MOVE_COLOR };
  }

  // Map arrows to react-chessboard format: [from, to, color?]
  const customArrows = arrows.map(
    (a: BoardArrow) => [a.from, a.to, "rgba(0,0,200,0.6)"] as unknown as Arrow
  );

  return (
    <div className="chess-widget">
      <div className={`side-to-move-badge ${sideToMove === "w" ? "white" : "black"}`}>
        <span className="side-dot" />
        <span>{sideToMoveLabel}</span>
      </div>

      <div className="chess-board-wrap">
        <Chessboard
          position={fen}
          boardOrientation={orientation === "black" ? "black" : "white"}
          customSquareStyles={customSquareStyles}
          customArrows={customArrows}
          arePiecesDraggable={false}
        />
      </div>

      {caption && <p className="chess-caption">{caption}</p>}
    </div>
  );
}

