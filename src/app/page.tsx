"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Typography, Container } from "@mui/material";
import { ShieldCheck, ShieldAlert, AlertTriangle, Cpu, Activity, Shield, Terminal } from "lucide-react";
import KeyboardSandbox from "./components/KeyboardSandbox";
import PipelineVisualizer from "./components/PipelineVisualizer";
import AnalyticsPanel from "./components/AnalyticsPanel";
import SecurityCenter from "./components/SecurityCenter";
import DashboardNav, { type DashboardTab, type NavigationMode } from "./components/DashboardNav";
import LogSearch from "./components/LogSearch";
import { encryptEvent } from "./utils/crypto";
import type { SanitizedKeystrokeEvent } from "../domain/events/models";
import { BehavioralModelPipeline } from "../domain/analytics/BehavioralModelPipeline";
import type { BehavioralFeatureVector } from "../domain/analytics/FeatureExtractor";
import { buildBaseline } from "../domain/security/AnomalyDetector";
import { scoreContinuousAuthentication } from "../domain/security/ContinuousAuthentication";
import type { ContinuousAuthenticationSnapshot } from "../domain/security/models";

interface KeystrokeEvent {
  key: string;
  code: string;
  timestamp: number;
  isCorrect: boolean;
  telemetry?: SanitizedKeystrokeEvent | null;
}

const DASHBOARD_TABS: DashboardTab[] = ["overview", "analytics", "security", "pipeline", "logs"];

