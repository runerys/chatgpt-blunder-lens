import { useState, useEffect } from "react";
import type { BoardState } from "@blunder-lens/shared";
import ChessBoard from "./ChessBoard.js";

declare global {
  interface Window {
    openai?: { toolOutput?: unknown };
  }
}

const STARTING_BOARD: BoardState = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation: "white",
  caption: "",
  highlights: [],
  arrows: [],
  lastMove: null,
};

function parseBoardState(data: unknown): BoardState | string {
  if (data == null || typeof data !== "object") return "toolOutput missing";
  const d = data as Record<string, unknown>;
  if (typeof d.fen !== "string") return "FEN parse error: missing fen field";
  return {
    fen: d.fen,
    orientation: d.orientation === "black" ? "black" : "white",
    caption: typeof d.caption === "string" ? d.caption : "",
    highlights: Array.isArray(d.highlights) ? (d.highlights as BoardState["highlights"]) : [],
    arrows: Array.isArray(d.arrows) ? (d.arrows as BoardState["arrows"]) : [],
    lastMove:
      d.lastMove != null &&
      typeof d.lastMove === "object" &&
      "from" in (d.lastMove as object) &&
      "to" in (d.lastMove as object)
        ? (d.lastMove as BoardState["lastMove"])
        : null,
  };
}

export default function App() {
  const [boardState, setBoardState] = useState<BoardState>(STARTING_BOARD);
  const [diag, setDiag] = useState<string | null>(null);

  function applyOutput(output: unknown) {
    const result = parseBoardState(output);
    if (typeof result === "string") {
      setDiag(result);
    } else {
      setBoardState(result);
      setDiag(null);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      setDiag("window.openai missing");
      return;
    }
    // Immediate: toolOutput already set before widget mounted
    if (window.openai?.toolOutput !== undefined) {
      applyOutput(window.openai.toolOutput);
      return;
    }
    // Late-arriving: ChatGPT fires this event after globals are set
    const handler = () => applyOutput(window.openai?.toolOutput);
    window.addEventListener("openai:set_globals", handler);
    return () => window.removeEventListener("openai:set_globals", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {diag && (
        <div style={{ padding: 8, color: "#c00", fontFamily: "monospace", fontSize: 11 }}>
          {diag}
        </div>
      )}
      <ChessBoard state={boardState} />
    </>
  );
}
