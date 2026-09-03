import { useState, useRef, useEffect, useCallback } from "react";
import videojs from "video.js";
import "videojs-youtube";
import "video.js/dist/video-js.css";

// helpers

function getSourceType(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "video/youtube";
  }
  return "video/mp4";
}

// types

type WsMessage =
  | { action: "sync"; video: string; time: number; playing: boolean }
  | { action: "video"; url: string }
  | { action: "play"; time: number }
  | { action: "pause"; time: number }
  | { action: "seek"; time: number }
  | { action: "error"; error: string };

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [status, setStatus] = useState("");

  const [activeVideo, setActiveVideo] = useState<{
    url: string;
    time: number;
    playing: boolean;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  const suppressRef = useRef(0);

  // WebSocket send
  const wsSend = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // suppress helper
  const withSuppress = useCallback((fn: () => void) => {
    suppressRef.current += 1;
    fn();
    setTimeout(() => {
      suppressRef.current = Math.max(0, suppressRef.current - 1);
    }, 300);
  }, []);

  useEffect(() => {
    if (!inRoom || !videoContainerRef.current || !activeVideo) return;

    videoContainerRef.current.innerHTML = "";

    const el = document.createElement("video-js");
    el.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoContainerRef.current.appendChild(el);

    const { url, time, playing } = activeVideo;

    const player = videojs(el, {
      controls: true,
      autoplay: false,
      responsive: true,
      fluid: true,
      techOrder: ["youtube", "html5"],
      sources: [{ src: url, type: getSourceType(url) }],
      youtube: {
        ytControls: 0, // video.js owns controls so play/pause/seeked events fire
        rel: 0,
      },
    });

    playerRef.current = player;

    player.ready(() => {
      withSuppress(() => {
        player.currentTime(time);
        if (playing) {
          player.play()?.catch(() => null);
        } else {
          player.pause();
        }
      });
    });

    player.on("play", () => {
      if (suppressRef.current > 0) return;
      wsSend({ action: "play", time: player.currentTime() ?? 0 });
    });

    player.on("pause", () => {
      if (suppressRef.current > 0) return;
      if (player.ended()) return;
      wsSend({ action: "pause", time: player.currentTime() ?? 0 });
    });

    player.on("seeked", () => {
      if (suppressRef.current > 0) return;
      wsSend({ action: "seek", time: player.currentTime() ?? 0 });
    });

    return () => {
      if (!player.isDisposed()) player.dispose();
      playerRef.current = null;
    };

  }, [inRoom, activeVideo?.url]);

  const applyRemote = useCallback(
    (msg: WsMessage) => {
      const player = playerRef.current;
      if (!player || player.isDisposed()) return;

      withSuppress(() => {
        if (msg.action === "play") {
          const drift = Math.abs((player.currentTime() ?? 0) - msg.time);
          if (drift > 1) player.currentTime(msg.time);
          player.play()?.catch(() => null);
          return;
        }
        if (msg.action === "pause") {
          player.currentTime(msg.time);
          player.pause();
          return;
        }
        if (msg.action === "seek") {
          player.currentTime(msg.time);
          return;
        }
      });
    },
    [withSuppress]
  );

  const connectWs = useCallback(
    (id: string) => {
      const ws = new WebSocket(`ws://localhost:3000/ws/${id}`);

      ws.onopen = () => {
        setStatus("Connected");
        console.log("[ws] connected to room", id);
      };

      ws.onmessage = (e) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(e.data as string);
        } catch {
          return;
        }

        if (msg.action === "error") {
          setStatus(`Error: ${msg.error}`);
          return;
        }

        if (msg.action === "sync") {
          if (msg.video) {
            setUrlInput(msg.video);
            setActiveVideo({ url: msg.video, time: msg.time, playing: msg.playing });
          }
          return;
        }

        if (msg.action === "video") {
          setUrlInput(msg.url);
          setActiveVideo({ url: msg.url, time: 0, playing: false });
          return;
        }

        applyRemote(msg);
      };

      ws.onerror = () => setStatus("WebSocket error");
      ws.onclose = () => setStatus("Disconnected");
      wsRef.current = ws;
    },
    [applyRemote]
  );

  const createRoom = async () => {
    try {
      setStatus("Creating room...");
      const res = await fetch("http://localhost:3000/create", { method: "POST" });
      const { roomId: newId } = await res.json();
      setRoomId(newId);
      setInRoom(true);
      connectWs(newId);
    } catch (err) {
      console.error(err);
      setStatus("Failed to create room");
    }
  };

  const joinRoom = () => {
    const id = roomId.trim();
    if (!id) return;
    setInRoom(true);
    connectWs(id);
  };

  const submitVideoUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    wsSend({ action: "video", url });
    setActiveVideo({ url, time: 0, playing: false });
  };

  if (!inRoom) {
    return (
      <div style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>SyncTube</h1>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            id="room-id-input"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            style={{ flex: 1, padding: "0.5rem 0.75rem", fontSize: "1rem" }}
          />
          <button id="join-btn" onClick={joinRoom} style={{ padding: "0.5rem 1rem" }}>
            Join
          </button>
        </div>

        <button id="create-btn" onClick={createRoom} style={{ padding: "0.5rem 1rem" }}>
          Create Room
        </button>

        {status && <p style={{ marginTop: "1rem", color: "red" }}>{status}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginBottom: "0.75rem" }}>
        Room: <code>{roomId}</code>
        {status && (
          <span style={{ marginLeft: "1rem", fontSize: "0.85rem", opacity: 0.6 }}>
            {status}
          </span>
        )}
      </h2>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          id="video-url-input"
          placeholder="Paste a YouTube URL or direct video link..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitVideoUrl()}
          style={{ flex: 1, padding: "0.5rem 0.75rem", fontSize: "1rem" }}
        />
        <button id="load-btn" onClick={submitVideoUrl} style={{ padding: "0.5rem 1rem" }}>
          Load
        </button>
      </div>

      <div
        id="player-container"
        ref={videoContainerRef}
        style={{ width: "1000px", height: "500px", background: "#000" }}
      />

      {activeVideo && (
        <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", opacity: 0.5, wordBreak: "break-all" }}>
          {activeVideo.url}
        </p>
      )}
    </div>
  );
}
