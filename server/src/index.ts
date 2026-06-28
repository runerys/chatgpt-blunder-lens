import * as dotenv from "dotenv";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { ShowPositionInput } from "@blunder-lens/shared";
import { showPosition, ShowPositionError } from "./tools/show-position.js";

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");

// Resource URI — bump this string to force ChatGPT to load fresh HTML.
const TEMPLATE_URI = "ui://widget/chessboard-v10.html";

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
  fen: z.string().optional().describe(
    'FEN string for the position, or "startpos". Includes side to move. Use this to show the board state.'
  ),
  orientation: z.enum(["white", "black"]).optional().describe(
    '"white" shows White at the bottom; "black" shows Black at the bottom. Does not determine side to move.'
  ),
  caption: z.string().optional().describe(
    "Short explanation shown below the board. Describe the moment in the game or the key idea. Maximum 240 characters."
  ),
  highlights: z.array(z.string()).optional().describe(
    'Squares to visually highlight, such as important pieces, targets, weaknesses, or key squares. e.g. ["e4", "d5"].'
  ),
  arrows: z
    .array(
      z.object({
        from: z.string().describe("Arrow origin square, e.g. \"e2\"."),
        to: z.string().describe("Arrow target square, e.g. \"e4\"."),
        label: z.string().optional().describe("Optional label for the arrow, e.g. a move like \"Nf3\"."),
      })
    )
    .optional()
    .describe(
      "Arrows to draw on the board for candidate moves, threats, plans, or explanatory lines."
    ),
  lastMove: z
    .object({
      from: z.string().describe("Origin square of the last move."),
      to: z.string().describe("Target square of the last move."),
    })
    .nullable()
    .optional()
    .describe("The previous move to mark distinctly on the board."),
};

// Output schema matching BoardState + debugNonce (for structuredContent)
const boardStateOutputSchema = {
  fen: z.string(),
  orientation: z.enum(["white", "black"]),
  caption: z.string(),
  highlights: z.array(z.string()),
  arrows: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })),
  lastMove: z.object({ from: z.string(), to: z.string() }).nullable(),
  debugNonce: z.string(),
};

function createMcpServer(): McpServer {
  const server = new McpServer({ name: "blunder-lens", version: "0.0.1" });

  server.registerResource(
    "html",
    TEMPLATE_URI,
    {
      _meta: {
        "openai/widgetDescription":
          "Interactive chessboard showing a FEN position with side-to-move, highlighted squares, last move, arrows, labels, and caption.",
      },
    } as Record<string, unknown>,
    async () => {
      const indexPath = path.join(WEB_DIST, "index.html");
      let html: string;
      try {
        html = fs.readFileSync(indexPath, "utf-8");
        // Inline JS assets so the HTML is self-contained
        html = html.replace(
          /<script\s[^>]*\bsrc="(\.[^"]+\.js)"[^>]*><\/script>/g,
          (_match, src) => {
            const file = path.join(WEB_DIST, src.replace(/^\.\//,  ""));
            try {
              const code = fs.readFileSync(file, "utf-8");
              return `<script type="module">\n${code}\n</script>`;
            } catch {
              return `<script>console.error("asset load failed: ${src}")</script>`;
            }
          }
        );
        // Inline CSS assets
        html = html.replace(
          /<link\s[^>]*\bhref="(\.[^"]+\.css)"[^>]*>/g,
          (_match, href) => {
            const file = path.join(WEB_DIST, href.replace(/^\.\//,  ""));
            try {
              const css = fs.readFileSync(file, "utf-8");
              return `<style>${css}</style>`;
            } catch {
              return `<style>/* asset load failed: ${href} */</style>`;
            }
          }
        );
      } catch {
        html = `<!doctype html><html><body><p style="color:red">Widget not built. Run: npm run build -w web</p></body></html>`;
      }
      return {
        contents: [{ uri: TEMPLATE_URI, mimeType: "text/html;profile=mcp-app", text: html }],
      };
    }
  );

  server.registerTool(
    "show_position",
    {
      title: "Show Chess Position",
      description:
        "Render a chess position as an interactive chessboard widget. " +
        "Use this whenever the assistant explains chess and a visual board would help: " +
        "FEN positions, PGN game moments, tactics, candidate moves, last move, arrows, " +
        "highlighted squares, side-to-move, or chess analysis diagrams. " +
        "Prefer this over ASCII diagrams or only algebraic notation when showing a position. " +
        "This is a visualization tool, not a chess engine or legality/evaluation service.",
      inputSchema: showPositionInputSchema,
      outputSchema: boardStateOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: TEMPLATE_URI },
        "openai/outputTemplate": TEMPLATE_URI,
        "openai/toolInvocation/invoking": "Viser sjakkbrett\u2026",
        "openai/toolInvocation/invoked": "Sjakkbrett klart",
      },
    },
    async (args) => {
      try {
        const boardState = showPosition(args as unknown as ShowPositionInput);
        return {
          content: [{ type: "text", text: "Rendering chess board." }],
          structuredContent: {
            ...boardState,
            debugNonce: randomUUID(),
          } as unknown as Record<string, unknown>,
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
});
