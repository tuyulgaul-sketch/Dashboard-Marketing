import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { installMeetingRoomAutoDuration } from "@/lib/meetingRoomAutoDuration";

// Deployment marker: 2026-09-14 production retry after Vercel rate limit.
installMeetingRoomAutoDuration();

createRoot(document.getElementById("root")!).render(<App />);


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => {
        console.error(
          "[PWA] Service worker gagal didaftarkan:",
          error
        );
      });
  });
}