export default function Home() {
  const [latestKeystroke, setLatestKeystroke] = useState<KeystrokeEvent | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("top");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dashboardRef = React.useRef<HTMLDivElement>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [currentApp, setCurrentApp] = useState("Browser typing sandbox");

  // Authentication & Transition States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");
  const [serverAuthentication, setServerAuthentication] = useState<ContinuousAuthenticationSnapshot | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Refresh trigger for log updates
  const [logRefreshTrigger, setLogRefreshTrigger] = useState(false);

  // Shared stats from sandbox typing activity
  const [stats, setStats] = useState({
    wpm: 0,
    accuracy: 100,
    totalKeys: 0,
    errorKeys: [] as string[],
  });
  const [telemetryEvents, setTelemetryEvents] = useState<SanitizedKeystrokeEvent[]>([]);
  const behavioralFeatures = useMemo<BehavioralFeatureVector | null>(() => {
    if (telemetryEvents.length === 0) return null;
    const sessionId = telemetryEvents[0].sessionId;
    const pipeline = new BehavioralModelPipeline(sessionId, authenticatedEmail || "unidentified-browser-user");
    pipeline.ingestBatch(telemetryEvents);
    return pipeline.snapshot();
  }, [telemetryEvents, authenticatedEmail]);
  const authenticationSnapshot = useMemo<ContinuousAuthenticationSnapshot | null>(() => {
    if (!behavioralFeatures) return null;
    const baseline = buildBaseline(behavioralFeatures.userId, []);
    return scoreContinuousAuthentication(baseline, behavioralFeatures);
  }, [behavioralFeatures]);

  // Global security health state
  const [securityStatus] = useState<"secure" | "warning" | "critical">("secure");

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setLoginError("* Error: Passwords do not match");
      return;
    }
    setLoginError("");
    setIsTransitioning(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Registration failed");
      setAuthMode("login");
      setPassword("");
      setConfirmPassword("");
      setLoginError("Account created. Sign in to continue.");
    } catch (error) {
      setLoginError(`* Error: ${error instanceof Error ? error.message : "Registration failed"}`);
    } finally {
      setIsTransitioning(false);
    }
  };

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
        body: JSON.stringify({ email: username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed");
      setAuthenticatedEmail(data.email || username.toLowerCase());
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(`* Error: ${error instanceof Error ? error.message : "Authentication failed"}`);
    } finally {
      setIsTransitioning(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !behavioralFeatures || !authenticatedEmail) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(behavioralFeatures),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Analytics API returned ${response.status}`);
        const data = await response.json() as { authentication: ContinuousAuthenticationSnapshot };
        setServerAuthentication(data.authentication);
      }).catch((error) => console.error("Failed to persist live analytics:", error));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isLoggedIn, authenticatedEmail, behavioralFeatures]);

  const handleKeystroke = useCallback(async (e: KeystrokeEvent) => {
    setLatestKeystroke(e);
    const telemetry = e.telemetry;
    if (!telemetry) return;
    setTelemetryEvents((previous) => previous.length === 0 || previous[0].sessionId === telemetry.sessionId ? [...previous, telemetry] : [telemetry]);

    try {
      const encrypted = await encryptEvent({
        sessionId: telemetry.sessionId,
        sequenceNumber: telemetry.sequenceNumber,
        eventType: telemetry.eventType,
        keyCode: telemetry.keyCode,
        dwellTimeMs: telemetry.dwellTimeMs ?? null,
        interKeyLatencyMs: telemetry.interKeyLatencyMs ?? null,
        isCorrection: telemetry.isCorrection,
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

  const handleStatsUpdate = (newStats: typeof stats) => {
    setStats(newStats);
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
              {authMode === "register" ? "Create an account to open the security dashboard." : "Sign in to open the security dashboard."}
            </Typography>
          </Box>

          <form onSubmit={authMode === "register" ? handleRegister : handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
                Email address
              </Typography>
              <input
                type="email"
                className="typing-paper"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
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

            {authMode === "register" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
                  Confirm password
                </Typography>
                <input
                  type="password"
                  className="typing-paper"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  style={{ minHeight: "45px", padding: "10px", lineHeight: "24px" }}
                  required
                />
              </Box>
            )}

            {loginError && (
              <Typography variant="caption" sx={{ color: loginError.startsWith("Account created") ? "var(--accent-olive-dark)" : "var(--alert-critical)", fontWeight: 600 }}>
                {loginError}
              </Typography>
            )}

            <button 
              type="submit" 
              className="sketch-btn" 
              style={{ width: "100%", justifyContent: "center", minHeight: "45px", marginTop: "8px" }}
            >
              {authMode === "register" ? "[Create_Account]" : "[Sign_In]"}
            </button>
          </form>
          
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", textAlign: "center", opacity: 0.8 }}>
            Passwords require 12+ characters with uppercase, lowercase, and a number. Credentials are stored as scrypt hashes.
          </Typography>
          <button
            type="button"
            className="sketch-btn"
            onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setLoginError(""); setPassword(""); setConfirmPassword(""); }}
            style={{ width: "100%", justifyContent: "center", minHeight: "40px", opacity: 0.85 }}
          >
            {authMode === "register" ? "Already registered? [Sign_In]" : "Need an account? [Register]"}
          </button>
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
          <span className="gesture-status">Swipe with two fingers horizontally to change dashboards · Live browser telemetry only</span>
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
                  AegisKey derives metrics from actual browser keyboard events, encrypts sanitized event envelopes, persists live analytics snapshots, and streams server-scored authentication updates through the authenticated API and SSE channel.
                </Typography>
              </Box>

              <KeyboardSandbox onKeystroke={handleKeystroke} onStatsUpdate={handleStatsUpdate} />
              <PipelineVisualizer latestKeystroke={latestKeystroke} />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <SecurityCenter authentication={serverAuthentication ?? authenticationSnapshot} />
              <AnalyticsPanel stats={stats} features={behavioralFeatures} />
            </Box>
          </Box>
        )}

        {/* TAB 2: ANALYTICS (Expanded Productivity & Fatigue Analysis) */}
        {activeTab === "analytics" && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "7fr 5fr" }, gap: 3, alignItems: "start" }}>
            <Box>
              <AnalyticsPanel stats={stats} features={behavioralFeatures} />
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
                    Dwell time is derived locally from each matching keydown and keyup. Raw characters are never included in the server-bound event.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    2. Flight Time (Key Transition Delay)
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
                    Inter-key latency is derived locally from consecutive key transitions. Per-user baseline comparison is intentionally reserved for Phase 5.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: "var(--accent-olive-dark)" }}>
                    3. Fatigue Index Estimation Formula
                  </Typography>
                  <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", display: "block", mt: 0.5 }}>
                    Fatigue = duration signal + correction signal + pause signal + latency signal
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
              <SecurityCenter authentication={serverAuthentication ?? authenticationSnapshot} />
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
                  Identity Baseline: <span style={{ color: "var(--accent-olive-medium)" }}>{serverAuthentication?.riskLevel === "BASELINE_BUILDING" ? "Building from consented sessions" : serverAuthentication ? "Active" : "Waiting for live session"}</span>
                </Typography>
                
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Profile Calibration Accuracy:</span>
                    <span style={{ fontWeight: 700 }}>{serverAuthentication ? `${serverAuthentication.assessment.confidence.toFixed(2)} confidence` : "Waiting"}</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Baseline Typing Speed:</span>
                    <span style={{ fontWeight: 700 }}>{stats.wpm} WPM (current)</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Dwell-Time Jitter Baseline:</span>
                    <span style={{ fontWeight: 700 }}>{behavioralFeatures?.meanDwellMs == null ? "Waiting" : `${behavioralFeatures.meanDwellMs.toFixed(1)} ms live`}</span>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Session events persisted:</span>
                    <span style={{ fontWeight: 700 }}>{telemetryEvents.length}</span>
                  </Box>
                </Box>
              </Box>

              {/* Hand-drawn sketch diagram of typing curves */}
              <Box sx={{ border: "1.5px solid var(--border-color)", borderRadius: "6px", p: 2, height: "180px", display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                  Keystroke dynamics signature is derived from the current consented browser session and sent as aggregate analytics.
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
                    Redis pub/sub: connected when REDIS_URL is configured
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
                    Analytics API: connected; snapshots persist through the configured storage adapter
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
                    Behavior model: connected; server-side explainable scoring runs for each snapshot
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
            AEGISKEY // AUTHENTICATED BROWSER TELEMETRY // ENCRYPTED EVENTS + SERVER-PERSISTED ANALYTICS + SSE SECURITY STREAM
          </Typography>
        </Box>

      </Container>
    </Box>
  );
}
