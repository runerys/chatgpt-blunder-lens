import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard/dist/chessboard/types/index.js";
import type { BoardState, BoardArrow } from "@blunder-lens/shared";
import "./ChessBoard.css";

interface Props {
  state: BoardState;
}

const HIGHLIGHT_COLOR = "rgba(255, 215, 0, 0.5)";
const LAST_MOVE_COLOR = "rgba(20, 150, 255, 0.4)";

// Enable with: localStorage.setItem('blunder-debug', '1')
const SHOW_DEBUG = typeof window !== "undefined" && localStorage.getItem("blunder-debug") === "1";

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

  // Pass algebraic square names directly — react-chessboard handles coordinates internally.
  // Format: [from, to, color?]  — type Arrow = [Square, Square, string?]
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

      {SHOW_DEBUG && arrows.length > 0 && (
        <details style={{ padding: "0 8px", fontFamily: "monospace", fontSize: 10, color: "#999", width: "min(100vw, 480px)" }}>
          <summary style={{ cursor: "pointer" }}>arrow debug</summary>
          <div>
            <div><b>raw arrows (from server):</b></div>
            <pre style={{ margin: "2px 0 6px" }}>{JSON.stringify(arrows, null, 2)}</pre>
            <div><b>mapped to react-chessboard [from, to, color]:</b></div>
            <pre style={{ margin: "2px 0" }}>{JSON.stringify(customArrows, null, 2)}</pre>
          </div>
        </details>
      )}
    </div>
  );
}

