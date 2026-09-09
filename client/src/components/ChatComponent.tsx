import { useState, useEffect, useRef } from "react";

export function Chat({ wsRef, roomId, chatMessages, setChatMessages }: any) {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [tempUsername, setTempUsername] = useState("");
  const [tempPfpUrl, setTempPfpUrl] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // placeholder default profile picture
  const defaultPfp = "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Default_pfp.svg/1280px-Default_pfp.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail";
  

  useEffect(() => {
    const saved = localStorage.getItem("syncyt_username");
    if (saved) {
      setUsername(saved);
    } else {
      setUsername(genRandomUser())
    }
  }, []);

  useEffect(() => {
    const pfp = localStorage.getItem("syncyt_pfp");
    if (pfp) {
      setProfilePictureUrl(pfp);
    } else {
      setProfilePictureUrl(defaultPfp);
    }
  })

  const genRandomUser = () => {
    const adjectives = ['Swift', 'Clever', 'Cosmic', 'Hyper', 'Mystic', 'Silent', 'Golden', 'Radiant', 'Magical'];
    const nouns = ['Fox', 'Ninja', 'Panda', 'Coder', 'Voyager', 'Falcon', 'Orbit', 'Phoenix', 'Katya', 'Anche'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 90) + 10;
    
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !username) return;
  
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }
  
    wsRef.current.send(
      JSON.stringify({
        action: "chat",
        message: text,
        username: username,
        timestamp: Date.now(),
        pfp: profilePictureUrl,
      }),
    );
    setInput("");
  };
  
  const handleSetUsername = (name) => {
    const trimmed = name.trim();
    if (trimmed) {
      setUsername(trimmed);
      localStorage.setItem("syncyt_username", trimmed);
    }
  };
  
  const handleSetPfp = (pfpUrl) => {
    const trimmed = pfpUrl.trim();
    if (trimmed) {
      setProfilePictureUrl(trimmed);
      localStorage.setItem("syncyt_pfp", trimmed);
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
          <div className="mt-2.5 rounded-md border border-zinc-800 bg-zinc-950 p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Username
              </label>
              <input
                type="text"
                value={tempUsername || username}
                onChange={(e) => setTempUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSetUsername(tempUsername);
                    setShowSettings(false);
                  }
                }}
                className="w-full rounded bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Profile Picture URL
              </label>
              <input
                type="text"
                placeholder="https://example.com/image.png"
                defaultValue={profilePictureUrl === defaultPfp ? "" : profilePictureUrl}
                onChange={(e) => setTempPfpUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSetPfp((e.target as HTMLInputElement).value);
                  }
                }}
                className="w-full rounded bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors mb-2"
              />
              <div className="flex items-center gap-2 p-2 bg-zinc-900 rounded border border-zinc-800">
                <img
                  src={tempPfpUrl || profilePictureUrl}
                  onError={(e) => ((e.target as HTMLInputElement).src = defaultPfp)}
                  alt="pfp preview"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-xs text-zinc-500">Preview</span>
              </div>
            </div>

            <button
              onClick={() => {
                handleSetUsername(tempUsername);
                handleSetPfp(tempPfpUrl);
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
            <div key={i} className="flex gap-2 leading-snug break-words">
              <img
                src={msg.pfp || defaultPfp}
                onError={(e) => ((e.target as HTMLInputElement).src = defaultPfp)}
                alt={msg.username}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-zinc-400">
                  {msg.username}
                </span>
                <p className="text-zinc-200">{msg.message}</p>
              </div>
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
