import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard/dist/chessboard/types/index.js";
import type { BoardState, BoardArrow } from "@blunder-lens/shared";

interface Props {
  state: BoardState;
}

const HIGHLIGHT_COLOR = "rgba(255, 215, 0, 0.5)";
const LAST_MOVE_COLOR = "rgba(20, 150, 255, 0.4)";

export default function ChessBoard({ state }: Props) {
  const { fen, orientation, caption, highlights, arrows, lastMove } = state;

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 8 }}>
      <div style={{ width: "min(100vw, 480px)" }}>
        <Chessboard
          position={fen}
          boardOrientation={orientation === "black" ? "black" : "white"}
          customSquareStyles={customSquareStyles}
          customArrows={customArrows}
          arePiecesDraggable={false}
        />
      </div>
      {caption && (
        <p
          style={{
            marginTop: 8,
            maxWidth: "min(100vw, 480px)",
            fontSize: 14,
            color: "#333",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}
