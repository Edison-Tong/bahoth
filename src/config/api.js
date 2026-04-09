const IS_LOCAL_DEV =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export const API_BASE_URL = IS_LOCAL_DEV ? "http://localhost:10000" : "https://bahoth-server.onrender.com";

export const WS_BASE_URL = API_BASE_URL.replace(/^http/i, "ws");
