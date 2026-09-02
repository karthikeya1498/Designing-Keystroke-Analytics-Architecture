"use client";

import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { ShieldAlert, AlertOctagon, Info, FileText } from "lucide-react";
import type { ContinuousAuthenticationSnapshot } from "../../domain/security/models";

interface Alert {
  id: string;
  time: string;
  title: string;
  desc: string;
  severity: "info" | "warning" | "critical";
}

interface SecurityCenterProps {
  authentication?: ContinuousAuthenticationSnapshot | null;
}

export default function SecurityCenter({ authentication }: SecurityCenterProps) {
  const [streamStatus, setStreamStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const stream = new EventSource("/api/security/stream");
    const handleAnalytics = (event: MessageEvent<string>) => {
      try {
        const snapshot = JSON.parse(event.data) as { estimatedWpm: number; accuracy: number; riskLevel: string };
        setAlerts((previous) => [{ id: `analytics-${Date.now()}`, time: new Date().toISOString().slice(11, 19), title: "LIVE: Analytics snapshot persisted", desc: `WPM ${snapshot.estimatedWpm.toFixed(1)} · Accuracy ${(snapshot.accuracy * 100).toFixed(1)}% · ${snapshot.riskLevel}`, severity: "info" as const }, ...previous].slice(0, 20));
      } catch {
        setStreamStatus("offline");
      }
    };
    const handleAnomaly = (event: MessageEvent<string>) => {
      try {
        const assessment = JSON.parse(event.data) as { riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "BASELINE_BUILDING"; explanation: string; riskScore: number | null };
        const severity: Alert["severity"] = assessment.riskLevel === "CRITICAL" ? "critical" : assessment.riskLevel === "HIGH" ? "warning" : "info";
        setAlerts((previous) => [{ id: `sse-${Date.now()}`, time: new Date().toISOString().slice(11, 19), title: `LIVE: ${assessment.riskLevel} behavioral assessment`, desc: `${assessment.explanation}${assessment.riskScore === null ? " No decision is made during baseline enrollment." : ` Risk score ${assessment.riskScore.toFixed(2)}.`}`, severity }, ...previous].slice(0, 20));
      } catch {
        setStreamStatus("offline");
      }
    };
    stream.addEventListener("open", () => setStreamStatus("live"));
    stream.addEventListener("analytics", handleAnalytics);
    stream.addEventListener("anomaly", handleAnomaly);
    stream.addEventListener("baseline", () => setStreamStatus("live"));
    stream.onerror = () => setStreamStatus("offline");
    return () => stream.close();
  }, []);

  return (
    <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ShieldAlert size={20} color="var(--accent-olive-dark)" />
          <span className="sketch-title" style={{ fontSize: "1.3rem" }}>
            [Live_Security_Stream]
          </span>
        </Box>
      </Box>

      {authentication && (
        <Box sx={{ p: 2, border: "1.5px solid var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--bg-primary)" }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)", mb: 1 }}>
            Continuous Authentication Status
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: "var(--font-mono)", color: authentication.riskLevel === "BASELINE_BUILDING" ? "var(--accent-olive-medium)" : "var(--text-primary)" }}>
            {authentication.riskLevel === "BASELINE_BUILDING" ? authentication.assessment.explanation : `Trust ${authentication.trustScore?.toFixed(2)}% · Risk ${authentication.riskScore?.toFixed(2)}%`}
          </Typography>
          <Typography variant="caption" sx={{ display: "block", color: "var(--text-secondary)", mt: 0.75 }}>
            Explainable timing comparison only. This signal does not prove identity or make an access-control decision.
          </Typography>
          {authentication.assessment.signals.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {authentication.assessment.signals.map((signal) => (
                <Typography key={signal.metric} variant="caption" sx={{ display: "block", color: "var(--text-secondary)" }}>
                  {signal.explanation}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)", mb: 1.5 }}>
          Live security event stream
        </Typography>
        <Typography variant="caption" sx={{ display: "block", color: "var(--text-secondary)" }}>
          SSE connection: {streamStatus}. Events are emitted after real authenticated analytics persistence.
        </Typography>
      </Box>

      {/* Incident Log Feed */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FileText size={16} color="var(--accent-olive-dark)" />
          <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
            Scenario Event Stream
          </Typography>
        </Box>

        <Box 
          sx={{ 
            display: "flex", 
            flexDirection: "column", 
            gap: 1.5, 
            maxHeight: "330px", 
            overflowY: "auto", 
            pr: 0.5 
          }}
        >
          {alerts.map((alert) => {
            let cardClass = "info";
            let IconComp = Info;
            let iconColor = "var(--accent-olive-dark)";

            if (alert.severity === "warning") {
              cardClass = "warning";
              IconComp = AlertOctagon;
              iconColor = "var(--alert-warning)";
            } else if (alert.severity === "critical") {
              cardClass = "critical";
              IconComp = ShieldAlert;
              iconColor = "var(--alert-critical)";
            }

            return (
              <Box key={alert.id} className={`alert-card ${cardClass}`}>
                <Box sx={{ mt: 0.3, color: iconColor }}>
                  <IconComp size={18} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: iconColor }}>
                      {alert.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {alert.time}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", lineHeight: "1.4", display: "block" }}>
                    {alert.desc}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
