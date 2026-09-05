import { useState, useEffect, useRef } from "react";

export function Chat({ wsRef, roomId, chatMessages, setChatMessages }) {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState("");
  const [tempUsername, setTempUsername] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  

  useEffect(() => {
    const saved = localStorage.getItem("syncyt_username");
    if (saved) {
      setUsername(saved);
    } else {
      setShowNameInput(true);
    }
  }, []);

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
      setShowNameInput(false);
    }
  };
  if (showNameInput && !username) {
    return (
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#1a1a1a",
          borderRadius: "4px",
        }}
      >
        <input
          placeholder="Enter your name..."
          defaultValue={username}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSetUsername(e.currentTarget.value);
            }
          }}
          style={{ padding: "0.5rem", width: "100%", marginBottom: "0.5rem" }}
        />
        <button
          onClick={(e) =>
            handleSetUsername((e.currentTarget.previousElementSibling as HTMLInputElement).value)
          }
          style={{ padding: "0.5rem 1rem", width: "100%" }}
        >
          Set Name
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "1rem",
        display: "flex",
        flexDirection: "column",
        height: "300px",
        background: "#1a1a1a",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
        >
          {showSettings ? "Close" : "Settings"}
        </button>
      
        {showSettings && (
          <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#222", borderRadius: "4px" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
              Username
            </label>
            <input
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSetUsername(tempUsername);
                  setShowSettings(false);
                }
              }}
              style={{ padding: "0.5rem", width: "100%", marginBottom: "0.5rem" }}
            />
            <button
              onClick={() => {
                handleSetUsername(tempUsername);
                setShowSettings(false);
              }}
              style={{ padding: "0.5rem 1rem", width: "100%" }}
            >
              Save
            </button>
          </div>
        )}
      </div>
      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          fontSize: "0.9rem",
        }}
      >
        {chatMessages.length === 0 ? (
          <p style={{ opacity: 0.5 }}>No messages yet</p>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} style={{ marginBottom: "0.5rem" }}>
              <span style={{ color: "#888", fontWeight: "bold" }}>
                {msg.username}:
              </span>{" "}
              <span>{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid #333" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            style={{ flex: 1, padding: "0.5rem", fontSize: "0.9rem" }}
          />
          <button onClick={sendMessage} style={{ padding: "0.5rem 1rem" }}>
            Send
          </button>
        </div>
        <p style={{ fontSize: "0.75rem", opacity: 0.5 }}>
          Logged in as: <strong>{username}</strong>
        </p>
      </div>
    </div>
  );
}
