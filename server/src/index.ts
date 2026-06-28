import * as dotenv from "dotenv";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
import type { ShowPositionInput } from "@blunder-lens/shared";
import { showPosition, ShowPositionError } from "./tools/show-position.js";

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");

// Stable ui:// URI used in tool descriptors and resource registration.
// ChatGPT resolves this via resources/read to get the widget HTML.
const WIDGET_RESOURCE_URI = "ui://blunder-lens/chess-board";

// HTTP base for the widget assets (injected as <base href> into the HTML).
const WIDGET_HTTP_BASE = `${PUBLIC_BASE_URL}/widget/`;

// Path to the built widget (populated after `npm run build -w web`)
const WEB_DIST = path.resolve(__dirname, "../../web/dist");

// MIME type map for static file serving
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".ico":  "image/x-icon",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".woff2": "font/woff2",
};

// ---------------------------------------------------------------------------
// MCP server factory — one instance per request (stateless mode requirement)
// ---------------------------------------------------------------------------

// Input schema using Zod (defined once, reused per instance)
const showPositionInputSchema = {
  fen: z.string().optional().describe('Valid FEN string or "startpos". Defaults to starting position.'),
  orientation: z.enum(["white", "black"]).optional().describe('Board orientation. Defaults to "white".'),
  caption: z.string().optional().describe("Caption shown below the board. Maximum 240 characters."),
  highlights: z.array(z.string()).optional().describe("Squares to highlight, e.g. [\"e4\", \"d5\"]."),
  arrows: z
    .array(
      z.object({
        from: z.string().describe("Arrow origin square, e.g. \"e2\"."),
        to: z.string().describe("Arrow target square, e.g. \"e4\"."),
        label: z.string().optional().describe("Optional label for the arrow."),
      })
    )
    .optional()
    .describe("Arrows to draw on the board."),
  lastMove: z
    .object({
      from: z.string().describe("Origin square of the last move."),
      to: z.string().describe("Target square of the last move."),
    })
    .nullable()
    .optional()
    .describe("Last move to highlight with a distinct color."),
};

// Output schema matching BoardState (for structuredContent)
const boardStateOutputSchema = {
  fen: z.string(),
  orientation: z.enum(["white", "black"]),
  caption: z.string(),
  highlights: z.array(z.string()),
  arrows: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })),
  lastMove: z.object({ from: z.string(), to: z.string() }).nullable(),
};

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "blunder-lens", version: "0.0.1" });

  // Register widget resource with the stable ui:// URI.
  // The host (ChatGPT) fetches this via resources/read and renders it in a sandboxed iframe.
  server.registerResource(
    "chessboard-widget",
    WIDGET_RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: "Chessboard widget for rendering board positions.",
    },
    async () => {
      const indexPath = path.join(WEB_DIST, "index.html");
      let text: string;
      try {
        // Inject <base href> so relative asset paths resolve against the HTTP server
        const raw = fs.readFileSync(indexPath, "utf-8");
        text = raw.replace("<head>", `<head>\n    <base href="${WIDGET_HTTP_BASE}">`);
      } catch {
        text = "<!-- Widget not built. Run: npm run build -w web -->";
      }
      return {
        contents: [{ uri: WIDGET_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text }],
      };
    }
  );

  server.registerTool(
    "show_position",
    {
      description:
        "Render a chess position as an interactive chessboard widget. " +
        "Accepts an optional FEN (defaults to starting position), orientation, highlights, arrows, lastMove, and caption.",
      inputSchema: showPositionInputSchema,
      outputSchema: boardStateOutputSchema,
      _meta: { [RESOURCE_URI_META_KEY]: WIDGET_RESOURCE_URI },
    },
    async (args) => {
      try {
        const boardState = showPosition(args as unknown as ShowPositionInput);
        return {
          content: [{ type: "text", text: JSON.stringify(boardState, null, 2) }],
          structuredContent: boardState as unknown as Record<string, unknown>,
          _meta: { [RESOURCE_URI_META_KEY]: WIDGET_RESOURCE_URI },
        };
      } catch (err) {
        const message = err instanceof ShowPositionError ? err.message : "An unexpected error occurred.";
        return {
          isError: true,
          content: [{ type: "text", text: message }],
        };
      }
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // MCP endpoint — new server + transport per request (stateless)
  if (pathname === "/mcp") {
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    res.on("close", () => {
      transport.close();
    });
    await mcpServer.server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  // Widget static files
  if (pathname.startsWith("/widget")) {
    let relative = pathname.replace(/^\/widget/, "");
    if (!relative || relative === "/") relative = "/index.html";
    const safePath = path.join(WEB_DIST, relative);

    // Prevent path traversal
    if (!safePath.startsWith(WEB_DIST)) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    try {
      const data = fs.readFileSync(safePath);
      const ext = path.extname(safePath);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not Found");
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

httpServer.listen(PORT, () => {
  console.log(`blunder-lens MCP server running on http://localhost:${PORT}/mcp`);
  console.log(`Widget URL: ${WIDGET_HTTP_BASE}`);
});
