"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, Container } from "@mui/material";
import { ShieldCheck, ShieldAlert, AlertTriangle, Cpu, Activity, Shield, Terminal, AppWindow, FileSpreadsheet } from "lucide-react";
import KeyboardSandbox from "./components/KeyboardSandbox";
import PipelineVisualizer from "./components/PipelineVisualizer";
import AnalyticsPanel from "./components/AnalyticsPanel";
import SecurityCenter from "./components/SecurityCenter";
import LogSearch from "./components/LogSearch";
import { encryptEvent } from "./utils/crypto";

interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  isCorrect: boolean;
}

export default function Home() {
  const [latestKeystroke, setLatestKeystroke] = useState<KeystrokeEvent | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "security" | "pipeline" | "logs">("overview");
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentApp, setCurrentApp] = useState("VS Code");
  
  // Refresh trigger for log updates
  const [logRefreshTrigger, setLogRefreshTrigger] = useState(false);

  // Shared stats from sandbox typing activity
  const [stats, setStats] = useState({
    wpm: 0,
    accuracy: 100,
    totalKeys: 0,
    errorKeys: [] as string[],
  });

  // Global security health state
  const [securityStatus, setSecurityStatus] = useState<"secure" | "warning" | "critical">("secure");

  // Authentication & Transition States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError("* Error: Fields cannot be blank");
      return;
    }
    
    setLoginError("");
    setIsTransitioning(true);
    
    // Smooth transition from login to dashboard matching the balloon's flight time (2.2s)
    setTimeout(() => {
      setIsLoggedIn(true);
      setIsTransitioning(false);
    }, 2100);
  };

  // Background Live Workstation Simulator
  useEffect(() => {
    if (!isSimulating) return;

    const sampleSentence = "AegisKey endpoint protection active. Vertex AI is modeling user biometrics. AES-GCM encryption verified.";
    let charIndex = 0;

    const interval = setInterval(() => {
      const char = sampleSentence[charIndex];
      
      // QWERTY key mapping
      const codeMap: { [key: string]: string } = {
        a: "KeyA", b: "KeyB", c: "KeyC", d: "KeyD", e: "KeyE", f: "KeyF", g: "KeyG", h: "KeyH",
        i: "KeyI", j: "KeyJ", k: "KeyK", l: "KeyL", m: "KeyM", n: "KeyN", o: "KeyO", p: "KeyP",
        q: "KeyQ", r: "KeyR", s: "KeyS", t: "KeyT", u: "KeyU", v: "KeyV", w: "KeyW", x: "KeyX",
        y: "KeyY", z: "KeyZ", " ": "Space", ".": "Period", ",": "Comma"
      };

      const code = codeMap[char.toLowerCase()] || "KeyE";

      // Dispatch synthetic keydown/keyup globally to animate virtual keys
      if (typeof window !== "undefined") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: char, code }));
        setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent("keyup", { key: char, code }));
        }, 100);
      }

      // Trigger pipeline encryption
      handleKeystroke({
        key: char,
        code,
        timestamp: Date.now(),
        isCorrect: Math.random() > 0.04, // 96% accuracy
      });

      // Update statistics with organic fluctuations
      setStats((prev) => {
        const nextTotal = prev.totalKeys + 1;
        const speed = 74 + Math.round(Math.sin(nextTotal / 12) * 6); // Fluctuate WPM between 68 and 80
        const isErr = Math.random() > 0.95;
        const errors = isErr ? [...prev.errorKeys, code] : prev.errorKeys;
        const rawAccuracy = Math.round(((nextTotal - errors.length) / nextTotal) * 100);
        return {
          wpm: speed,
          accuracy: Math.max(92, Math.min(rawAccuracy, 100)),
          totalKeys: nextTotal,
          errorKeys: errors,
        };
      });

      charIndex = (charIndex + 1) % sampleSentence.length;
    }, 450);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleKeystroke = async (e: KeystrokeEvent) => {
    setLatestKeystroke(e);

    // Native encryption and API persistence flow
    try {
      const cryptoResult = await encryptEvent({ key: e.key, code: e.code });
      
      const payload = {
        key: e.key,
        code: e.code,
        timestamp: e.timestamp,
        isCorrect: e.isCorrect,
        app: currentApp,
        encrypted: cryptoResult.ciphertext,
      };

      // POST to our local endpoint, writing logs to keystroke_logs.jsonl
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: [payload] }),
      });

      // Toggle refresh trigger to hot-reload LogSearch panel
      setLogRefreshTrigger((prev) => !prev);
    } catch (err) {
      console.error("Failed to persist keystroke event:", err);
    }
  };

  const handleStatsUpdate = (newStats: typeof stats) => {
    setStats(newStats);
  };

  const handleStatusChange = (newStatus: "secure" | "warning" | "critical") => {
    setSecurityStatus(newStatus);
  };

  // Get status metadata for banner display
  const getSecurityHeaderConfig = () => {
    switch (securityStatus) {
      case "warning":
        return {
          label: "WARNING // HIGH-RISK ACTIVITY DETECTED",
          color: "var(--alert-warning)",
          bgColor: "var(--alert-warning-bg)",
          icon: AlertTriangle,
        };
      case "critical":
        return {
          label: "COMPROMISED // ACTIVE EXCEPTION LOCKED",
          color: "var(--alert-critical)",
          bgColor: "var(--alert-critical-bg)",
          icon: ShieldAlert,
        };
      case "secure":
      default:
        return {
          label: "SECURE // ENDPOINT SHIELD ACTIVE",
          color: "var(--alert-success)",
          bgColor: "var(--alert-success-bg)",
          icon: ShieldCheck,
        };
    }
  };

  const statusConfig = getSecurityHeaderConfig();
  const StatusIcon = statusConfig.icon;

  if (!isLoggedIn) {
    return (
      <Box className="login-bg">
        {/* Deflating Balloon overlay */}
        {isTransitioning && (
          <div className="sketched-balloon deflating-flight">
            <div className="balloon-air-tail" />
          </div>
        )}

        <Box 
          className="sketch-card" 
          sx={{ 
            width: "100%", 
            maxWidth: "380px", 
            p: 4, 
            display: "flex", 
            flexDirection: "column", 
            gap: 3,
            backgroundColor: "var(--bg-secondary)",
            zIndex: 10,
            transform: isTransitioning ? "scale(0.9) translateY(40px)" : "none",
            opacity: isTransitioning ? 0 : 1,
            transition: "all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)"
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <span className="sketch-title" style={{ fontSize: "1.8rem", display: "block" }}>
              [AegisKey_Shield]
            </span>
            <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block", mt: 0.5, fontStyle: "italic" }}>
              Verify identity to open security dashboard.
            </Typography>
          </Box>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
                Username
              </Typography>
              <input
                type="text"
                className="typing-paper"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. vanka"
                style={{ minHeight: "45px", padding: "10px", lineHeight: "24px" }}
                required
              />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
                Password
              </Typography>
              <input
                type="password"
                className="typing-paper"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ minHeight: "45px", padding: "10px", lineHeight: "24px" }}
                required
              />
            </Box>

            {loginError && (
              <Typography variant="caption" sx={{ color: "var(--alert-critical)", fontWeight: 600 }}>
                {loginError}
              </Typography>
            )}

            <button 
              type="submit" 
              className="sketch-btn" 
              style={{ width: "100%", justifyContent: "center", minHeight: "45px", marginTop: "8px" }}
            >
              [Verify_Identity]
            </button>
          </form>
          
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", textAlign: "center", opacity: 0.8 }}>
            Hint: Enter any credentials to trigger the deflating balloon animation.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Banner Status Bar */}
      <Box 
        sx={{ 
          borderBottom: "2px solid var(--border-color)",
          backgroundColor: statusConfig.bgColor,
          py: 1.5,
          px: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "all 0.4s ease",
          borderStyle: "none none solid none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <StatusIcon size={18} color={statusConfig.color} />
          <Typography 
            variant="caption" 
            sx={{ 
              fontFamily: "var(--font-mono)", 
              fontWeight: 700, 
              color: statusConfig.color, 
              letterSpacing: "1px" 
            }}
          >
            {statusConfig.label}
          </Typography>
        </Box>
        <Typography 
          variant="caption" 
          sx={{ 
            fontFamily: "var(--font-mono)", 
            color: "var(--text-secondary)",
            display: { xs: "none", sm: "block" }
          }}
        >
          AEGISKEY AGENT V2.8 // SHA-256 INTEGRITY VALIDATED
        </Typography>
      </Box>

      {/* Main Container */}
      <Container maxWidth="xl" sx={{ py: 4, flexGrow: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        
        {/* Drafting Board Header */}
        <Box 
          sx={{ 
            borderBottom: "1.5px dashed var(--border-color-light)", 
            pb: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 2
          }}
        >
          <Box>
            <Typography variant="h4" className="sketch-title" sx={{ fontWeight: 700 }}>
              AegisKey // Keystroke Analytics & AI Threat Shield
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5, fontStyle: "italic" }}>
              Technical design prototype detailing local keystroke biometrics, real AES-GCM encryption, and AI security diagnostics.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box 
              sx={{ 
                border: "1.5px solid var(--border-color)",
                borderRadius: "4px",
                px: 1.5,
                py: 0.5,
                backgroundColor: "var(--bg-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 600,
                boxShadow: "2px 2px 0px var(--border-color)"
              }}
            >
              LOC: EndPoint-S04
            </Box>
            <Box 
              sx={{ 
                border: "1.5px solid var(--border-color)",
                borderRadius: "4px",
                px: 1.5,
                py: 0.5,
                backgroundColor: "var(--bg-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 600,
                boxShadow: "2px 2px 0px var(--border-color)"
              }}
            >
              CRYPTO: AES-GCM
            </Box>
          </Box>
        </Box>

        {/* Tab Navigation & Live Simulator Toggle */}
        <Box sx={{ display: "flex", gap: 1.5, borderBottom: "1.5px dashed var(--border-color-light)", pb: 2, flexWrap: "wrap", alignItems: "center" }}>
          <button 
            className={`sketch-btn ${activeTab === "overview" ? "active" : ""}`} 
            onClick={() => setActiveTab("overview")}
          >
            [01_Overview]
          </button>
          <button 
            className={`sketch-btn ${activeTab === "analytics" ? "active" : ""}`} 
            onClick={() => setActiveTab("analytics")}
          >
            [02_Analytics]
          </button>
          <button 
            className={`sketch-btn ${activeTab === "security" ? "active" : ""}`} 
            onClick={() => setActiveTab("security")}
          >
            [03_AI_Shield]
          </button>
          <button 
            className={`sketch-btn ${activeTab === "logs" ? "active" : ""}`} 
            onClick={() => setActiveTab("logs")}
          >
            [04_Log_Search]
          </button>
          <button 
            className={`sketch-btn ${activeTab === "pipeline" ? "active" : ""}`} 
            onClick={() => setActiveTab("pipeline")}
          >
            [05_Debugger]
          </button>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Live Simulator Button */}
          <button 
            className="sketch-btn" 
            onClick={() => setIsSimulating(!isSimulating)}
            style={{ 
              borderColor: isSimulating ? "var(--accent-olive-medium)" : "var(--border-color)",
              backgroundColor: isSimulating ? "var(--accent-olive-pale)" : "transparent",
              color: isSimulating ? "var(--accent-olive-medium)" : "var(--text-primary)"
            }}
          >
            <Box 
              sx={{ 
                width: 8, 
                height: 8, 
                borderRadius: "50%", 
                backgroundColor: isSimulating ? "var(--accent-olive-medium)" : "var(--border-color-light)", 
                mr: 1, 
                display: "inline-block", 
                animation: isSimulating ? "ping 1.2s infinite" : "none" 
              }} 
            />
            {isSimulating ? "[Simulator: ACTIVE]" : "[Simulate_Live_Endpoint]"}
          </button>
        </Box>

        {/* TAB VIEWS RENDERING */}
        
        {/* TAB 1: OVERVIEW (Combined Dashboard Grid) */}
        {activeTab === "overview" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "7fr 5fr" }, gap: 3, alignItems: "start" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {/* Architecture highlights card */}
              <Box className="sketch-card" sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Cpu size={16} color="var(--accent-olive-dark)" />
                  <span className="sketch-title" style={{ fontSize: "1.1rem" }}>
                    [Pipeline_Architecture_Highlights]
                  </span>
                </Box>
                <Typography variant="body2" sx={{ color: "var(--text-secondary)", lineHeight: "1.5" }}>
                  AegisKey implements a robust zero-trust pipeline. When a key is pressed, the local agent captures the raw code, performs standard <strong>AES-GCM encryption</strong> in the browser sandbox, sends the encrypted payload through an event queue to the backend Spanner database, and triggers <strong>Vertex AI behavior biometrics</strong> (typing cadence models) to detect credential leaks and credential hijacking.
                </Typography>
              </Box>

              <KeyboardSandbox onKeystroke={handleKeystroke} onStatsUpdate={handleStatsUpdate} />
              <PipelineVisualizer latestKeystroke={latestKeystroke} />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <SecurityCenter onStatusChange={handleStatusChange} />
              <AnalyticsPanel stats={stats} />
            </Box>
          </Box>
        )}

        {/* TAB 2: ANALYTICS (Expanded Productivity & Fatigue Analysis) */}
        {activeTab === "analytics" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "7fr 5fr" }, gap: 3, alignItems: "start" }}>
            <Box>
              <AnalyticsPanel stats={stats} />
            </Box>
            
            <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Activity size={18} color="var(--accent-olive-dark)" />
                <span className="sketch-title" style={{ fontSize: "1.2rem" }}>
                  [Vertex_AI_Biometrics_Deep_Dive]
                </span>
              </Box>
              <Typography variant="body2" sx={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Typing biometrics (keystroke dynamics) operates by analyzing timing signatures in user behaviors:
              </Typography>
              
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    1. Dwell Time (Key Hold Time)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                    The duration between when a key is pressed down and when it is released. Standard baseline: 75ms.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    2. Flight Time (Key Transition Delay)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                    The duration between releasing one key and pressing the next key. Baseline average: 110ms.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    3. Fatigue Index Estimation Formula
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", display: "block", mt: 0.5 }}>
                    Fatigue = &Delta;Dwell_Time + Clustered_Backspaces * 1.5 + &sigma;(Flight_Time)
                  </Typography>
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "var(--accent-olive-dark)" }}>
                  Daily Focus Goal Status:
                </Typography>
                <Box sx={{ width: "100%", height: "20px", border: "1.5px solid var(--border-color)", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
                  <Box sx={{ width: "70%", height: "100%", backgroundColor: "var(--accent-olive-medium)" }} />
                  <Box sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "9px" }}>
                      70% Focus Goal Achieved (4.2 / 6 Hours Active)
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* TAB 3: SECURITY (Incident logs, Threat biometrics) */}
        {activeTab === "security" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "5fr 7fr" }, gap: 3, alignItems: "start" }}>
            <Box>
              <SecurityCenter onStatusChange={handleStatusChange} />
            </Box>

            <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Shield size={18} color="var(--accent-olive-dark)" />
                <span className="sketch-title" style={{ fontSize: "1.2rem" }}>
                  [Biometrics_Trust_Template]
                </span>
              </Box>
              
              <Box sx={{ p: 2, border: "1.5px dashed var(--border-color-light)", borderRadius: "6px", backgroundColor: "var(--accent-olive-tint)" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)", mb: 1 }}>
                  Baseline Owner Profile: <span style={{ color: "var(--accent-olive-medium)" }}>vanka</span>
                </Typography>
                
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Profile Calibration Accuracy:</span>
                    <span style={{ fontWeight: 700 }}>99.2%</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Baseline Typing Speed:</span>
                    <span style={{ fontWeight: 700 }}>78 WPM</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Dwell-Time Jitter Baseline:</span>
                    <span style={{ fontWeight: 700 }}>&plusmn;12ms</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Preferred Capitalizer hand:</span>
                    <span style={{ fontWeight: 700 }}>Left Shift (82%)</span>
                  </Box>
                </Box>
              </Box>

              {/* Hand-drawn sketch diagram of typing curves */}
              <Box sx={{ border: "1.5px solid var(--border-color)", borderRadius: "6px", p: 2, height: "180px", display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                  Keystroke dynamics dwell-time signature curve (baseline vs current):
                </Typography>
                <Box sx={{ flex: 1, position: "relative", mt: 1 }}>
                  {/* Drawing curve as SVG */}
                  <svg width="100%" height="100%" viewBox="0 0 400 120">
                    {/* Grid lines */}
                    <line x1="0" y1="100" x2="400" y2="100" stroke="var(--border-color-light)" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="50" x2="400" y2="50" stroke="var(--border-color-light)" strokeWidth="1" strokeDasharray="3,3" />
                    {/* Baseline curve (green/sage) */}
                    <path
                      d="M 10 90 Q 60 10 110 80 T 210 90 T 310 30 T 390 80"
                      fill="none"
                      stroke="var(--accent-olive-light)"
                      strokeWidth="2.5"
                    />
                    {/* Live curve (pulsing charcoal) */}
                    <path
                      d="M 10 88 Q 62 14 114 78 T 212 92 T 312 32 T 390 76"
                      fill="none"
                      stroke="var(--accent-olive-dark)"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                    />
                  </svg>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: "8px", color: "var(--text-secondary)" }}>Key Dwell (ms)</Typography>
                    <Typography variant="caption" sx={{ fontSize: "8px", color: "var(--accent-olive-medium)" }}>Baseline owner template (solid)</Typography>
                    <Typography variant="caption" sx={{ fontSize: "8px", color: "var(--accent-olive-dark)" }}>Live stream sequence (dashed)</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* TAB 4: LOG SEARCH (Active App logs, Search history query) */}
        {activeTab === "logs" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "5fr 7fr" }, gap: 3, alignItems: "start" }}>
            <Box>
              <KeyboardSandbox onKeystroke={handleKeystroke} onStatsUpdate={handleStatsUpdate} />
            </Box>
            <Box>
              <LogSearch 
                currentApp={currentApp} 
                onAppChange={(app) => setCurrentApp(app)} 
                triggerRefresh={logRefreshTrigger} 
              />
            </Box>
          </Box>
        )}

        {/* TAB 5: DEBUGGER (Full logs, PubSub statistics, Database specs) */}
        {activeTab === "pipeline" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box>
              <PipelineVisualizer latestKeystroke={latestKeystroke} />
            </Box>

            <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Terminal size={18} color="var(--accent-olive-dark)" />
                <span className="sketch-title" style={{ fontSize: "1.2rem" }}>
                  [Pipeline_Telemetry_Debugger]
                </span>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
                <Box sx={{ p: 2, border: "1.5px solid var(--border-color)", borderRadius: "6px" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    Pub/Sub Ingestion Shards
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, display: "block" }}>
                    Topic: `keystroke-ingest-prod`
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                    Active Shards: 64 Partitioned
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--accent-olive-medium)", fontWeight: 600, display: "block", mt: 1 }}>
                    Status: Nominal (0 message lag)
                  </Typography>
                </Box>
                <Box sx={{ p: 2, border: "1.5px solid var(--border-color)", borderRadius: "6px" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    Spanner Storage Partition
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, display: "block" }}>
                    Instance: `aegiskey-db-regional`
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                    Write rate: ~4.2M rows/sec peak
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--accent-olive-medium)", fontWeight: 600, display: "block", mt: 1 }}>
                    Disk Util: 14.8% SLA Validated
                  </Typography>
                </Box>
                <Box sx={{ p: 2, border: "1.5px solid var(--border-color)", borderRadius: "6px" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    Vertex AI Pipeline Model
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, display: "block" }}>
                    Base: JAX Transformer-12L
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                    Inference latency: 4.8ms average
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--accent-olive-medium)", fontWeight: 600, display: "block", mt: 1 }}>
                    Accuracy rate: 99.8% (False Positive &lt; 0.01%)
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Footer */}
        <Box 
          sx={{ 
            borderTop: "1.5px dashed var(--border-color-light)", 
            pt: 3, 
            mt: 4, 
            textAlign: "center",
            pb: 2
          }}
        >
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
            AEGISKEY // GOOGLE CLOUD SECURITY & VERTEX AI SYSTEM DESIGN SPECIFICATION v2.8 // DEVELOPED FOR INTEGRITY TESTING.
          </Typography>
        </Box>

      </Container>
    </Box>
  );
}
