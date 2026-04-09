import { useCallback, useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../config/api";

export function useOnlineSync(onMessage) {
  const [wsStatus, setWsStatus] = useState("connecting");
  const wsRef = useRef(null);
  const onMsgRef = useRef(onMessage);
  // Keep ref current so async callbacks always call the latest handler
  useEffect(() => {
    onMsgRef.current = onMessage;
  });

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => {
      setWsStatus("disconnected");
      wsRef.current = null;
    };
    ws.onerror = () => setWsStatus("error");
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        // Ignore the initial handshake confirmation
        if (msg.type !== "connected") onMsgRef.current?.(msg);
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, []); // single connection for the lifetime of the component

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }, []);

  return { wsStatus, send };
}
