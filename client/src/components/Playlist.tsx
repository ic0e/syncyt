import { useState, useEffect, useRef } from "react";

interface PlaylistProps {
  playlist: string[];
  playlistIndex: number;
  onAddToPlaylist: (url: string) => void;
  onRemoveFromPlaylist: (index: number) => void;
  onPlayFromPlaylist: (index: number) => void;
  showPlaylist: boolean;
  setShowPlaylist: (show: boolean) => void;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function Playlist({
  playlist,
  playlistIndex,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onPlayFromPlaylist,
  showPlaylist,
  setShowPlaylist,
}: PlaylistProps) {
  const [urlInput, setUrlInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const inputContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreviewUrl(urlInput.trim());
  }, [urlInput]);

  useEffect(() => {
    if (showPlaylist && inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [showPlaylist]);

  const handleAddVideo = () => {
    const url = urlInput.trim();
    if (!url) return;
    onAddToPlaylist(url);
    setUrlInput("");
    setPreviewUrl("");
  };

  const handlePlaySelection = (index: number) => {
    if (playlistIndex !== index) {
      // Remove current playing video
      onRemoveFromPlaylist(playlistIndex);
    }
    onPlayFromPlaylist(index);
  };

  const previewVideoId = extractVideoId(previewUrl);
  const previewThumbnail = previewVideoId
    ? `https://img.youtube.com/vi/${previewVideoId}/default.jpg`
    : null;

  return (
    <div className="relative flex-1">
      <div className="flex items-center gap-2" ref={inputContainerRef}>
        <div className="flex-1 flex items-center bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600 transition-all h-10">
          {previewThumbnail ? (
            <div className="pl-1.5 flex items-center justify-center">
              <img
                src={previewThumbnail}
                alt="preview"
                className="w-9 h-7 object-cover rounded-[4px] border border-zinc-700/50"
              />
            </div>
          ) : (
            <div className="pl-3 pr-1 text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </div>
          )}
          
          <input
            id="video-url-input"
            placeholder="Paste YouTube URL or video ID..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddVideo()}
            className="flex-1 bg-transparent px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          
          {previewUrl && (
            <button
              onClick={handleAddVideo}
              className="px-4 h-full flex items-center justify-center text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-colors border-l border-zinc-800"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {showPlaylist && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPlaylist(false)}
        />
      )}

      <div
        className={`fixed w-80 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-lg shadow-2xl z-50 transform transition-all duration-200 origin-top-left overflow-hidden flex flex-col ${
          showPlaylist ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
        }}
      >
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center sticky top-0">
          <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
            Up Next
          </h3>
          <span className="text-[10px] text-zinc-500 font-medium">
            {playlist.length} {playlist.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="max-h-[24rem] overflow-y-auto">
          {playlist.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-center gap-3 text-zinc-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                <polyline points="17 2 12 7 7 2"></polyline>
              </svg>
              <div>
                <p className="text-xs font-medium text-zinc-400">Queue is empty</p>
                <p className="text-[10px] mt-1 opacity-80">Paste a link above to add videos</p>
              </div>
            </div>
          ) : (
            <div className="p-1.5 divide-y divide-zinc-800/50">
              {playlist.map((url, index) => {
                const videoId = extractVideoId(url);
                const thumbnail = videoId
                  ? `https://img.youtube.com/vi/${videoId}/default.jpg`
                  : null;
                const isActive = index === playlistIndex;

                return (
                  <div
                    key={index}
                    onClick={() => handlePlaySelection(index)}
                    className={`relative flex gap-3 p-2 rounded-md hover:bg-zinc-800/60 transition-colors group cursor-pointer ${
                      isActive ? "bg-zinc-800/80" : ""
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-zinc-300 rounded-r-full" />
                    )}

                    {thumbnail && (
                      <div className="relative flex-shrink-0 ml-1">
                        <img
                          src={thumbnail}
                          alt=""
                          className="w-14 h-8 object-cover rounded-[4px] border border-zinc-700/50"
                        />
                        {isActive && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-[4px]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none">
                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className={`text-xs truncate font-medium ${isActive ? "text-zinc-100" : "text-zinc-300"}`}>
                        {videoId || "Unknown Video"}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {isActive ? "Now Playing" : `#${index + 1}`}
                      </p>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromPlaylist(index);
                      }}
                      className="w-6 h-6 flex items-center justify-center self-center text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Remove from queue"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
