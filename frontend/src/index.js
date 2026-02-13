import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

(function configureApiBase() {
  if (typeof window === "undefined") return;

  const h = window.location.hostname;
  const isLocal =
    h === "localhost" ||
    h === "127.0.0.1";

  const PROD_API = "https://api.jpart.at/api";

  window.__API_FAST__ = isLocal ? "http://localhost:8001/api" : PROD_API;
  window.__FORCE_DEV_REMOTE__ = !!isLocal;
  window.__AI_CAPTION_ENDPOINT__ = window.__API_FAST__ + "/ai/caption";

  console.log("[API_BASE]", window.__API_FAST__);
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
