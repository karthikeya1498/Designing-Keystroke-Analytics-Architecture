"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { Search, AppWindow, FileSpreadsheet, RefreshCw } from "lucide-react";

interface LogEvent {
  eventId: string;
  timestamp: number;
  receivedAt: number;
  app: string;
  algorithm: "AES-256-GCM";
  ciphertextBytes: number;
  isCorrect: boolean;
}

interface LogSearchProps {
  currentApp: string;
  onAppChange: (app: string) => void;
  triggerRefresh: boolean;
}

const SANDBOX_SOURCES = ["Browser typing sandbox", "Sample VS Code label", "Sample Chrome label", "Sample Terminal label"];

export default function LogSearch({ currentApp, onAppChange, triggerRefresh }: LogSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/logs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setLogs(Array.isArray(data.events) ? [...data.events].reverse() : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load encrypted event metadata");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetching an external resource is the purpose of this synchronization effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs();
  }, [triggerRefresh]);

  const filteredLogs = logs.filter((log) =>
    [log.eventId, log.app, log.algorithm, String(log.ciphertextBytes), log.isCorrect ? "ok" : "error"]
      .some((value) => value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FileSpreadsheet size={20} color="var(--accent-olive-dark)" />
          <span className="sketch-title" style={{ fontSize: "1.3rem" }}>[Encrypted_Event_Search]</span>
        </Box>
        <button className="sketch-btn" onClick={() => void fetchLogs()} disabled={isLoading} style={{ padding: "6px 12px" }}>
          <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </Box>

      <Box sx={{ p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
          <AppWindow size={14} /> Event source label (not OS-wide application monitoring)
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {SANDBOX_SOURCES.map((app) => (
            <button key={app} className={`sketch-btn ${currentApp === app ? "active" : ""}`} onClick={() => onAppChange(app)} style={{ fontSize: "11px", padding: "6px 12px" }}>
              {app}
            </button>
          ))}
        </Box>
      </Box>

      <Box sx={{ position: "relative" }}>
        <input type="text" className="typing-paper" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search event ID, source, algorithm, or status..." style={{ minHeight: "45px", padding: "10px 10px 10px 38px", lineHeight: "24px" }} />
        <Box sx={{ position: "absolute", left: "12px", top: "14px", color: "var(--accent-olive-dark)" }}><Search size={18} /></Box>
      </Box>

      {error && <Typography variant="caption" sx={{ color: "var(--alert-critical)" }}>{error}</Typography>}
      <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 600 }}>
        Encrypted event metadata ({filteredLogs.length} matching records). Plaintext key values and ciphertext are never returned to this view.
      </Typography>

      <Box sx={{ border: "1.5px solid var(--border-color)", borderRadius: "6px", maxHeight: "320px", overflowY: "auto", backgroundColor: "var(--bg-secondary)" }}>
        {filteredLogs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "var(--text-secondary)" }}><Typography variant="body2" sx={{ fontFamily: "var(--font-mono)" }}>{"// No encrypted metadata found."}</Typography></Box>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead><tr style={{ borderBottom: "2px solid var(--border-color)", backgroundColor: "var(--accent-olive-pale)" }}><th style={{ padding: "8px" }}>Timestamp</th><th style={{ padding: "8px" }}>Source</th><th style={{ padding: "8px" }}>Algorithm</th><th style={{ padding: "8px" }}>Bytes</th><th style={{ padding: "8px" }}>Valid</th></tr></thead>
            <tbody>{filteredLogs.map((log) => (
              <tr key={log.eventId} style={{ borderBottom: "1px solid var(--border-color-light)" }}>
                <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{log.app}</td>
                <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{log.algorithm}</td>
                <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{log.ciphertextBytes}</td>
                <td style={{ padding: "6px 8px", color: log.isCorrect ? "var(--alert-success)" : "var(--alert-critical)", fontWeight: 700 }}>{log.isCorrect ? "OK" : "ERR"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Box>
    </Box>
  );
}
