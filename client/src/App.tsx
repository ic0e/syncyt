import { useState, useRef, useEffect, useCallback } from "react";
import { Chat } from "./components/ChatComponent";
import { Playlist } from "./components/Playlist";
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
  | { action: "chat"; message: string; username: string; timestamp: number; pfp: string; }
  | { action: "chat_history"; messages: Array<{ action: string; username: string; message: string; timestamp: number; pfp: string; }> }
  | { action: "playlist"; urls: string[]; index: number }
  | { action: "playlist_history"; urls: string[]; index: number }

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);
  const [status, setStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const shouldAutoPlayRef = useRef(false);
  const shouldAutoPlayTimeRef = useRef(0);
  const isInitializingRef = useRef(false);

  const ignoreRemoteSyncRef = useRef(false);

  const playlistRef = useRef(playlist);
  const playlistIndexRef = useRef(playlistIndex);

  useEffect(() => {
    playlistRef.current = playlist;
    playlistIndexRef.current = playlistIndex;
  }, [playlist, playlistIndex]);

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
    const urlRoomId = window.location.pathname.substring(1).trim();
    if (urlRoomId && !inRoom) {
      setRoomId(urlRoomId);
      setInRoom(true);
    }
  }, []);

  useEffect(() => {
    if (inRoom && roomId) {
      connectWs(roomId);
    }
  }, [inRoom, roomId]);

  useEffect(() => {
    if (!inRoom || !videoContainerRef.current || !videoUrl) return;

    const player = playerRef.current;

    if (player && !player.isDisposed()) {
      isInitializingRef.current = true;
      player.src({ src: videoUrl, type: getSourceType(videoUrl) });
      player.pause();
      player.currentTime(0);
      setTimeout(() => {
        isInitializingRef.current = false;
      }, 500);
      return;
    }

    isInitializingRef.current = true;

    videoContainerRef.current.innerHTML = "";
    const el = document.createElement("video-js");
    el.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoContainerRef.current.appendChild(el);

    const newPlayer = videojs(el, {
      controls: true,
      autoplay: true,
      responsive: true,
      fluid: true,
      techOrder: ["youtube", "html5"],
      sources: [{ src: videoUrl, type: getSourceType(videoUrl) }],
      youtube: {
        ytControls: 1,
        rel: 0,
      },
    });

    el.classList.add('vjs-controls-disabled');

    playerRef.current = newPlayer;

    shouldAutoPlayRef.current = true;

    newPlayer.ready(() => {
      newPlayer.muted(true);
      newPlayer.play()?.catch(() => null);

      newPlayer.one("playing", () => {
        console.log("Video loading, seeking to", shouldAutoPlayTimeRef.current);
        if (shouldAutoPlayRef.current) {
          newPlayer.currentTime(shouldAutoPlayTimeRef.current);
          shouldAutoPlayRef.current = false;
          shouldAutoPlayTimeRef.current = 0;
        }
        newPlayer.muted(false);
        setTimeout(() => {
          isInitializingRef.current = false;
        }, 500);
      });
    });

    newPlayer.on("play", () => {
      if (isInitializingRef.current) return;
      if (newPlayer.readyState() > 0) {
          wsSend({ action: "play", time: newPlayer.currentTime() ?? 0 });
        }
    });

    newPlayer.on("pause", () => {
      if (isInitializingRef.current) return;
      if (!newPlayer.ended() && newPlayer.readyState() > 0) {
          wsSend({ action: "pause", time: newPlayer.currentTime() ?? 0 });
        }
    });

    newPlayer.on("seeked", () => {
      if (isInitializingRef.current) return;
      if (newPlayer.readyState() > 0) {
          wsSend({ action: "seek", time: newPlayer.currentTime() ?? 0 });
        }
    });

    newPlayer.on("ended", () => {
      const currentPlaylist = playlistRef.current;
      const currentIndex = playlistIndexRef.current;
      if (currentIndex < currentPlaylist.length - 1) {
        const nextIndex = currentIndex + 1;
        setPlaylistIndex(nextIndex);
        setVideoUrl(currentPlaylist[nextIndex]);
        wsSend({ action: "playlist", urls: currentPlaylist, index: nextIndex });
      }
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
      const ws = new WebSocket(`wss://sync-yt-backend.onrender.com/ws/${id}`);

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
            ignoreRemoteSyncRef.current = true;
            setVideoUrl(msg.video);

            shouldAutoPlayRef.current = msg.playing;
            shouldAutoPlayTimeRef.current = msg.time;

            setTimeout(() => {
              if (!ignoreRemoteSyncRef.current) {
                applyRemote(msg as any);
              }
            }, 300);
          }
          return;
        }

        if (msg.action === "chat_history") {
          setChatMessages(msg.messages);
          return;
        }

        if (msg.action === "playlist_history") {
          setPlaylist(msg.urls);
          setPlaylistIndex(msg.index);
          if (msg.urls.length > 0) {
            setVideoUrl(msg.urls[msg.index]);
          }
          return;
        }

        if (msg.action === "playlist") {
          setPlaylist(msg.urls);
          setPlaylistIndex(msg.index);
          setVideoUrl(msg.urls[msg.index]);
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
      const res = await fetch("https://sync-yt-backend.onrender.com/create", { method: "POST" });
      const { roomId: newId } = await res.json();
      setRoomId(newId);
      setInRoom(true);
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
    window.history.pushState(null, '', `/${id}`);
  };

  const addToPlaylist = (url: string) => {
    const newPlaylist = [...playlist, url];
    const newIndex = playlist.length === 0 ? 0 : playlistIndex;
    setPlaylist(newPlaylist);
    setPlaylistIndex(newIndex);
    if (playlist.length === 0) {
      setVideoUrl(url);
    }
    wsSend({ action: "playlist", urls: newPlaylist, index: newIndex });
  };

  const removeFromPlaylist = (index: number) => {
    let newPlaylist = playlist.filter((_, i) => i !== index);
    let newIndex = playlistIndex;

    if (index < playlistIndex) {
      newIndex = playlistIndex - 1;
    } else if (index === playlistIndex) {
      if (newPlaylist.length > 0) {
        newIndex = Math.min(playlistIndex, newPlaylist.length - 1);
        setVideoUrl(newPlaylist[newIndex]);
      } else {
        newPlaylist = [];
        newIndex = 0;
        setVideoUrl(null);
      }
    }

    setPlaylist(newPlaylist);
    setPlaylistIndex(newIndex);
    wsSend({ action: "playlist", urls: newPlaylist, index: newIndex });
  };

  const playFromPlaylist = (index: number) => {
    setPlaylistIndex(index);
    setVideoUrl(playlist[index]);
    wsSend({ action: "playlist", urls: playlist, index });
  };

  if (!inRoom) {
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
              <Playlist
                playlist={playlist}
                playlistIndex={playlistIndex}
                onAddToPlaylist={addToPlaylist}
                onRemoveFromPlaylist={removeFromPlaylist}
                //@ts-ignore
                onPlayFromPlaylist={playFromPlaylist}
                showPlaylist={showPlaylist}
                setShowPlaylist={setShowPlaylist}
              />
              <button
                id="playlist-btn"
                onClick={() => setShowPlaylist(!showPlaylist)}
                className="rounded-md bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                Queue ({playlist.length})
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
