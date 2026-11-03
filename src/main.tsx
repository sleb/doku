import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { boot, devLevelOverride } from "./app/boot";
import { launch } from "./app/launch";
import "./app/index.css";
import { storage } from "./platform/storage";

launch(
  () =>
    boot(storage, {
      devLevel: devLevelOverride(window.location.search, import.meta.env.DEV),
    }),
  () => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  },
);
