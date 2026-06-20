"use client";

import * as React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#556b2f", // Olive Green
      dark: "#3a422d",
      light: "#7c9063",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#8f9e77", // Muted Sage
      contrastText: "#252a1d",
    },
    background: {
      default: "#fcfbfa", // Creamy paper off-white
      paper: "#ffffff",
    },
    text: {
      primary: "#252a1d",
      secondary: "#5e6653",
    },
  },
  typography: {
    fontFamily: "var(--font-sans)",
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: "6px",
          fontWeight: 600,
          border: "2px solid #3a422d",
          boxShadow: "2px 2px 0px #3a422d",
          color: "#3a422d",
          transition: "all 0.2s ease",
          "&:hover": {
            border: "2px solid #3a422d",
            backgroundColor: "#f2f4ec",
            boxShadow: "4px 4px 0px #3a422d",
            transform: "translate(-1px, -2px)",
          },
          "&:active": {
            transform: "translate(1px, 1px)",
            boxShadow: "1px 1px 0px #3a422d",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "2px solid #3a422d",
          borderRadius: "9px",
          boxShadow: "4px 4px 0px #3a422d",
        },
      },
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
