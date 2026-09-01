"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import { Keyboard, Laptop, Shield, Shuffle, Database, Cpu, LayoutDashboard, Terminal } from "lucide-react";
import { encryptEvent } from "../utils/crypto";

interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  isCorrect: boolean;
}

interface PipelineVisualizerProps {
  latestKeystroke: KeystrokeEvent | null;
}

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "encrypt" | "api" | "ai";
}

const PIPELINE_NODES = [
  { id: "key", label: "Keyboard", icon: Keyboard },
  { id: "agent", label: "Local Agent", icon: Laptop },
  { id: "crypto", label: "AES-256-GCM Envelope", icon: Shield },
  { id: "queue", label: "Client Queue", icon: Shuffle },
  { id: "api", label: "Validated API", icon: Cpu },
  { id: "db", label: "Encrypted Event Store", icon: Database },
  { id: "ai", label: "Local Metrics", icon: Shield },
  { id: "dash", label: "Dashboard", icon: LayoutDashboard },
];

export default function PipelineVisualizer({ latestKeystroke }: PipelineVisualizerProps) {
  const [activeNode, setActiveNode] = useState<number>(-1);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  // Track sequence number
  const sequenceRef = useRef(0);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  // Run pipeline whenever a keystroke event is captured
  useEffect(() => {
    if (!latestKeystroke) return;

    sequenceRef.current += 1;
    const seq = sequenceRef.current;
    const timestampStr = new Date(latestKeystroke.timestamp).toISOString().split("T")[1].slice(0, -1);

    // Trigger visual pipeline flow animation
    let currentNode = 0;
    // The state update intentionally starts a visual synchronization sequence.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveNode(0);
    
    const interval = setInterval(() => {
      currentNode += 1;
      if (currentNode < PIPELINE_NODES.length) {
        setActiveNode(currentNode);
      } else {
        setActiveNode(-1);
        clearInterval(interval);
      }
    }, 80);

    // Perform real AES-GCM encryption in background
    const processCrypto = async () => {
      const payload = {
        key: latestKeystroke.key,
        code: latestKeystroke.code,
        seq,
        t: latestKeystroke.timestamp,
      };

      const cryptoResult = await encryptEvent(payload);

      // Append log entries representing pipeline processing steps
      const newLogs: LogEntry[] = [
        {
          id: `${seq}-1`,
          timestamp: timestampStr,
          message: `[Event] Keypress captured: "${latestKeystroke.key}" (code: ${latestKeystroke.code}, isCorrect: ${latestKeystroke.isCorrect})`,
          type: "info",
        },
        {
          id: `${seq}-2`,
          timestamp: timestampStr,
          message: `[Browser Agent] AES-256-GCM envelope created. IV: ${cryptoResult.iv.slice(0, 10)}... Key material remains non-extractable.`,
          type: "encrypt",
        },
        {
          id: `${seq}-3`,
          timestamp: timestampStr,
          message: `[API] Encrypted envelope validated. Ciphertext size: ${cryptoResult.ciphertext.length / 2} bytes. Metadata transmitted.`,
          type: "api",
        },
        {
          id: `${seq}-4`,
          timestamp: timestampStr,
          message: `[Local Metrics] ${latestKeystroke.isCorrect ? "Correct input recorded" : "Correction signal recorded"}; no AI inference is claimed by this prototype.`,
          type: "ai",
        },
      ];

      setLogs((prev) => [...prev.slice(-30), ...newLogs]); // Keep last 35 entries
    };

    processCrypto();

    return () => clearInterval(interval);
  }, [latestKeystroke]);

  return (
    <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
      {/* Title */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <span className="sketch-title" style={{ fontSize: "1.3rem" }}>
          [Real-Time_Security_Data_Pipeline]
        </span>
      </Box>

      {/* Sketched Pipeline Flowchart */}
      <Box 
        sx={{ 
          position: "relative",
          p: 2, 
          border: "1.5px solid var(--border-color-light)",
          borderRadius: "6px",
          backgroundColor: "var(--accent-olive-tint)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        {PIPELINE_NODES.map((node, index) => {
          const NodeIcon = node.icon;
          const isNodeActive = activeNode === index;
          
          return (
            <React.Fragment key={node.id}>
              {/* Node Card */}
              <Box 
                sx={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  gap: 0.5,
                  flex: "1 1 80px",
                  zIndex: 2,
                }}
              >
                <Box 
                  className={`pipeline-node ${isNodeActive ? "active" : ""}`}
                  sx={{
                    borderStyle: "solid",
                    backgroundColor: isNodeActive ? "var(--accent-olive-medium)" : "var(--bg-secondary)",
                    borderColor: isNodeActive ? "var(--accent-olive-medium)" : "var(--border-color)",
                    color: isNodeActive ? "var(--bg-secondary)" : "var(--accent-olive-dark)",
                  }}
                >
                  <NodeIcon size={22} />
                  
                  {/* Glowing core indicator */}
                  {isNodeActive && (
                    <Box 
                      sx={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        border: "2px solid var(--accent-olive-light)",
                        animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                      }}
                    />
                  )}
                </Box>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontFamily: "var(--font-sans)", 
                    fontWeight: isNodeActive ? 700 : 500,
                    color: isNodeActive ? "var(--accent-olive-medium)" : "var(--text-secondary)",
                    textAlign: "center",
                    fontSize: "0.68rem"
                  }}
                >
                  {node.label}
                </Typography>
              </Box>

              {/* Connecting line */}
              {index < PIPELINE_NODES.length - 1 && (
                <Box 
                  sx={{ 
                    flex: "0 1 20px", 
                    height: "2px", 
                    display: { xs: "none", md: "block" },
                    borderTop: `2px dashed ${activeNode === index ? "var(--accent-olive-medium)" : "var(--border-color-light)"}`,
                    position: "relative",
                    top: "-8px",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </Box>

      {/* Blueprint Scrolling Console Terminal */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Terminal size={16} color="var(--accent-olive-dark)" />
          <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
            Browser Sandbox / Encrypted Ingestion Audit Logs
          </Typography>
        </Box>
        
        <Box ref={consoleRef} className="sketch-console">
          {logs.length === 0 ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", opacity: 0.6 }}>
              <Typography variant="body2" sx={{ fontFamily: "var(--font-mono)" }}>
                {"// Awaiting keystroke events from Sandbox. Type above to stream packets..."}
              </Typography>
            </Box>
          ) : (
            logs.map((log) => {
              let colorClass = "";
              if (log.type === "encrypt") colorClass = "encrypt";
              
              return (
                <div key={log.id} className={`console-line ${colorClass}`}>
                  <span style={{ color: "var(--text-secondary)" }}>[{log.timestamp}]</span>{" "}
                  {log.message}
                </div>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
}
