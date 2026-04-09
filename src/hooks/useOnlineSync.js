import { useCallback, useEffect, useRef, useState } from "react";
import { WS_BASE_URL } from "../config/api";

export function useOnlineSync(onMessage) {
  const [wsStatus, setWsStatus] = useState("connecting");
  const wsRef = useRef(null);
  const onMsgRef = useRef(onMessage);
  // Queue for messages sent before the socket is open
  const queueRef = useRef([]);

  // Keep ref current so async callbacks always call the latest handler
  useEffect(() => {
    onMsgRef.current = onMessage;
  });

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Guard: if this socket was replaced by Strict Mode remount, ignore it
      if (wsRef.current !== ws) {
        ws.close();
        return;
      }
      setWsStatus("connected");
      const queued = queueRef.current.splice(0);
      console.log("[WS open] flushing", queued.length, "queued messages");
      for (const msg of queued) {
        console.log("[WS→ flush]", msg.type, msg);
        ws.send(JSON.stringify(msg));
      }
    };
    ws.onclose = () => {
      // Guard: don't clobber wsRef if a newer socket already replaced this one
      if (wsRef.current === ws) {
        setWsStatus("disconnected");
        wsRef.current = null;
      }
    };
    ws.onerror = () => {
      if (wsRef.current === ws) setWsStatus("error");
    };
    ws.onmessage = (e) => {
      if (wsRef.current !== ws) return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== "connected") onMsgRef.current?.(msg);
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      // Detach the ref before closing so the onclose guard skips state updates
      wsRef.current = null;
      ws.close();
    };
  }, []); // single connection for the lifetime of the component

  const send = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      console.log("[WS→]", obj.type, obj);
      ws.send(JSON.stringify(obj));
    } else {
      console.log("[WS queue]", obj.type, "readyState:", ws?.readyState);
      // Socket not ready yet — queue the message
      queueRef.current.push(obj);
    }
  }, []);

  return { wsStatus, send };
}
