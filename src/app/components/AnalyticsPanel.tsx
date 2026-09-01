"use client";

import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { Gauge, Hourglass, Activity } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface AnalyticsPanelProps {
  stats: {
    wpm: number;
    accuracy: number;
    totalKeys: number;
    errorKeys: string[];
  };
}

export default function AnalyticsPanel({ stats }: AnalyticsPanelProps) {
  const wpmHistory = stats.wpm > 0 ? [stats.wpm] : [];
  const labels = stats.wpm > 0 ? ["Current"] : [];
  const fatigue = useMemo(() => {
    if (stats.totalKeys === 0) return 0;
    const errorRatio = stats.errorKeys.length / Math.max(1, stats.totalKeys);
    const accuracyFactor = (100 - stats.accuracy) * 3;
    return Math.max(0, Math.min(Math.round(15 + accuracyFactor + errorRatio * 20), 95));
  }, [stats.accuracy, stats.totalKeys, stats.errorKeys]);

  // Chart configuration
  const chartData = {
    labels,
    datasets: [
      {
        fill: true,
        label: "Words Per Minute (WPM)",
        data: wpmHistory,
        borderColor: "#556b2f", // Olive accent
        borderWidth: 2,
        backgroundColor: "rgba(124, 144, 99, 0.15)", // Translucent olive
        tension: 0.3,
        pointBackgroundColor: "#3a422d",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "#3a422d",
        titleFont: { family: "Outfit" },
        bodyFont: { family: "Outfit" },
        cornerRadius: 4,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { family: "Outfit", size: 10 },
          color: "#5e6653",
        },
      },
      y: {
        min: 0,
        max: 150,
        grid: {
          color: "rgba(58, 66, 45, 0.05)",
        },
        ticks: {
          font: { family: "Outfit", size: 10 },
          color: "#5e6653",
        },
      },
    },
  };

  // Status text for Fatigue
  const getFatigueStatus = (val: number) => {
    if (val < 25) return { text: "Optimal", color: "var(--alert-success)" };
    if (val < 50) return { text: "Mild Fatigue", color: "var(--accent-olive-medium)" };
    if (val < 75) return { text: "Warning: Erratic Cadence", color: "var(--alert-warning)" };
    return { text: "Alert: Extreme Fatigue Detected", color: "var(--alert-critical)" };
  };

  const fatigueStatus = getFatigueStatus(fatigue);

  // A browser sandbox cannot observe a 24-hour workstation history. Keep the
  // visualization empty rather than presenting fabricated historical activity.
  const hourlyActivity = Array.from({ length: 24 }, () => 0);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, height: "100%" }}>
      {/* Real-time stats header row */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <Box className="sketch-card" sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Speed (WPM)
          </Typography>
          <Typography variant="h3" className="sketch-title" sx={{ mt: 0.5, fontSize: "1.8rem" }}>
            {stats.wpm}
          </Typography>
        </Box>
        <Box className="sketch-card" sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Accuracy
          </Typography>
          <Typography variant="h3" className="sketch-title" sx={{ mt: 0.5, fontSize: "1.8rem" }}>
            {stats.accuracy}%
          </Typography>
        </Box>
        <Box className="sketch-card" sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Keys Typed
          </Typography>
          <Typography variant="h3" className="sketch-title" sx={{ mt: 0.5, fontSize: "1.8rem" }}>
            {stats.totalKeys}
          </Typography>
        </Box>
        <Box className="sketch-card" sx={{ p: 2, textAlign: "center" }}>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)", fontWeight: 500 }}>
            Fatigue Level
          </Typography>
          <Typography variant="h3" className="sketch-title" sx={{ mt: 0.5, fontSize: "1.8rem", color: fatigueStatus.color }}>
            {fatigue}%
          </Typography>
        </Box>
      </Box>

      {/* Line Chart Panel */}
      <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 2, height: "260px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Activity size={16} color="var(--accent-olive-dark)" />
            <span className="sketch-title" style={{ fontSize: "1.1rem" }}>
              [Real-Time_Typing_Speed_Cadence]
            </span>
          </Box>
          <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
            Rolling interval (updates as you type)
          </Typography>
        </Box>
        
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Line data={chartData} options={chartOptions} />
        </Box>
      </Box>

      {/* Fatigue & Productivity breakdown */}
      {/* Fatigue & Productivity breakdown */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
        {/* Fatigue Index Gauge */}
        <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 2, height: "230px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Gauge size={16} color="var(--accent-olive-dark)" />
            <span className="sketch-title" style={{ fontSize: "1.1rem" }}>
              [Cognitive_Fatigue_Index]
            </span>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-around", flex: 1 }}>
            {/* Circular Sketched Progress Arc */}
            <Box sx={{ position: "relative", width: 100, height: 100 }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="var(--border-color-light)"
                  strokeWidth="4"
                  strokeDasharray="4, 4"
                />
                {/* Fill Indicator */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={fatigueStatus.color}
                  strokeWidth="5"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * fatigue) / 100}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography variant="body1" className="sketch-title" sx={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  {fatigue}%
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--accent-olive-dark)" }}>
                Status: <span style={{ color: fatigueStatus.color }}>{fatigueStatus.text}</span>
              </Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)", maxWidth: "180px", display: "block" }}>
                Derived from this session&apos;s observed accuracy, error ratio, and key count. Dwell time, focus duration, and behavioral identity models are not collected by this prototype.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Heatmap/Active Hours Panel */}
        <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 2, height: "230px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Hourglass size={16} color="var(--accent-olive-dark)" />
            <span className="sketch-title" style={{ fontSize: "1.1rem" }}>
              [Observed_Session_Activity]
            </span>
          </Box>

          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>
              No 24-hour focus history is available in this browser-only session.
            </Typography>

            {/* Grid block representation */}
            <Box sx={{ display: "flex", gap: "2px", width: "100%", height: "70px", mt: 1 }}>
              {hourlyActivity.map((val, idx) => {
                // Color shades depending on hourly typing intensity
                let bg = "var(--bg-primary)";
                if (val > 80) bg = "var(--accent-olive-dark)";
                else if (val > 50) bg = "var(--accent-olive-medium)";
                else if (val > 20) bg = "var(--accent-olive-light)";
                else if (val > 0) bg = "var(--accent-olive-pale)";

                return (
                  <Box
                    key={idx}
                    sx={{
                      flex: 1,
                      backgroundColor: bg,
                      border: "1px solid var(--border-color-light)",
                      borderRadius: "2px",
                      height: "100%",
                      position: "relative",
                      cursor: "pointer",
                      "&:hover::after": {
                        content: `"${idx}:00 - ${val}%"`,
                        position: "absolute",
                        bottom: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "var(--accent-olive-dark)",
                        color: "white",
                        padding: "2px 4px",
                        fontSize: "8px",
                        borderRadius: "2px",
                        whiteSpace: "nowrap",
                        zIndex: 5,
                      },
                    }}
                  />
                );
              })}
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>00:00 (Midnight)</Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>12:00 (Noon)</Typography>
              <Typography variant="caption" sx={{ color: "var(--text-secondary)" }}>23:00</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
