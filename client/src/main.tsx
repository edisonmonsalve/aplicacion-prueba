import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "./index.css";
import { ThemeProvider } from "@/context/ThemeContext";
import "@fontsource-variable/plus-jakarta-sans";
import dayjs from "dayjs";
import "dayjs/locale/es";
import ErrorBoundary from "@/components/ErrorBoundary";

dayjs.locale("es");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);
