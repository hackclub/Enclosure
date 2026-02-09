<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Enclosure — Hack Club YSWS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/png" href="/assets/favicon-4foirhda.png">
  <script>
    function loadApp() {
      const script = document.createElement("script");
      script.type = "module";
      script.src = "/src/main.tsx";
      document.body.appendChild(script);
    }

    window.addEventListener("DOMContentLoaded", loadApp);
  </script>
</head>
<body>
  <div id="root"></div>
  <script>
    document.getElementById("auth-btn").addEventListener("click", function() {
      const API_BASE = (() => {
        const url = new URL(window.location.href);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
          return "http://localhost:4000";
        }
        return url.origin;
      })();
      const continueUrl = encodeURIComponent(window.location.href);
      window.location.href = `${API_BASE}/api/auth/login?continue=${continueUrl}`;
    });
  </script>
</body>
</html>
