const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Configuration constants
const CONFIG = {
  // Timeout configurations (all in milliseconds)
  REQUEST_TIMEOUT: parseInt(process.env.MCP_TOOL_TIMEOUT) || 180000, // 3 minutes for tool execution
  SESSION_IDLE_TIMEOUT: parseInt(process.env.SESSION_IDLE_TIMEOUT) || 1800000, // 30 minutes
  SESSION_MAX_LIFETIME: parseInt(process.env.SESSION_MAX_LIFETIME) || 3600000, // 1 hour max
  KEEPALIVE_INTERVAL: 15000,
  INITIALIZATION_TIMEOUT: 30000, // 30 seconds for initialization
  SESSION_CHECK_INTERVAL: 60000, // Check for stale sessions every minute
};

// CORS for claude.ai
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Cache-Control",
      "Last-Event-ID",
      "User-Agent",
      "Origin",
      "Referer",
      "Mcp-Session-Id",
      "MCP-Protocol-Version",
    ],
    exposedHeaders: ["Content-Type", "Mcp-Session-Id", "MCP-Protocol-Version"],
    credentials: false,
  })
);

app.use(express.json());

// Store active MCP processes and their state per session
const activeSessions = new Map();

function createMcpProcess() {
  console.log("Creating new Sequential Thinking MCP process...");

  const mcpPath = path.join(__dirname, "../build/index.js");
  console.log(`MCP Path: ${mcpPath}`);

  const mcpProcess = spawn("node", [mcpPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      MCP_TIMEOUT: CONFIG.REQUEST_TIMEOUT.toString(),
      MCP_TOOL_TIMEOUT: CONFIG.REQUEST_TIMEOUT.toString(),
    },
  });

  mcpProcess.on("error", (error) => {
    console.error("MCP process error:", error);
  });

  mcpProcess.on("exit", (code) => {
    console.log(`MCP process exited with code ${code}`);
  });

  return mcpProcess;
}

// Clean up a specific session
function cleanupSession(sessionId, reason = "timeout") {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) return;

  console.log(`Cleaning up session ${sessionId} (reason: ${reason})`);

  // Clear all timers
  if (sessionData.idleTimer) clearTimeout(sessionData.idleTimer);
  if (sessionData.lifetimeTimer) clearTimeout(sessionData.lifetimeTimer);
  if (sessionData.keepAliveInterval)
    clearInterval(sessionData.keepAliveInterval);

  // Clear pending request timeouts AND progress intervals
  sessionData.pendingRequests.forEach((request) => {
    if (request.timeout) clearTimeout(request.timeout);
    if (request.progressInterval) clearInterval(request.progressInterval);
    if (!request.res.headersSent) {
      request.res.status(408).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32000,
          message: `Session terminated: ${reason}`,
        },
      });
    }
  });
  sessionData.pendingRequests.clear();

  // Close SSE connection
  if (sessionData.sseRes && !sessionData.sseRes.writableEnded) {
    sessionData.sseRes.end();
  }

  // Kill process
  if (sessionData.process && !sessionData.process.killed) {
    sessionData.process.kill();
  }

  activeSessions.delete(sessionId);
}

// Reset idle timer for a session
function resetSessionIdleTimer(sessionData, sessionId) {
  if (sessionData.idleTimer) {
    clearTimeout(sessionData.idleTimer);
  }

  sessionData.lastActivity = Date.now();
  sessionData.idleTimer = setTimeout(() => {
    cleanupSession(sessionId, "idle timeout");
  }, CONFIG.SESSION_IDLE_TIMEOUT);
}

