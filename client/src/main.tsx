import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "./index.css";
import { ThemeProvider } from "@/context/ThemeContext";
import "@fontsource-variable/plus-jakarta-sans";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
