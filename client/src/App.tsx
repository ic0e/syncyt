import { useState, useRef } from 'react';
import ReactPlayer from 'react-player';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  
  const [playing, setPlaying] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<any>(null);

  const isPlayingRef = useRef(false);
  const lastRemoteSeek = useRef<number | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const isUserSeeking = useRef(false);
  const currentTimeRef = useRef(0);

  const createRoom = async () => {
    try {
      const res = await fetch('http://localhost:3000/create', { method: 'POST' });
      const { roomId: newRoomId } = await res.json();
      joinRoom(newRoomId);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const joinRoom = (id: string) => {
    if (!id.trim()) return;
    setRoomId(id);
    setInRoom(true);

    const ws = new WebSocket(`ws://localhost:3000/ws/${id}`);

    ws.onopen = () => console.log('Connected to room:', id);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const canSeek = playerRef.current && typeof playerRef.current.seekTo === 'function';

        if (msg.action === 'sync') {
          if (msg.video) setVideoUrl(msg.video);
          if (msg.playing !== undefined) {
            isPlayingRef.current = msg.playing;
            setPlaying(msg.playing);
          }
          if (msg.time !== undefined) {
            if (canSeek) {
              lastRemoteSeek.current = msg.time;
              playerRef.current.seekTo(msg.time, 'seconds');
            } else {
              pendingSeek.current = msg.time;
            }
          }
        }

        if (msg.action === 'video') {
          setVideoUrl(msg.url);
          isPlayingRef.current = false;
          setPlaying(false);
        }

        if (msg.action === 'play') {
          isPlayingRef.current = true;
          setPlaying(true);
          
          if (msg.time !== undefined && canSeek) {
            const currentTime = playerRef.current.getCurrentTime?.() || 0;
            if (Math.abs(currentTime - msg.time) > 1) {
              lastRemoteSeek.current = msg.time;
              playerRef.current.seekTo(msg.time, 'seconds');
            }
          }
        }

        if (msg.action === 'pause') {
          isPlayingRef.current = false;
          setPlaying(false);
          
          if (msg.time !== undefined && canSeek) {
            lastRemoteSeek.current = msg.time;
            playerRef.current.seekTo(msg.time, 'seconds');
          }
        }

        if (msg.action === 'seek') {
          console.log('Remote seek to:', msg.time);
          if (msg.time !== undefined && canSeek) {
            lastRemoteSeek.current = msg.time;
            playerRef.current.seekTo(msg.time, 'seconds');
          }
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };

    ws.onerror = (e) => console.error('WebSocket error:', e);
    ws.onclose = () => console.log('Disconnected from room');

    wsRef.current = ws;
  };

  const handleVideoChange = (url: string) => {
    setVideoUrl(url);
    wsRef.current?.send(JSON.stringify({ action: 'video', url }));
  };

  const handlePlay = () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setPlaying(true);
    const time = playerRef.current?.getCurrentTime?.() || 0;
    wsRef.current?.send(JSON.stringify({ action: 'play', time }));
  };

  const handlePause = () => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setPlaying(false);
    const time = playerRef.current?.getCurrentTime?.() || 0;
    wsRef.current?.send(JSON.stringify({ action: 'pause', time }));
  };

  const handleSeeking = () => {
    console.log('User started seeking');
    isUserSeeking.current = true;
  };

  const handleProgress = (state: any) => {
    currentTimeRef.current = state.played * state.duration || 0;
  };
  
  const handleSeeked = () => {
    console.log('User finished seeking to:', currentTimeRef.current);
    wsRef.current?.send(JSON.stringify({ action: 'seek', time: currentTimeRef.current }));
  };

  const handleReady = () => {
    if (pendingSeek.current !== null && playerRef.current?.seekTo) {
      lastRemoteSeek.current = pendingSeek.current;
      playerRef.current.seekTo(pendingSeek.current, 'seconds');
      pendingSeek.current = null;
    }
  };


  if (!inRoom) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Syncyt</h1>
        <div>
          <input
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={() => joinRoom(roomId)}>Join</button>
        </div>
        <button onClick={createRoom}>Create Room</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Room: {roomId}</h1>
      <input
        placeholder="Video URL"
        value={videoUrl}
        onChange={(e) => handleVideoChange(e.target.value)}
        style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
      />
      <ReactPlayer
        ref={playerRef}
        src={videoUrl}
        playing={playing}
        controls
        width="100%"
        height="500px"
        onReady={handleReady}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onProgress={handleProgress}
      />
    </div>
  );
}
