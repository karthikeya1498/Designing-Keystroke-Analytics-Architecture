"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { SanitizedTelemetryCollector } from "../../domain/events/TelemetryCollector";

// QWERTY layout matching event.code
const KEYBOARD_LAYOUT = [
  [
    { code: "Backquote", label: "`", width: 1 },
    { code: "Digit1", label: "1", width: 1 },
    { code: "Digit2", label: "2", width: 1 },
    { code: "Digit3", label: "3", width: 1 },
    { code: "Digit4", label: "4", width: 1 },
    { code: "Digit5", label: "5", width: 1 },
    { code: "Digit6", label: "6", width: 1 },
    { code: "Digit7", label: "7", width: 1 },
    { code: "Digit8", label: "8", width: 1 },
    { code: "Digit9", label: "9", width: 1 },
    { code: "Digit0", label: "0", width: 1 },
    { code: "Minus", label: "-", width: 1 },
    { code: "Equal", label: "=", width: 1 },
    { code: "Backspace", label: "Bksp", width: 1.8 },
  ],
  [
    { code: "Tab", label: "Tab", width: 1.5 },
    { code: "KeyQ", label: "Q", width: 1 },
    { code: "KeyW", label: "W", width: 1 },
    { code: "KeyE", label: "E", width: 1 },
    { code: "KeyR", label: "R", width: 1 },
    { code: "KeyT", label: "T", width: 1 },
    { code: "KeyY", label: "Y", width: 1 },
    { code: "KeyU", label: "U", width: 1 },
    { code: "KeyI", label: "I", width: 1 },
    { code: "KeyO", label: "O", width: 1 },
    { code: "KeyP", label: "P", width: 1 },
    { code: "BracketLeft", label: "[", width: 1 },
    { code: "BracketRight", label: "]", width: 1 },
    { code: "Backslash", label: "\\", width: 1.3 },
  ],
  [
    { code: "CapsLock", label: "Caps", width: 1.8 },
    { code: "KeyA", label: "A", width: 1 },
    { code: "KeyS", label: "S", width: 1 },
    { code: "KeyD", label: "D", width: 1 },
    { code: "KeyF", label: "F", width: 1 },
    { code: "KeyG", label: "G", width: 1 },
    { code: "KeyH", label: "H", width: 1 },
    { code: "KeyJ", label: "J", width: 1 },
    { code: "KeyK", label: "K", width: 1 },
    { code: "KeyL", label: "L", width: 1 },
    { code: "Semicolon", label: ";", width: 1 },
    { code: "Quote", label: "'", width: 1 },
    { code: "Enter", label: "Enter", width: 2 },
  ],
  [
    { code: "ShiftLeft", label: "Shift", width: 2.2 },
    { code: "KeyZ", label: "Z", width: 1 },
    { code: "KeyX", label: "X", width: 1 },
    { code: "KeyC", label: "C", width: 1 },
    { code: "KeyV", label: "V", width: 1 },
    { code: "KeyB", label: "B", width: 1 },
    { code: "KeyN", label: "N", width: 1 },
    { code: "KeyM", label: "M", width: 1 },
    { code: "Comma", label: ",", width: 1 },
    { code: "Period", label: ".", width: 1 },
    { code: "Slash", label: "/", width: 1 },
    { code: "ShiftRight", label: "Shift", width: 1.8 },
  ],
  [
    { code: "ControlLeft", label: "Ctrl", width: 1.5 },
    { code: "MetaLeft", label: "Win", width: 1 },
    { code: "AltLeft", label: "Alt", width: 1 },
    { code: "Space", label: "Spacebar", width: 6.5 },
    { code: "AltRight", label: "Alt", width: 1 },
    { code: "ControlRight", label: "Ctrl", width: 1.5 },
  ],
];

// Pre-defined error rates per key to simulate "Error Patterns" visual overlay
const HISTORICAL_ERROR_RATES: { [key: string]: number } = {
  KeyQ: 0.14,
  KeyP: 0.18,
  KeyZ: 0.15,
  KeyA: 0.08,
  KeyB: 0.11,
  KeyX: 0.09,
  KeyM: 0.07,
  Backspace: 0.05,
};

const SAMPLE_TEXTS = [
  "The quick brown fox jumps over the lazy dog.",
  "Local metrics summarize this browser typing session.",
  "Encryption via AES-256 secures endpoints from insider threats.",
  "High WPM and steady cadence show high focus and low fatigue.",
];

