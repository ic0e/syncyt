import { useState, useRef, useEffect, useCallback } from "react";
import videojs from "video.js";
import "videojs-youtube";
import "video.js/dist/video-js.css";

function getSourceType(url: string) {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return "video/youtube";
  }
  return "video/mp4";
}

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  const ignoreRemoteSyncRef = useRef(false);

  const wsSend = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      ignoreRemoteSyncRef.current = true;
      setTimeout(() => {
        ignoreRemoteSyncRef.current = false;
      }, 500);
    }
  }, []);

  useEffect(() => {
    if (!inRoom || !videoContainerRef.current || !videoUrl) return;

    const player = playerRef.current;

    if (player && !player.isDisposed()) {
      player.src({ src: videoUrl, type: getSourceType(videoUrl) });
      player.pause();
      player.currentTime(0);
      return;
    }

    videoContainerRef.current.innerHTML = "";
    const el = document.createElement("video-js");
    el.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoContainerRef.current.appendChild(el);

    const newPlayer = videojs(el, {
      controls: true,
      autoplay: false,
      responsive: true,
      fluid: true,
      techOrder: ["youtube", "html5"],
      sources: [{ src: videoUrl, type: getSourceType(videoUrl) }],
      youtube: {
        ytControls: 0,
        rel: 0,
      },
    });

    playerRef.current = newPlayer;

    newPlayer.on("play", () => {
      wsSend({ action: "play", time: newPlayer.currentTime() ?? 0 });
    });

    newPlayer.on("pause", () => {
      if (newPlayer.ended()) return;
      wsSend({ action: "pause", time: newPlayer.currentTime() ?? 0 });
    });

    newPlayer.on("seeked", () => {
      wsSend({ action: "seek", time: newPlayer.currentTime() ?? 0 });
    });

    return () => {
      if (!newPlayer.isDisposed()) newPlayer.dispose();
      playerRef.current = null;
    };
  }, [inRoom, videoUrl, wsSend]);

  const applyRemote = useCallback((msg: WsMessage) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;

    const currentTime = player.currentTime() ?? 0;
    const isPlaying = !player.paused();

    if (msg.action === "play") {
      if (Math.abs(currentTime - msg.time) > 2) {
        player.currentTime(msg.time);
      }
      if (!isPlaying) {
        player.play()?.catch(() => null);
      }
      return;
    }

    if (msg.action === "pause") {
      if (Math.abs(currentTime - msg.time) > 1) {
        player.currentTime(msg.time);
      }
      if (isPlaying) {
        player.pause();
      }
      return;
    }

    if (msg.action === "seek") {
      if (Math.abs(currentTime - msg.time) > 1.5) {
        player.currentTime(msg.time);
      }
      return;
    }
  }, []);

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
            setVideoUrl(msg.video);
            setTimeout(() => {
              if (!ignoreRemoteSyncRef.current) {
                applyRemote(msg as any);
              }
            }, 800);
          }
          return;
        }

        if (msg.action === "video") {
          setUrlInput(msg.url);
          setVideoUrl(msg.url);
          return;
        }

        if (ignoreRemoteSyncRef.current) return;

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
    setVideoUrl(url);
    wsSend({ action: "video", url });
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

      {videoUrl && (
        <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", opacity: 0.5, wordBreak: "break-all" }}>
          {videoUrl}
        </p>
      )}
    </div>
  );
}
