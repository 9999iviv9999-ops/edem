import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerPwaWorker } from "./lib/pwa";
import "./styles.css";

registerPwaWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
