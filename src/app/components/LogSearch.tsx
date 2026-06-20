"use client";

import React, { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { Search, AppWindow, FileSpreadsheet, RefreshCw, Terminal } from "lucide-react";

interface LogEvent {
  key: string;
  code: string;
  timestamp: number;
  isCorrect: boolean;
  app: string;
  encrypted: string;
}

interface LogSearchProps {
  currentApp: string;
  onAppChange: (app: string) => void;
  triggerRefresh: boolean;
}

const SIMULATED_APPS = ["VS Code", "Google Chrome", "Windows Terminal", "Slack", "cmd.exe"];

export default function LogSearch({ currentApp, onAppChange, triggerRefresh }: LogSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [rawContent, setRawContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      if (data.events && Array.isArray(data.events)) {
        setLogs(data.events.reverse()); // Show newest first
      }
      if (data.rawContent !== undefined) {
        setRawContent(data.rawContent);
      }
    } catch (err) {
      console.error("Failed to fetch logs from API:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch when dashboard reports new key writes or app changes
  useEffect(() => {
    fetchLogs();
  }, [triggerRefresh]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.app.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.encrypted.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
      {/* Title */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FileSpreadsheet size={20} color="var(--accent-olive-dark)" />
          <span className="sketch-title" style={{ fontSize: "1.3rem" }}>
            [Log_Search_&_App_Tracking]
          </span>
        </Box>
        <button 
          className="sketch-btn" 
          onClick={fetchLogs} 
          disabled={isLoading}
          style={{ padding: "6px 12px" }}
        >
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </Box>

      {/* Active Application Selector */}
      <Box sx={{ p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
          <AppWindow size={14} /> Active Application Tracking (Focus Simulator)
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {SIMULATED_APPS.map((app) => (
            <button
              key={app}
              className={`sketch-btn ${currentApp === app ? "active" : ""}`}
              onClick={() => onAppChange(app)}
              style={{ fontSize: "11px", padding: "6px 12px" }}
            >
              {app}
            </button>
          ))}
        </Box>
      </Box>

      {/* Search Input Box */}
      <Box sx={{ position: "relative" }}>
        <input
          type="text"
          className="typing-paper"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search logs by key, app, or ciphertext..."
          style={{ minHeight: "45px", padding: "10px 10px 10px 38px", lineHeight: "24px" }}
        />
        <Box sx={{ position: "absolute", left: "12px", top: "14px", color: "var(--accent-olive-dark)" }}>
          <Search size={18} />
        </Box>
      </Box>

      {/* Logs Table Area */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 600 }}>
          Database entries retrieved from local file `keystroke_logs.jsonl` ({filteredLogs.length} matching logs):
        </Typography>

        <Box 
          sx={{ 
            border: "1.5px solid var(--border-color)",
            borderRadius: "6px",
            maxHeight: "260px",
            overflowY: "auto",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          {filteredLogs.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center", color: "var(--text-secondary)" }}>
              <Typography variant="body2" sx={{ fontFamily: "var(--font-mono)" }}>
                // No logs found in local file cache.
              </Typography>
            </Box>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-color)", backgroundColor: "var(--accent-olive-pale)" }}>
                  <th style={{ padding: "8px" }}>Timestamp</th>
                  <th style={{ padding: "8px" }}>App</th>
                  <th style={{ padding: "8px" }}>Key</th>
                  <th style={{ padding: "8px" }}>Valid</th>
                  <th style={{ padding: "8px" }}>Ciphertext (AES-256-GCM)</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => {
                  const dateStr = new Date(log.timestamp).toISOString().split("T")[1].slice(0, 8);
                  return (
                    <tr 
                      key={index} 
                      style={{ 
                        borderBottom: "1px solid var(--border-color-light)",
                        backgroundColor: index % 2 === 0 ? "var(--bg-secondary)" : "var(--accent-olive-tint)"
                      }}
                    >
                      <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{dateStr}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{log.app}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{log.key === " " ? "Space" : log.key}</td>
                      <td style={{ padding: "6px 8px", color: log.isCorrect ? "var(--alert-success)" : "var(--alert-critical)", fontWeight: 700 }}>
                        {log.isCorrect ? "OK" : "ERR"}
                      </td>
                      <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", color: "var(--accent-olive-medium)" }}>
                        0x{log.encrypted.slice(0, 16)}...
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Box>
      </Box>

      {/* Raw File Viewer Section */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, borderTop: "1.5px dashed var(--border-color-light)", pt: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Terminal size={15} color="var(--accent-olive-dark)" />
          <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
            [Raw_File_Viewer: keystroke_logs.jsonl]
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
          Direct plaintext string contents of the physical file on disk. Each keystroke appends a new JSON line:
        </Typography>
        <Box 
          sx={{ 
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            backgroundColor: "#faf9f6",
            border: "1.5px dashed var(--border-color)",
            borderRadius: "4px",
            p: 1.5,
            maxHeight: "150px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            color: "var(--text-primary)"
          }}
        >
          {rawContent || "// No events recorded in keystroke_logs.jsonl yet."}
        </Box>
      </Box>
    </Box>
  );
}
