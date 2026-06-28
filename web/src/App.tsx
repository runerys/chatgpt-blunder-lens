import { useState } from "react";
import {
  useApp,
  McpUiToolResultNotificationSchema,
} from "@modelcontextprotocol/ext-apps/react";
import type { BoardState } from "@blunder-lens/shared";
import ChessBoard from "./ChessBoard.js";

const STARTING_BOARD: BoardState = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation: "white",
  caption: "",
  highlights: [],
  arrows: [],
  lastMove: null,
};

export default function App() {
  const [boardState, setBoardState] = useState<BoardState>(STARTING_BOARD);

  useApp({
    appInfo: { name: "blunder-lens", version: "0.0.1" },
    capabilities: {},
    onAppCreated: (app) => {
      app.setNotificationHandler(
        McpUiToolResultNotificationSchema,
        (notification) => {
          const structured = notification.params.structuredContent;
          if (structured && typeof structured === "object" && "fen" in structured) {
            setBoardState(structured as unknown as BoardState);
          }
        }
      );
    },
  });

  return <ChessBoard state={boardState} />;
}
