// CHALLENGE POPUP: shows one challenge (description, files, link) and the flag submit box.
import { useState, useEffect } from "react";
import { api, kb } from "../../lib/api.js";

export default function ChallengeModal({ c, onClose, onSolved }) {
  const [msg, setMsg] = useState({ t: "", ok: false }),
    [lock, setLock] = useState(0);
  useEffect(() => {
    if (lock <= 0) return;
    const t = setTimeout(() => setLock(lock - 1), 1000);
    return () => clearTimeout(t);
  }, [lock]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  const submit = async (e) => {
    e.preventDefault();
    const r = await api(`/api/challenges/${c.id}/submit`, {
      method: "POST",
      json: { flag: new FormData(e.target).get("flag") },
    });
    if (r.status === 429) {
      setLock(r.d.retry_after || 120);
      return setMsg({ t: r.d.error, ok: false });
    }
    setMsg({ t: r.d.message || r.d.error, ok: r.d.status === "correct" });
    if (r.d.locked) setLock(r.d.locked);
    if (r.d.status === "correct") onSolved();
  };
  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card">
        <span className="pill">{c.category}</span>
        <span className={"pill " + c.difficulty}>{c.difficulty}</span>
        <span className={"badge " + (c.solved ? "ok" : "")}>
          {c.solved ? "✓ Solved" : "Unsolved"}
        </span>
        <h2>{c.title}</h2>
        <p className="pts">
          {c.points} <small>points</small>
        </p>
        <pre>{c.description}</pre>
        {(c.files.length > 0 || c.link) && (
          <>
            <h4>Challenge resources</h4>
            {c.link && (
              <div className="fileline">
                <a href={c.link} target="_blank" rel="noopener noreferrer">
                  ↗ {c.link}
                </a>
                <span style={{ color: "var(--m)" }}>Website</span>
              </div>
            )}
            {c.files.map((f) => (
              <div className="fileline" key={f.id}>
                <a href={`/api/files/${f.id}`} download>
                  ⬇ {f.name}
                </a>
                <span style={{ color: "var(--m)" }}>
                  {f.name.split(".").pop()} · {kb(f.size)}
                </span>
              </div>
            ))}
          </>
        )}
        <form onSubmit={submit}>
          <label htmlFor="flag">Enter flag</label>
          <input
            id="flag"
            name="flag"
            maxLength={200}
            required
            autoComplete="off"
            autoFocus
            disabled={lock > 0}
            placeholder="P4R4DOXCTF{...}"
          />
          <p className={"msg " + (msg.ok ? "ok" : "err")} role="alert">
            {msg.t}
          </p>
          <button className="btn" disabled={lock > 0}>
            {lock > 0
              ? `Locked ${Math.floor(lock / 60)}:${String(lock % 60).padStart(2, "0")}`
              : "Submit Flag"}
          </button>{" "}
          <button type="button" className="btn alt" onClick={onClose}>
            Close
          </button>
        </form>
      </div>
    </div>
  );
}
