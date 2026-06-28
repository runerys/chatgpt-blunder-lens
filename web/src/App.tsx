import { useState, useEffect } from "react";
import type { BoardState } from "@blunder-lens/shared";
import ChessBoard from "./ChessBoard.js";

declare global {
  interface Window {
    openai?: { toolOutput?: unknown; toolInput?: unknown; [key: string]: unknown };
  }
}

// Set localStorage.setItem('blunder-debug', '1') in browser devtools to enable.
const SHOW_DEBUG = typeof window !== "undefined" && localStorage.getItem("blunder-debug") === "1";

function parseBoardState(data: unknown): BoardState | null {
  if (data == null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.fen !== "string") return null;
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

function readSelected(globals: Record<string, unknown> | null): unknown {
  return (
    globals?.toolOutput ??
    window.openai?.toolOutput ??
    globals?.toolInput ??
    window.openai?.toolInput ??
    null
  );
}

interface DebugInfo {
  source: string;
  fen: string | null;
  nonce: string;
  hasToolOutput: boolean;
}

export default function App() {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [debug, setDebug] = useState<DebugInfo>({
    source: "initial",
    fen: null,
    nonce: "",
    hasToolOutput: false,
  });

  function apply(globals: Record<string, unknown> | null, source: string) {
    const data = readSelected(globals);
    const parsed = parseBoardState(data);
    setDebug({
      source,
      fen: parsed?.fen ?? null,
      nonce: String((data as Record<string, unknown> | null)?.debugNonce ?? "").slice(0, 8),
      hasToolOutput: !!(globals?.toolOutput ?? window.openai?.toolOutput),
    });
    setBoard(parsed);
  }

  useEffect(() => {
    apply(null, "initial:window.openai.toolOutput");

    const handler = (event: Event) => {
      const globals: Record<string, unknown> =
        (event as CustomEvent)?.detail?.globals ?? {};
      apply(globals, "openai:set_globals");
    };

    window.addEventListener("openai:set_globals", handler, { passive: true });
    return () => window.removeEventListener("openai:set_globals", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!board) {
    return (
      <div style={{ padding: 16, color: "#c0392b", fontFamily: "monospace", fontSize: 12 }}>
        No selected chess data
        <br />source: {debug.source}
        <br />has toolOutput: {String(debug.hasToolOutput)}
      </div>
    );
  }

  return (
    <div>
      <ChessBoard state={board} />
      {SHOW_DEBUG && (
        <details style={{ padding: "0 8px", fontFamily: "monospace", fontSize: 10, color: "#aaa" }}>
          <summary style={{ cursor: "pointer" }}>debug</summary>
          <div>
            source: {debug.source}<br />
            fen: {debug.fen}<br />
            nonce: {debug.nonce}<br />
            has toolOutput: {String(debug.hasToolOutput)}
          </div>
        </details>
      )}
    </div>
  );
}
