import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import BookingPage from "./BookingPage.jsx";
import "./index.css";

const isBookingPage = new URLSearchParams(window.location.search).has("book");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isBookingPage ? <BookingPage /> : <App />}
  </React.StrictMode>
);
