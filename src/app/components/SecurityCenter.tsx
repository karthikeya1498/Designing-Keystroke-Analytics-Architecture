"use client";

import React, { useState } from "react";
import { Box, Typography } from "@mui/material";
import { ShieldAlert, ShieldCheck, Key, UserCheck, AlertOctagon, Info, FileText } from "lucide-react";

interface Alert {
  id: string;
  time: string;
  title: string;
  desc: string;
  severity: "info" | "warning" | "critical";
}

interface SecurityCenterProps {
  onStatusChange: (status: "secure" | "warning" | "critical") => void;
}

export default function SecurityCenter({ onStatusChange }: SecurityCenterProps) {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: "1",
      time: "19:05:04",
      title: "Browser Prototype Initialized",
      desc: "Browser typing sandbox ready. Event encryption uses a non-extractable local AES-256-GCM key; no OS daemon is running.",
      severity: "info",
    },
    {
      id: "2",
      time: "19:06:12",
      title: "Derived Metrics Available",
      desc: "Session metrics are derived from observed sandbox input. No user identity or behavioral baseline has been calibrated.",
      severity: "info",
    },
  ]);

  const triggerThreat = (type: "credential" | "insider" | "biometric") => {
    const timeStr = new Date().toISOString().split("T")[1].slice(0, 8);
    let newAlert: Alert;

    if (type === "credential") {
      newAlert = {
        id: Date.now().toString(),
        time: timeStr,
        title: "SIMULATION: Credential Leak Scenario",
        desc: "Synthetic scenario only. The browser prototype does not inspect other applications, clipboard contents, or credentials.",
        severity: "critical",
      };
      onStatusChange("critical");
    } else if (type === "insider") {
      newAlert = {
        id: Date.now().toString(),
        time: timeStr,
        title: "SIMULATION: High-Risk Activity",
        desc: "Synthetic scenario only. This repository does not observe command execution, windows, working hours, or context switching.",
        severity: "warning",
      };
      onStatusChange("warning");
    } else {
      newAlert = {
        id: Date.now().toString(),
        time: timeStr,
        title: "SIMULATION: Cadence Mismatch",
        desc: "Synthetic scenario only. No Vertex AI model or identity baseline is connected; dwell and flight times are not collected.",
        severity: "critical",
      };
      onStatusChange("critical");
    }

    setAlerts((prev) => [newAlert, ...prev]);
  };

  const resolveThreats = () => {
    const timeStr = new Date().toISOString().split("T")[1].slice(0, 8);
    setAlerts((prev) => [
      {
        id: Date.now().toString(),
        time: timeStr,
        title: "System Restored",
        desc: "All active security exceptions resolved. Cadence tracking returned to baseline monitoring state.",
        severity: "info",
      },
      ...prev,
    ]);
    onStatusChange("secure");
  };

  return (
    <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ShieldAlert size={20} color="var(--accent-olive-dark)" />
          <span className="sketch-title" style={{ fontSize: "1.3rem" }}>
            [Security_Scenario_Simulator]
          </span>
        </Box>
      </Box>

      {/* Interactive Threat Simulator Control Board */}
      <Box sx={{ p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)", mb: 1.5 }}>
          Synthetic threat scenarios (not an OS agent or AI detector)
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <button className="sketch-btn" onClick={() => triggerThreat("credential")}>
            <Key size={14} /> Leak Credential
          </button>
          <button className="sketch-btn" onClick={() => triggerThreat("insider")}>
            <AlertOctagon size={14} /> Insider Threat
          </button>
          <button className="sketch-btn" onClick={() => triggerThreat("biometric")}>
            <UserCheck size={14} /> Cadence Hijack
          </button>
          <button 
            className="sketch-btn" 
            onClick={resolveThreats}
            style={{ borderColor: "var(--alert-success)", color: "var(--alert-success)" }}
          >
            <ShieldCheck size={14} /> Resolve All
          </button>
        </Box>
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
