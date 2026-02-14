import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ShopPage from "./ShopPage";
import OrdersPage from "./OrdersPage";
import "../css/style.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

const path = window.location.pathname;
const isShop = path === "/shop" || path === "/shop/";
const isOrders = path === "/orders" || path === "/orders/";

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {isShop ? <ShopPage /> : isOrders ? <OrdersPage /> : <App />}
  </React.StrictMode>,
);
