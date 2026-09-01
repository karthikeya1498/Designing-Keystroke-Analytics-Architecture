"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import { Activity, BarChart3, FileSearch, Gauge, LayoutDashboard, Maximize2, Minimize2, PanelLeft, PanelBottom, PanelTop, Shield } from "lucide-react";

export type DashboardTab = "overview" | "analytics" | "security" | "pipeline" | "logs";
export type NavigationMode = "top" | "sidebar" | "bottom";

interface DashboardNavProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  mode: NavigationMode;
  onModeChange: (mode: NavigationMode) => void;
  isFullscreen: boolean;
  onFullscreen: () => void;
}

const ITEMS: Array<{ id: DashboardTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "security", label: "Security", icon: Shield },
  { id: "pipeline", label: "Pipeline", icon: Activity },
  { id: "logs", label: "Encrypted Logs", icon: FileSearch },
];

const MODE_ITEMS: Array<{ id: NavigationMode; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: "top", label: "Top", icon: PanelTop },
  { id: "sidebar", label: "Side", icon: PanelLeft },
  { id: "bottom", label: "Bottom", icon: PanelBottom },
];

export default function DashboardNav({ activeTab, onTabChange, mode, onModeChange, isFullscreen, onFullscreen }: DashboardNavProps) {
  const navClass = `dashboard-nav dashboard-nav-${mode}`;

  return (
    <Box className={navClass} component="nav" aria-label="Dashboard navigation">
      <Box className="dashboard-nav-brand">
        <Gauge size={18} />
        <span>AEGISKEY</span>
      </Box>
      <Box className="dashboard-nav-items">
        {ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`dashboard-nav-item ${activeTab === id ? "active" : ""}`} onClick={() => onTabChange(id)} aria-current={activeTab === id ? "page" : undefined}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </Box>
      <Box className="dashboard-nav-actions">
        <Typography className="dashboard-nav-hint">Swipe with two fingers to change dashboards</Typography>
        <Box className="dashboard-mode-switcher" aria-label="Navigation layout">
          {MODE_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`dashboard-mode-button ${mode === id ? "active" : ""}`} onClick={() => onModeChange(id)} title={`${label} navigation`} aria-label={`${label} navigation`}>
              <Icon size={14} />
            </button>
          ))}
        </Box>
        <button className="dashboard-fullscreen-button" onClick={onFullscreen} title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          <span>{isFullscreen ? "Exit" : "Full screen"}</span>
        </button>
      </Box>
    </Box>
  );
}