// Periodic cleanup of stale sessions
setInterval(() => {
  const now = Date.now();
  activeSessions.forEach((sessionData, sessionId) => {
    // Check if session exceeded max lifetime
    if (now - sessionData.createdAt > CONFIG.SESSION_MAX_LIFETIME) {
      cleanupSession(sessionId, "max lifetime exceeded");
      return;
    }

    // Check if process is dead
    if (sessionData.process && sessionData.process.killed) {
      cleanupSession(sessionId, "process died");
      return;
    }

    // Check if session is idle too long
    if (now - sessionData.lastActivity > CONFIG.SESSION_IDLE_TIMEOUT) {
      cleanupSession(sessionId, "idle too long");
    }
  });
}, CONFIG.SESSION_CHECK_INTERVAL);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "sequential-thinking-mcp-server",
    timestamp: new Date().toISOString(),
    config: {
      requestTimeout: `${CONFIG.REQUEST_TIMEOUT}ms`,
      sessionIdleTimeout: `${CONFIG.SESSION_IDLE_TIMEOUT}ms`,
      sessionMaxLifetime: `${CONFIG.SESSION_MAX_LIFETIME}ms`,
    },
    sessions: {
      active: activeSessions.size,
    },
  });
});

// Root endpoint info
app.get("/", (req, res) => {
  res.json({
    service: "Sequential Thinking MCP Server",
    version: "1.0.0",
    transport: "Streamable HTTP",
    endpoints: {
      health: "/health",
      mcp: "/mcp",
      sessions: "/debug/sessions",
    },
    documentation: "Connect your MCP client to /mcp endpoint",
    tools: [
      "sequential_thinking",
      "get_thinking_session",
      "list_thinking_sessions",
    ],
    features: [
      "Adaptive multi-step reasoning",
      "Thought revision and branching",
      "Session persistence",
      "Context maintenance across steps",
      "Configurable timeouts",
    ],
    timeouts: {
      requestTimeout: `${CONFIG.REQUEST_TIMEOUT}ms`,
      sessionIdleTimeout: `${CONFIG.SESSION_IDLE_TIMEOUT}ms`,
      sessionMaxLifetime: `${CONFIG.SESSION_MAX_LIFETIME}ms`,
    },
  });
});

// Generate consistent session ID
function generateSessionId(req) {
  // Check for explicit session ID header first
  const headerSessionId = req.get("Mcp-Session-Id");
  if (headerSessionId) return headerSessionId;

  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  return Buffer.from(ip + userAgent)
    .toString("base64")
    .slice(0, 16);
}

// Get or create session
function getOrCreateSession(sessionId) {
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    resetSessionIdleTimer(session, sessionId);
    return session;
  }

  console.log(`Creating new session: ${sessionId}`);
  const mcpProcess = createMcpProcess();
  const now = Date.now();

  const sessionData = {
    process: mcpProcess,
    initialized: false,
    initializing: false,
    pendingRequests: new Map(),
    responseBuffer: "",
    listenersSetup: false,
    lastActivity: now,
    createdAt: now,
    sseRes: null,
    idleTimer: null,
    lifetimeTimer: null,
    keepAliveInterval: null,
  };

  // Set up session timers
  resetSessionIdleTimer(sessionData, sessionId);

  sessionData.lifetimeTimer = setTimeout(() => {
    cleanupSession(sessionId, "max lifetime reached");
  }, CONFIG.SESSION_MAX_LIFETIME);

  activeSessions.set(sessionId, sessionData);
  return sessionData;
}

