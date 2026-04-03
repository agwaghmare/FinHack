import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ClerkAuthRoot } from "./components/ClerkAuth";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkAuthRoot>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ClerkAuthRoot>
  </React.StrictMode>,
);
