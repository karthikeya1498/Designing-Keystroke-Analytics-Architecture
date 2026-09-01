"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Container } from "@mui/material";
import { ShieldCheck, ShieldAlert, AlertTriangle, Cpu, Activity, Shield, Terminal } from "lucide-react";
import KeyboardSandbox from "./components/KeyboardSandbox";
import PipelineVisualizer from "./components/PipelineVisualizer";
import AnalyticsPanel from "./components/AnalyticsPanel";
import SecurityCenter from "./components/SecurityCenter";
import DashboardNav, { type DashboardTab, type NavigationMode } from "./components/DashboardNav";
import LogSearch from "./components/LogSearch";
import { encryptEvent } from "./utils/crypto";

interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  isCorrect: boolean;
}

const DASHBOARD_TABS: DashboardTab[] = ["overview", "analytics", "security", "pipeline", "logs"];

export default function Home() {
  const [latestKeystroke, setLatestKeystroke] = useState<KeystrokeEvent | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("top");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentApp, setCurrentApp] = useState("Browser typing sandbox");
  
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

  const changeDashboardBySwipe = useCallback((direction: "next" | "previous") => {
    setActiveTab((current) => {
      const index = DASHBOARD_TABS.indexOf(current);
      const nextIndex = direction === "next" ? (index + 1) % DASHBOARD_TABS.length : (index - 1 + DASHBOARD_TABS.length) % DASHBOARD_TABS.length;
      return DASHBOARD_TABS[nextIndex];
    });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await dashboardRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError("* Error: Fields cannot be blank");
      return;
    }

    setLoginError("");
    setIsTransitioning(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed");
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(`* Error: ${error instanceof Error ? error.message : "Authentication failed"}`);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleKeystroke = useCallback(async (e: KeystrokeEvent) => {
    setLatestKeystroke(e);

    try {
      const encrypted = await encryptEvent({
        key: e.key,
        code: e.code,
        timestamp: e.timestamp,
        isCorrect: e.isCorrect,
      });

      const response = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: [{
            eventId: crypto.randomUUID(),
            timestamp: e.timestamp,
            app: currentApp,
            isCorrect: e.isCorrect,
            ...encrypted,
          }],
        }),
      });

      if (!response.ok) throw new Error(`Log ingestion failed (${response.status})`);
      setLogRefreshTrigger((prev) => !prev);
    } catch (err) {
      console.error("Failed to persist encrypted keystroke event:", err);
    }
  }, [currentApp]);

  // Background Live Workstation Simulator
  useEffect(() => {
    if (!isSimulating) return;

    const sampleSentence = "AegisKey browser sandbox is active. Local metrics are derived from observed input. AES-GCM encryption verified.";
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
        // Deterministic demo signal: every 23rd generated event is marked as a synthetic error.
        isCorrect: charIndex % 23 !== 0,
      });

      // Update statistics with organic fluctuations
      setStats((prev) => {
        const nextTotal = prev.totalKeys + 1;
        const speed = 74 + Math.round(Math.sin(nextTotal / 12) * 6); // Fluctuate WPM between 68 and 80
        const isErr = charIndex % 23 === 0;
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
  }, [isSimulating, handleKeystroke]);

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
                placeholder="e.g. demo-operator"
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
            Configure dashboard credentials in `.env.local` before signing in. Local demo mode accepts `demo` / `demo`.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box ref={dashboardRef} className={`aegiskey-shell ${isFullscreen ? "is-fullscreen" : ""}`} sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }} onTouchStart={(event) => {
      if (event.touches.length >= 2) touchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }} onTouchEnd={(event) => {
      if (!touchStartRef.current || event.changedTouches.length === 0) return;
      const deltaX = event.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = event.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) changeDashboardBySwipe(deltaX < 0 ? "next" : "previous");
    }}>
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
      <Container maxWidth="xl" className={`dashboard-content ${navigationMode === "sidebar" ? "has-sidebar" : ""}`} sx={{ py: 4, flexGrow: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        
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
              AegisKey // Keystroke Analytics & Security Telemetry
            </Typography>
            <Typography variant="body2" sx={{ color: "var(--text-secondary)", mt: 0.5, fontStyle: "italic" }}>
              Technical design prototype: browser sandbox telemetry, local derived metrics, and encrypted event envelopes. Simulated security scenarios are clearly labeled.
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

        <DashboardNav activeTab={activeTab} onTabChange={setActiveTab} mode={navigationMode} onModeChange={setNavigationMode} isFullscreen={isFullscreen} onFullscreen={() => void toggleFullscreen()} />
        <Box className="simulator-toolbar">
          <span className="gesture-status">Swipe with two fingers horizontally to change dashboards</span>
          <button className="sketch-btn" onClick={() => setIsSimulating((active) => !active)} style={{ borderColor: isSimulating ? "var(--accent-olive-medium)" : "var(--border-color)", backgroundColor: isSimulating ? "var(--accent-olive-pale)" : "transparent", color: isSimulating ? "var(--accent-olive-medium)" : "var(--text-primary)" }}>
            <span className={`simulator-dot ${isSimulating ? "active" : ""}`} />
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
                  AegisKey is a browser-based architecture prototype. The typing sandbox derives local metrics and encrypts each event into an AES-256-GCM envelope before sending it to the demo ingestion API. The current repository does not include an OS-level agent, managed queue, Spanner database, or Vertex AI model; those are documented production extension points rather than active dependencies.
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
                  [Derived_Metrics_Deep_Dive]
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
                    The browser prototype does not collect keydown-to-keyup dwell time. A production agent could add this metric with explicit consent.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    2. Flight Time (Key Transition Delay)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                    The browser prototype does not establish a user baseline. A production agent could derive transition timing after calibration and retention controls.
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
                      Focus duration unavailable in browser-only mode
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
                  Identity Baseline: <span style={{ color: "var(--accent-olive-medium)" }}>Not configured</span>
                </Typography>
                
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Profile Calibration Accuracy:</span>
                    <span style={{ fontWeight: 700 }}>N/A</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Baseline Typing Speed:</span>
                    <span style={{ fontWeight: 700 }}>{stats.wpm} WPM (current)</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Dwell-Time Jitter Baseline:</span>
                    <span style={{ fontWeight: 700 }}>N/A</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Preferred Capitalizer hand:</span>
                    <span style={{ fontWeight: 700 }}>N/A</span>
                  </Box>
                </Box>
              </Box>

              {/* Hand-drawn sketch diagram of typing curves */}
              <Box sx={{ border: "1.5px solid var(--border-color)", borderRadius: "6px", p: 2, height: "180px", display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                  Keystroke dynamics signature: unavailable until a consented agent collects dwell and flight timings.
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
                    Production Queue Extension Point
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, display: "block" }}>
                    Managed queue: not connected in this repository
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                    Required controls: partitioning, back-pressure, dead-letter handling
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--accent-olive-medium)", fontWeight: 600, display: "block", mt: 1 }}>
                    Status: design-only / not active
                  </Typography>
                </Box>
                <Box sx={{ p: 2, border: "1.5px solid var(--border-color)", borderRadius: "6px" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    Production Database Extension Point
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, display: "block" }}>
                    Database: not connected; local development uses append-only file storage
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                    Required controls: tenant isolation, indexes, retention, encryption at rest
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--accent-olive-medium)", fontWeight: 600, display: "block", mt: 1 }}>
                    Status: design-only / not measured
                  </Typography>
                </Box>
                <Box sx={{ p: 2, border: "1.5px solid var(--border-color)", borderRadius: "6px" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    Behavior Model Extension Point
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", mt: 0.5, display: "block" }}>
                    Model: not connected; current scoring is deterministic local heuristics
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "block" }}>
                    Required controls: consent, drift monitoring, bias evaluation, abstention
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--accent-olive-medium)", fontWeight: 600, display: "block", mt: 1 }}>
                    Status: design-only / no accuracy claim
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
            AEGISKEY // BROWSER PROTOTYPE // ENCRYPTED EVENT ENVELOPES + DERIVED SESSION METRICS // NO OS AGENT OR AI SERVICE CONNECTED
          </Typography>
        </Box>

      </Container>
    </Box>
  );
}