// SSE listener endpoint for server-to-client messages
app.get("/mcp", (req, res) => {
  const sessionId = generateSessionId(req);
  console.log(`SSE stream opened for session ${sessionId}`);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
    "Mcp-Session-Id": sessionId,
    "MCP-Protocol-Version": "2024-11-05",
  });

  res.write(`: Connected to session ${sessionId}\n\n`);

  const sessionData = getOrCreateSession(sessionId);
  sessionData.sseRes = res;

  // Keep-alive pings
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: ping ${Date.now()}\n\n`);
    } else {
      clearInterval(keepAlive);
    }
  }, CONFIG.KEEPALIVE_INTERVAL);

  sessionData.keepAliveInterval = keepAlive;

  req.on("close", () => {
    clearInterval(keepAlive);
    sessionData.sseRes = null;
    console.log(`SSE stream closed for session ${sessionId}`);
    // Don't immediately cleanup - let idle timer handle it
  });
});

// Main MCP endpoint (POST)
app.post("/mcp", async (req, res) => {
  const message = req.body;
  const sessionId = generateSessionId(req);

  console.log("=== Received MCP request ===");
  console.log("Session:", sessionId);
  console.log("Method:", message.method);
  console.log("ID:", message.id);
  console.log("Params:", JSON.stringify(message.params, null, 2));
  console.log("============================");

  res.setHeader("Mcp-Session-Id", sessionId);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Mcp-Session-Id, MCP-Protocol-Version"
  );
  res.setHeader("MCP-Protocol-Version", "2024-11-05");

  // Validate JSON-RPC message
  if (!message.jsonrpc || !message.method) {
    console.error("Invalid JSON-RPC message");
    return res.status(400).json({
      jsonrpc: "2.0",
      id: message.id || null,
      error: {
        code: -32600,
        message: "Invalid Request",
      },
    });
  }

  // Get or create session
  const sessionData = getOrCreateSession(sessionId);
  const mcpProcess = sessionData.process;

  if (!mcpProcess || mcpProcess.killed) {
    console.error("MCP process not available or killed");
    cleanupSession(sessionId, "process unavailable");
    return res.status(500).json({
      jsonrpc: "2.0",
      id: message.id || null,
      error: {
        code: -32603,
        message: "Internal error: MCP process not available",
      },
    });
  }

  // Handle initialize method specially
  if (message.method === "initialize") {
    if (sessionData.initialized) {
      console.log("Session already initialized, reinitializing...");
      sessionData.initialized = false;
    }
    sessionData.initializing = true;
  }

  try {
    // Handle notifications (no response expected)
    if (message.method.startsWith("notifications/")) {
      console.log(`Processing notification: ${message.method}`);

      const messageStr = JSON.stringify(message) + "\n";
      console.log("Sending notification to MCP process:", messageStr.trim());
      mcpProcess.stdin.write(messageStr);

      if (message.method === "notifications/initialized") {
        console.log("Session initialized, marking as ready");
        sessionData.initialized = true;
        sessionData.initializing = false;

        // Notify client of available tools
        setTimeout(() => {
          const toolsChangedNotification = {
            jsonrpc: "2.0",
            method: "notifications/tools/list_changed",
          };

          console.log("Sending tools/list_changed notification via SSE");
          if (sessionData.sseRes && !sessionData.sseRes.writableEnded) {
            sessionData.sseRes.write(
              `data: ${JSON.stringify(toolsChangedNotification)}\n\n`
            );
          }
        }, 500);
      }

      return res.status(202).json({ success: true });
    }

    // Determine timeout based on method
    let timeoutDuration = CONFIG.REQUEST_TIMEOUT;
    if (message.method === "initialize") {
      timeoutDuration = CONFIG.INITIALIZATION_TIMEOUT;
    } else if (message.method === "tools/call") {
      // Tool calls get the full timeout
      timeoutDuration = CONFIG.REQUEST_TIMEOUT;
    }

    let progressInterval = null;
    if (
      message.method === "tools/call" &&
      sessionData.sseRes &&
      !sessionData.sseRes.writableEnded
    ) {
      console.log(`Starting progress keep-alive for tool call ${message.id}`);
      let progressCount = 0;

      progressInterval = setInterval(() => {
        if (sessionData.sseRes && !sessionData.sseRes.writableEnded) {
          progressCount++;
          const progressNotification = {
            jsonrpc: "2.0",
            method: "notifications/progress",
            params: {
              progressToken: message.id,
              value: progressCount,
              message: "Processing sequential thinking...",
            },
          };

          // Send progress via SSE to keep connection alive
          sessionData.sseRes.write(`: progress ${progressCount}\n\n`);
          console.log(
            `Sent progress keep-alive ${progressCount} for request ${message.id}`
          );
        }
      }, 10000); // Send progress every 10 seconds
    }

    // Set up response handler for regular requests
    const responseTimeout = setTimeout(() => {
      console.log(
        `Timeout (${timeoutDuration}ms) waiting for response to message ID ${message.id}`
      );

      // Clear progress interval on timeout
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (
        message.id !== undefined &&
        sessionData.pendingRequests.has(message.id)
      ) {
        const request = sessionData.pendingRequests.get(message.id);
        sessionData.pendingRequests.delete(message.id);

        if (!request.res.headersSent) {
          request.res.status(408).json({
            jsonrpc: "2.0",
            id: message.id || null,
            error: {
              code: -32001,
              message: `Request timed out after ${timeoutDuration}ms`,
              data: {
                timeout: timeoutDuration,
                method: message.method,
              },
            },
          });
        }
      }
    }, timeoutDuration);

    // Store pending request only if there's an ID
    if (message.id !== undefined) {
      sessionData.pendingRequests.set(message.id, {
        res,
        timeout: responseTimeout,
        method: message.method,
        timestamp: Date.now(),
        progressInterval, // Store interval so we can clear it
      });
    }

    const handleResponse = (data) => {
      sessionData.responseBuffer += data.toString();

      let lines = sessionData.responseBuffer.split("\n");
      sessionData.responseBuffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          try {
            const parsed = JSON.parse(trimmedLine);

            if (parsed.id !== undefined) {
              const pendingRequest = sessionData.pendingRequests.get(parsed.id);
              if (pendingRequest) {
                // Clear progress interval when response received
                if (pendingRequest.progressInterval) {
                  clearInterval(pendingRequest.progressInterval);
                  console.log(
                    `Cleared progress interval for request ${parsed.id}`
                  );
                }

                clearTimeout(pendingRequest.timeout);
                const responseTime = Date.now() - pendingRequest.timestamp;
                console.log(
                  `Response received in ${responseTime}ms for ID ${parsed.id}`
                );
                sessionData.pendingRequests.delete(parsed.id);

                // Handle initialize response
                if (pendingRequest.method === "initialize" && !parsed.error) {
                  console.log(
                    "🔍 INITIALIZE RESPONSE CAPABILITIES:",
                    JSON.stringify(parsed.result?.capabilities, null, 2)
                  );
                  sessionData.initialized = true;
                  sessionData.initializing = false;
                  console.log(`Session ${sessionId} initialized successfully`);

                  if (!parsed.result) parsed.result = {};
                  parsed.result.sessionId = sessionId;

                  if (!parsed.result.protocolVersion) {
                    parsed.result.protocolVersion = "2024-11-05";
                  }
                }

                console.log("Sending MCP response:", JSON.stringify(parsed));

                if (!pendingRequest.res.headersSent) {
                  pendingRequest.res.json(parsed);
                }
                return;
              }
            } else if (parsed.method) {
              // Server-initiated notification
              console.log(
                `Forwarding server notification: ${JSON.stringify(parsed)}`
              );
              if (sessionData.sseRes && !sessionData.sseRes.writableEnded) {
                sessionData.sseRes.write(`data: ${JSON.stringify(parsed)}\n\n`);
              }
            }
          } catch (e) {
            console.log(`Non-JSON MCP output: ${trimmedLine}`);
          }
        }
      }
    };

    // Set up listeners if not already set up
    if (!sessionData.listenersSetup) {
      mcpProcess.stdout.on("data", handleResponse);

      mcpProcess.stderr.on("data", (data) => {
        const error = data.toString().trim();
        console.error(`MCP Process Error:`, error);
      });

      mcpProcess.on("exit", (code, signal) => {
        console.error(
          `MCP process exited unexpectedly (code: ${code}, signal: ${signal}) for session ${sessionId}`
        );
        cleanupSession(sessionId, "process exited");
      });

      sessionData.listenersSetup = true;
    }

    // Send message to MCP process (clean passthrough)
    const messageStr = JSON.stringify(message) + "\n";
    console.log("Sending to MCP process:", messageStr.trim());

    if (!mcpProcess.stdin.writable) {
      // Clear progress interval if process is dead
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      throw new Error("MCP process stdin is not writable");
    }

    mcpProcess.stdin.write(messageStr);
  } catch (error) {
    console.error("Error processing MCP request:", error);

    if (
      message.id !== undefined &&
      sessionData.pendingRequests.has(message.id)
    ) {
      const request = sessionData.pendingRequests.get(message.id);

      // Clear progress interval on error
      if (request.progressInterval) {
        clearInterval(request.progressInterval);
      }

      clearTimeout(request.timeout);
      sessionData.pendingRequests.delete(message.id);
    }

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        id: message.id || null,
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message,
        },
      });
    }
  }
});

// Debug endpoint to check sessions
app.get("/debug/sessions", (req, res) => {
  const sessions = {};
  const now = Date.now();

  activeSessions.forEach((sessionData, sessionId) => {
    sessions[sessionId] = {
      initialized: sessionData.initialized,
      initializing: sessionData.initializing,
      processAlive: sessionData.process && !sessionData.process.killed,
      pendingRequests: Array.from(sessionData.pendingRequests.entries()).map(
        ([id, req]) => ({
          id,
          method: req.method,
          age: now - req.timestamp,
        })
      ),
      lastActivity: new Date(sessionData.lastActivity).toISOString(),
      createdAt: new Date(sessionData.createdAt).toISOString(),
      age: now - sessionData.createdAt,
      idleTime: now - sessionData.lastActivity,
      hasSseConnection: sessionData.sseRes && !sessionData.sseRes.writableEnded,
    };
  });

  res.json({
    totalSessions: activeSessions.size,
    config: CONFIG,
    sessions,
  });
});

// Debug endpoint to test tools list on existing session
app.post("/debug/tools", async (req, res) => {
  const sessionId = generateSessionId(req);
  console.log(`Manual tools list request for session: ${sessionId}`);

  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) {
    return res.json({
      error: "No active session found. Connect to /mcp first.",
    });
  }

  if (!sessionData.initialized) {
    return res.json({ error: "Session not initialized yet." });
  }

  const toolsMessage = {
    jsonrpc: "2.0",
    id: 999,
    method: "tools/list",
    params: {},
  };

  try {
    const messageStr = JSON.stringify(toolsMessage) + "\n";
    console.log("Manually sending tools/list:", messageStr.trim());
    sessionData.process.stdin.write(messageStr);

    res.json({
      success: true,
      message: "tools/list sent to MCP process, check logs for response",
      sessionInfo: {
        initialized: sessionData.initialized,
        processAlive: !sessionData.process.killed,
        pendingRequests: sessionData.pendingRequests.size,
        age: Date.now() - sessionData.createdAt,
        idleSince: Date.now() - sessionData.lastActivity,
      },
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Sequential Thinking MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: POST http://localhost:${PORT}/mcp`);
  console.log(`Sessions debug: http://localhost:${PORT}/debug/sessions`);
  console.log("Using MCP from /build/index.js");
  console.log("\nTimeout Configuration:");
  console.log(`- Request Timeout: ${CONFIG.REQUEST_TIMEOUT}ms`);
  console.log(`- Session Idle Timeout: ${CONFIG.SESSION_IDLE_TIMEOUT}ms`);
  console.log(`- Session Max Lifetime: ${CONFIG.SESSION_MAX_LIFETIME}ms`);
  console.log(`- Initialization Timeout: ${CONFIG.INITIALIZATION_TIMEOUT}ms`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  activeSessions.forEach((sessionData, sessionId) => {
    cleanupSession(sessionId, "server shutdown");
  });
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  activeSessions.forEach((sessionData, sessionId) => {
    cleanupSession(sessionId, "server shutdown");
  });
  process.exit(0);
});
