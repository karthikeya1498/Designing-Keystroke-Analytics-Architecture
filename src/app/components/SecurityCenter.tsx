"use client";

import React, { useState } from "react";
import { Box, Typography, Button } from "@mui/material";
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
      title: "Local Agent Initialized",
      desc: "Keystroke monitoring daemon started on port 8084. AES-256-GCM symmetric key negotiation complete.",
      severity: "info",
    },
    {
      id: "2",
      time: "19:06:12",
      title: "Biometric Cadence Calibrated",
      desc: "Baseline typing cadence profile established for user 'vanka' (78 WPM baseline, 96.4% baseline accuracy).",
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
        title: "CRITICAL: Plaintext Credential Leak",
        desc: "Endpoint agent intercepted and blocked high-entropy AWS secret API key typed in public chat buffer: 'AKIAIOSFODNN7EXAMPLE'.",
        severity: "critical",
      };
      onStatusChange("critical");
    } else if (type === "insider") {
      newAlert = {
        id: Date.now().toString(),
        time: timeStr,
        title: "WARNING: High-Risk Insider Activity",
        desc: "Unusual off-hours active typing context. Repeated command executions (pg_dump, git push --force) coupled with high context switching (22 windows/min).",
        severity: "warning",
      };
      onStatusChange("warning");
    } else {
      newAlert = {
        id: Date.now().toString(),
        time: timeStr,
        title: "CRITICAL: Behavioral Dynamics Mismatch",
        desc: "Vertex AI typing cadence model detected 84% variance from owner's typing template (dwell time & flight time mismatch). Potential session hijack.",
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
            [AI_Security_Detection_Center]
          </span>
        </Box>
      </Box>

      {/* Interactive Threat Simulator Control Board */}
      <Box sx={{ p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)", mb: 1.5 }}>
          Endpoint Threat Vectors Simulator
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
            Real-Time Detections Stream
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
