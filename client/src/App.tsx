import { useState, useRef, useEffect, useCallback } from "react";
import { Chat } from "./components/ChatComponent";
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
  | { action: "error"; error: string }
  | { action: "chat"; message: string; username: string; timestamp: number }
  | { action: "chat_history"; messages: Array<{ action: string; username: string; message: string; timestamp: number }> }

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState([]);

  const wsRef = useRef<WebSocket | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const shouldAutoPlayRef = useRef(false);
  const shouldAutoPlayTimeRef = useRef(0);

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

    // if an user joins while a video is playing, sync to it
    newPlayer.ready(() => {
      if (shouldAutoPlayRef.current) {
        console.log("Auto-play triggered, waiting for video...");

        // wait for the video to load, then sync to the room time
        newPlayer.one("loadedmetadata", () => {
          console.log("Video loaded, applying sync");
          applyRemote({
            action: "play",
            time: shouldAutoPlayTimeRef.current,
          } as WsMessage);
          shouldAutoPlayRef.current = false;
        });
      }
    });

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

            shouldAutoPlayRef.current = msg.playing;
            shouldAutoPlayTimeRef.current = msg.time;
            
            setTimeout(() => {
              if (!ignoreRemoteSyncRef.current) {
                applyRemote(msg as any);
              }
            }, 800);
          }
          return;
        }

        if (msg.action === "chat_history") {
          setChatMessages(msg.messages);
          return;
        }

        if (msg.action === "video") {
          setUrlInput(msg.url);
          setVideoUrl(msg.url);
          return;
        }

        if (msg.action === "chat") {
          setChatMessages((prev) => [...prev, msg]);
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
      window.history.pushState(null, '', `/${newId}`);
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
    window.history.pushState(null, '', `/${id}`);
  };

  const submitVideoUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setVideoUrl(url);
    wsSend({ action: "video", url });
  };


  if (!inRoom) {
    const urlRoomId = window.location.pathname.substring(1);
    if (urlRoomId) {
      setRoomId(urlRoomId);
      setInRoom(true);
      connectWs(urlRoomId);
    }
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <h1 className="mb-3 text-center text-xl font-semibold tracking-tight text-zinc-100">
            sync-yt
            <h3 className="text-xs text-center text-zinc-400">Watch YouTube videos with friends.</h3>
          </h1>
  
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                id="room-id-input"
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
              <button
                id="join-btn"
                onClick={joinRoom}
                className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                Join
              </button>
            </div>
  
            <button
              id="create-btn"
              onClick={createRoom}
              className="w-full rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              Create Room
            </button>
          </div>
  
          {status && (
            <p className="mt-4 text-center text-xs font-medium text-red-400">
              {status}
            </p>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-zinc-950 p-4 lg:p-6 text-zinc-100">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium text-zinc-300">
              Room:{" "}
              <code className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-sm font-semibold text-zinc-100 border border-zinc-800">
                {roomId}
              </code>
            </h2>
            {status && (
              <span className="text-xs text-zinc-500 font-normal">
                {status}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
          <div className="flex flex-col lg:col-span-7">
            <div className="mb-3 flex gap-2">
              <input
                id="video-url-input"
                placeholder="Paste YouTube URL or direct video link..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitVideoUrl()}
                className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
              <button
                id="load-btn"
                onClick={submitVideoUrl}
                className="rounded-md bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                Load
              </button>
            </div>
  
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-zinc-800 bg-black">
              <div
                id="player-container"
                ref={videoContainerRef}
                className="h-full w-full"
              />
            </div>
  
            {videoUrl && (
              <p className="mt-2 text-[11px] text-zinc-500 break-all font-mono">
                {videoUrl}
              </p>
            )}
          </div>

          <div className="flex flex-col lg:col-span-3">
            <Chat
              wsRef={wsRef}
              roomId={roomId}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
