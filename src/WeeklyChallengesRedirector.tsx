import { useEffect } from "react";

const API_BASE = (() => {
  const env = import.meta.env.VITE_API_BASE;
  if (env) return env;
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.port === "5713") url.port = "4000";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  }
  return "";
})();

export default function WeeklyChallengesRedirector() {
  useEffect(() => {
    // Call backend to setup the DB table for weekly challenges
    fetch(`${API_BASE}/api/admin/setup-weekly-challenges`, {
      method: "POST",
      credentials: "include"
    }).finally(() => {
      window.location.href = "/weekly-challenges";
    });
  }, []);
  return (
    <main>
      <div style={{ padding: 40, textAlign: "center" }}>Setting up Weekly Challenges…</div>
    </main>
  );
}
