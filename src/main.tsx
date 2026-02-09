import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ShopPage from "./ShopPage";
import "../css/style.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

const isShop = window.location.pathname === "/shop" || window.location.pathname === "/shop/";

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {isShop ? <ShopPage /> : <App />}
  </React.StrictMode>,
);