interface KeyboardSandboxProps {
  onKeystroke: (keyEvent: {
    key: string;
    code: string;
    timestamp: number;
    isCorrect: boolean;
    telemetry: ReturnType<SanitizedTelemetryCollector["keyDown"]>;
  }) => void;
  onStatsUpdate: (stats: { wpm: number; accuracy: number; totalKeys: number; errorKeys: string[] }) => void;
}

export default function KeyboardSandbox({ onKeystroke, onStatsUpdate }: KeyboardSandboxProps) {
  const [textIndex, setTextIndex] = useState(0);
  const targetText = SAMPLE_TEXTS[textIndex];
  
  const [typedText, setTypedText] = useState("");
  const [activeKeys, setActiveKeys] = useState<{ [code: string]: boolean }>({});
  
  // Typing metrics tracking
  const [startTime, setStartTime] = useState<number | null>(null);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [errorKeysList, setErrorKeysList] = useState<string[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [telemetryCollector] = useState(() => new SanitizedTelemetryCollector());

  // Focus textarea on load
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [textIndex]);

  // Handle global key events to light up on-screen keyboard even if typing fast
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Light up the key on the virtual keyboard
      setActiveKeys((prev) => ({ ...prev, [e.code]: true }));
      
      // Calculate correctness based on text position
      if (textareaRef.current === document.activeElement) {
        const currentPos = typedText.length;
        const targetChar = targetText[currentPos];
        const typedChar = e.key;

        // Skip modifier keys for accuracy and WPM
        const isModifier = ["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(typedChar);
        if (!isModifier) {
          let isCorrect = true;
          if (typedChar === "Backspace") {
            setBackspaceCount((prev) => prev + 1);
            isCorrect = true; // Backspace itself is correcting
          } else if (targetChar !== undefined) {
            isCorrect = typedChar === targetChar;
            if (!isCorrect) {
              setErrorKeysList((prev) => [...prev, e.code]);
            }
          }

          // Trigger pipeline notification
          const telemetry = telemetryCollector.keyDown({ keyCode: e.code, timestamp: Date.now(), isCorrection: typedChar === "Backspace" });
          if (telemetry) {
            onKeystroke({ key: typedChar, code: e.code, timestamp: telemetry.timestamp, isCorrect, telemetry });
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setActiveKeys((prev) => ({ ...prev, [e.code]: false }));
      if (textareaRef.current === document.activeElement) {
        const telemetry = telemetryCollector.keyUp({ keyCode: e.code, timestamp: Date.now() });
        if (telemetry) onKeystroke({ key: "", code: e.code, timestamp: telemetry.timestamp, isCorrect: true, telemetry });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [typedText, targetText, onKeystroke, telemetryCollector]);

  // Handle input text changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Start timing on first keypress
    if (!startTime && value.length > 0) {
      // eslint-disable-next-line react-hooks/purity
      setStartTime(Date.now());
    }

    setTypedText(value);

    // Compute metrics
    // eslint-disable-next-line react-hooks/purity
    const elapsedMinutes = startTime ? (Date.now() - startTime) / 60000 : 0.01;
    const wordCount = value.length / 5;
    const rawWpm = startTime ? Math.round(wordCount / elapsedMinutes) : 0;
    const finalWpm = Math.max(0, Math.min(rawWpm, 200)); // Cap WPM in normal ranges

    // Calculate accuracy: (typed length - errors) / typed length
    // Errors can be estimated by number of backspaces and typed typos
    const totalTyped = value.length + backspaceCount;
    const incorrectCount = errorKeysList.length;
    const rawAccuracy = totalTyped > 0 ? Math.round(((totalTyped - incorrectCount) / totalTyped) * 100) : 100;
    const finalAccuracy = Math.max(0, Math.min(rawAccuracy, 100));

    onStatsUpdate({
      wpm: finalWpm,
      accuracy: finalAccuracy,
      totalKeys: totalTyped,
      errorKeys: Array.from(new Set(errorKeysList)),
    });

    // Advance to next text if completed
    if (value === targetText) {
      setTimeout(() => {
        handleReset();
        setTextIndex((prev) => (prev + 1) % SAMPLE_TEXTS.length);
      }, 600);
    }
  };

  const handleReset = () => {
    setTypedText("");
    setStartTime(null);
    setBackspaceCount(0);
    setErrorKeysList([]);
    telemetryCollector.reset();
    onStatsUpdate({
      wpm: 0,
      accuracy: 100,
      totalKeys: 0,
      errorKeys: [],
    });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Render text helper showing correct, incorrect, and remaining characters
  const renderTargetText = () => {
    return (
      <Box sx={{ fontSize: "1.2rem", letterSpacing: "0.5px", mb: 2, minHeight: "60px", lineHeight: "1.6" }}>
        {targetText.split("").map((char, index) => {
          let color = "#5e6653"; // default remaining text (gray)
          let bgColor = "transparent";
          let textDecoration = "none";

          if (index < typedText.length) {
            const isCorrect = typedText[index] === char;
            color = isCorrect ? "#3b7a57" : "#c74c3c"; // green vs red
            bgColor = isCorrect ? "rgba(59, 122, 87, 0.06)" : "rgba(199, 76, 60, 0.08)";
            if (!isCorrect) textDecoration = "underline wavy #c74c3c";
          }

          const isCursor = index === typedText.length;

          return (
            <span
              key={index}
              style={{
                color,
                backgroundColor: bgColor,
                textDecoration,
                borderLeft: isCursor ? "2px solid #556b2f" : "none",
                paddingLeft: isCursor ? "1px" : "0px",
                animation: isCursor ? "blink 1s infinite" : "none",
              }}
            >
              {char}
            </span>
          );
        })}
        {typedText.length >= targetText.length && (
          <span style={{ borderLeft: "2px solid #556b2f", animation: "blink 1s infinite" }} />
        )}
      </Box>
    );
  };

  return (
    <Box className="sketch-card" sx={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
      {/* Title */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span className="sketch-title" style={{ fontSize: "1.3rem" }}>
            [Interactive_Typing_Sandbox]
          </span>
        </Box>
        <IconButton onClick={handleReset} size="small" title="Reset Sandbox" sx={{ border: "1.5px solid var(--border-color)", borderRadius: "4px" }}>
          <RotateCcw size={16} color="var(--accent-olive-dark)" />
        </IconButton>
      </Box>

      {/* Target Sentence Area */}
      <Box
        sx={{
          p: 2,
          border: "2px dashed var(--border-color-light)",
          borderRadius: "6px",
          backgroundColor: "var(--accent-olive-tint)",
          position: "relative",
        }}
      >
        {renderTargetText()}
        <Typography variant="caption" sx={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 0.5 }}>
          <AlertTriangle size={12} /> Target cadence text. Type above to stream events.
        </Typography>
      </Box>

      {/* Text Area Input */}
      <textarea
        ref={textareaRef}
        className="typing-paper"
        value={typedText}
        onChange={handleInputChange}
        placeholder="Click here to type the text above..."
        spellCheck="false"
      />

      {/* Virtual Keyboard Grid */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8, mt: 1 }}>
        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
          <Box key={rowIndex} sx={{ display: "flex", gap: 0.8, justifyContent: "space-between" }}>
            {row.map((key) => {
              const isActive = activeKeys[key.code];
              const errorRate = HISTORICAL_ERROR_RATES[key.code] || 0;
              const hasErrorHeatmap = errorRate > 0;

              return (
                <Box
                  key={key.code}
                  className={`sketch-key ${isActive ? "active" : ""}`}
                  style={{
                    flex: key.width,
                    // If has error rate, tint the key slightly red-ochre based on percentage
                    backgroundColor: hasErrorHeatmap 
                      ? `rgba(199, 76, 60, ${errorRate * 0.4})` 
                      : "var(--bg-secondary)",
                    borderColor: hasErrorHeatmap ? "var(--border-color)" : "var(--border-color)",
                  }}
                >
                  {/* Label */}
                  <span style={{ position: "relative", zIndex: 2 }}>{key.label}</span>
                  
                  {/* Error Heatmap Sketch Lines Overlay */}
                  {hasErrorHeatmap && (
                    <div 
                      className="key-error-glow" 
                      style={{ 
                        color: "var(--alert-critical)", 
                        opacity: errorRate * 1.5 
                      }} 
                    />
                  )}
                  
                  {/* Small error percentage text */}
                  {hasErrorHeatmap && !isActive && (
                    <Typography 
                      variant="caption" 
                      style={{ 
                        position: "absolute", 
                        bottom: "1px", 
                        right: "3px", 
                        fontSize: "7px", 
                        color: "var(--alert-critical)", 
                        fontWeight: 700,
                        zIndex: 3
                      }}
                    >
                      {Math.round(errorRate * 100)}% err
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
