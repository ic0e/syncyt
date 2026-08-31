import { useState } from "react";
import ReactPlayer from "react-player";
import "./App.css";

function App() {
  const [url, setUrl] = useState("");
  const [inputValue, setInputValue] = useState("");

  return (
    <>
      <section id="center">
        <h1>Better sync tube</h1>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button onClick={() => setUrl(inputValue)}>Set URL</button>
        <div>
          <ReactPlayer
            src={url}
            controls={true}
            width="1000px"
            height="600px"
          />
        </div>
      </section>
    </>
  );
}

export default App;
