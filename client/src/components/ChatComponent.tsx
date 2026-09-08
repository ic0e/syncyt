import { useState, useEffect, useRef } from "react";

export function Chat({ wsRef, roomId, chatMessages, setChatMessages }) {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [tempUsername, setTempUsername] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  

  useEffect(() => {
    const saved = localStorage.getItem("syncyt_username");
    if (saved) {
      setUsername(saved);
    } else {
      setUsername(genRandomUser())
    }
  }, []);

  const genRandomUser = () => {
    const adjectives = ['Swift', 'Clever', 'Cosmic', 'Hyper', 'Mystic', 'Silent', 'Golden', 'Radiant', 'Magical'];
    const nouns = ['Fox', 'Ninja', 'Panda', 'Coder', 'Voyager', 'Falcon', 'Orbit', 'Phoenix', 'Katya', 'Anche'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 90) + 10;
    
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, setUsername, []]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !username) return;

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          action: "chat",
          message: text,
          username: username,
          timestamp: Date.now(),
        }),
      );
      setInput("");
    }
  };
  const handleSetUsername = (name) => {
    const trimmed = name.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem("syncyt_username", trimmed);
    }
  };
  if (!username) {
    setUsername(genRandomUser());
  }

  return (
    <div className="mt-4 flex w-full flex-col overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-normal h-[600px]">
      {/* SETTINGS HEADER */}
      <div className="border-b border-zinc-800 p-3 bg-zinc-900/50">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="inline-flex items-center rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-600"
        >
          {showSettings ? "Close Settings" : "Settings"}
        </button>
    
        {showSettings && (
          <div className="mt-2.5 rounded-md border border-zinc-800 bg-zinc-950 p-3 space-y-2">
            <label className="block text-xs font-medium text-zinc-400">
              Username
            </label>
            <input
              type="text"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSetUsername(tempUsername);
                  setShowSettings(false);
                }
              }}
              className="w-full rounded bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
            />
            <button
              onClick={() => {
                handleSetUsername(tempUsername);
                setShowSettings(false);
              }}
              className="w-full rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              Save
            </button>
          </div>
        )}
      </div>
      {/* CHAT MESSAGES */}
      <div className="overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800 flex-1">
        {chatMessages.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No messages yet</p>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="leading-snug break-words">
              <span className="font-semibold text-zinc-400 mr-1.5">
                {msg.username}:
              </span>
              <span className="text-zinc-200">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* TEXT BOX */}
      <div className="border-t border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex gap-2 mb-2">
          <input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
          />
          <button
            onClick={sendMessage}
            className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-600"
          >
            Send
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          Logged in as: <strong className="text-zinc-400 font-medium">{username}</strong>
        </p>
      </div>
    </div>
  );
}
