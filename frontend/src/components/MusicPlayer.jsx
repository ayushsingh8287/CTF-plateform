import { useState, useRef, useEffect } from "react";

// Drop any audio file into client/src/music/ and it is picked up automatically.
// The title shown in the player is built from the file name:
//   "carryminati - charas_ganja-mere ko pyara.mp3"  ->  "Carryminati - Charas Ganja Mere Ko Pyara"
const files = import.meta.glob("../music/*.{mp3,m4a,ogg,wav,flac,aac,opus,webm}", {
  eager: true,
  query: "?url",
  import: "default",
});

const prettify = (path) =>
  path
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "") // extension
    .replace(/[([](official|lyric|lyrics|audio|video|hd|hq|music)[^)\]]*[)\]]/gi, "") // "(Official Video)" etc.
    .replace(/[_.]+/g, " ")
    .replace(/(?<=\S)-(?=\S)/g, " ") // hyphens inside words -> spaces (keeps " - " separators)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const TRACKS = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, url]) => ({ url, title: prettify(path) }));

const START_VOLUME = 0.15; // low by default
const BARS = 12;

export default function MusicPlayer() {
  const audio = useRef(null);
  const box = useRef(null);
  const text = useRef(null);
  const bars = useRef([]);
  const ctx = useRef(null);
  const analyser = useRef(null);
  const raf = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(START_VOLUME);
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState(TRACKS.length === 0);
  const resume = useRef(false);
  const track = TRACKS[index];
  const multi = TRACKS.length > 1;
  const [scroll, setScroll] = useState(false);
  const [live, setLive] = useState(false); // true when bars follow the real audio

  const label =
    TRACKS.length === 0
      ? "Add a song to src/music"
      : missing
        ? "Can't play this file"
        : track.title;

  useEffect(() => {
    const a = audio.current;
    a.volume = START_VOLUME;
    // Browsers usually block autoplay; this fails quietly and the user clicks play.
    a.play()
      .then(() => setPlaying(true))
      .catch(() => {});
    return () => {
      cancelAnimationFrame(raf.current);
      ctx.current && ctx.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  // Keep playing when the track changes.
  useEffect(() => {
    setMissing(TRACKS.length === 0);
    if (resume.current && audio.current) audio.current.play().catch(() => {});
  }, [index]);

  const go = (step) => {
    if (!multi) return;
    resume.current = !audio.current.paused;
    setIndex((i) => (i + step + TRACKS.length) % TRACKS.length);
  };

  // Scroll the title only if it doesn't fit.
  useEffect(() => {
    if (box.current && text.current)
      setScroll(text.current.scrollWidth > box.current.clientWidth);
  }, [label]);

  // Spectrum meter driven by the real audio (falls back to a CSS animation).
  useEffect(() => {
    const reset = () => bars.current.forEach((b) => b && (b.style.transform = ""));
    if (!playing || !live || !analyser.current) {
      cancelAnimationFrame(raf.current);
      reset();
      return;
    }
    const data = new Uint8Array(analyser.current.frequencyBinCount);
    let last = 0;
    const tick = (now) => {
      raf.current = requestAnimationFrame(tick);
      if (now - last < 50) return; // ~20 updates/sec is plenty and keeps the page smooth
      last = now;
      analyser.current.getByteFrequencyData(data);
      bars.current.forEach((b, i) => {
        if (b)
          b.style.transform = `scaleY(${(0.17 + (data[i + 1] / 255) * 0.8).toFixed(2)})`;
      });
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, live]);

  // Must run inside a click so the browser allows the AudioContext to start.
  const connectAnalyser = () => {
    if (ctx.current) return ctx.current.resume();
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const c = new AC();
      const src = c.createMediaElementSource(audio.current);
      const an = c.createAnalyser();
      an.fftSize = 64;
      an.smoothingTimeConstant = 0.78;
      src.connect(an);
      an.connect(c.destination);
      ctx.current = c;
      analyser.current = an;
      setLive(true);
      return c.resume();
    } catch {
      return Promise.resolve();
    }
  };

  const toggle = async () => {
    const a = audio.current;
    if (a.paused) {
      await connectAnalyser();
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setMissing(true));
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const status = missing ? "NO SIGNAL" : playing ? "NOW PLAYING" : "STANDBY";

  return (
    <div
      className={
        "music-player" + (playing ? " is-playing" : "") + (missing ? " is-error" : "")
      }
      role="group"
      aria-label="Music player"
    >
      <audio
        ref={audio}
        src={track ? track.url : undefined}
        loop={!multi}
        onEnded={() => go(1)}
        preload="auto"
        onError={() => setMissing(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="mp-shell">
        <div className="mp-body">
          <button
            type="button"
            className="mp-hex"
            onClick={toggle}
            aria-label={playing ? "Pause music" : "Play music"}
            title={playing ? "Pause" : "Play"}
          >
            <span className="mp-hex-in">{playing ? "❚❚" : "▶"}</span>
          </button>

          <div className="mp-info">
            <span className="mp-tag">
              <i className="mp-dot" aria-hidden="true" />
              {status}
              {multi && (
                <span className="mp-nav">
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label="Previous song"
                  >
                    ‹
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label="Next song">
                    ›
                  </button>
                </span>
              )}
            </span>
            <div className="mp-marquee" ref={box} title={label}>
              <div className={"mp-track" + (scroll && playing ? " run" : "")}>
                <span ref={text}>{label}</span>
                {scroll && <span aria-hidden="true">{label}</span>}
              </div>
            </div>
            <input
              className="mp-vol"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label="Volume"
            />
          </div>

          <div
            className={"mp-eq" + (!live && playing ? " fake" : "")}
            aria-hidden="true"
          >
            {Array.from({ length: BARS }, (_, i) => (
              <i
                key={i}
                ref={(el) => (bars.current[i] = el)}
                style={{ "--d": `${(i * 0.37) % 1}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
