// PARTICIPANT DASHBOARD: score, rank, leaderboard and the challenge cards.
import { useState, useEffect, useCallback } from "react";
import { api, go } from "../../lib/api.js";
import Shell, { LogoutBtn } from "../../components/Shell.jsx";
import ChallengeModal from "./ChallengeModal.jsx";
import ProgressRing from "./ProgressRing.jsx";

const ini = (n) =>
  String(n)
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const DIFF_LEVEL = { Easy: 1, Medium: 2, Hard: 3 };
const jump = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Dash() {
  const [d, setD] = useState(null),
    [error, setError] = useState(""),
    [f, setF] = useState({ cat: "", d: "", s: "", p: "a", q: "" }),
    [open, setOpen] = useState(null);
  const load = useCallback(async () => {
    const [m, b, c] = await Promise.all([
      api("/api/me"),
      api("/api/leaderboard"),
      api("/api/challenges"),
    ]);
    if (m.status === 401) return go("login");
    if (!m.ok || !b.ok || !c.ok) {
      setError(
        m.d.error ||
          b.d.error ||
          c.d.error ||
          "Could not load dashboard data. Please try again.",
      );
      return;
    }
    if (!Array.isArray(b.d) || !Array.isArray(c.d) || !Array.isArray(m.d.members)) {
      setError("The server returned incomplete dashboard data.");
      return;
    }
    setError("");
    setD({ m: m.d, b: b.d, c: c.d });
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!open) load();
    }, 20000);
    return () => clearInterval(t);
  }, [load, open]);
  if (!d)
    return (
      <Shell nav={<LogoutBtn />}>
        <div className="card" role={error ? "alert" : "status"}>
          {error || "Loading dashboard..."}
          {error && (
            <button className="btn" onClick={load} style={{ marginLeft: 12 }}>
              Retry
            </button>
          )}
        </div>
      </Shell>
    );
  const { m, b, c } = d,
    set = (k) => (e) => setF({ ...f, [k]: e.target.value }),
    pct = m.total ? Math.round((m.solved / m.total) * 100) : 0,
    top = b[0]?.points || 1;
  const cats = [...new Set(c.map((x) => x.category))];
  const list = c
    .filter(
      (x) =>
        (!f.cat || x.category === f.cat) &&
        (!f.d || x.difficulty === f.d) &&
        (!f.s || String(+x.solved) === f.s) &&
        x.title.toLowerCase().includes(f.q.toLowerCase()),
    )
    .sort((a, z) => (f.p === "d" ? z.points - a.points : a.points - z.points));
  const sel = c.find((x) => x.id === open),
    pod = b.length >= 3 ? [b[1], b[0], b[2]] : [],
    rest = b.length >= 3 ? b.slice(3) : b;
  const lbRow = (x, i, arr) => (
    <div key={x.rank}>
      {i > 0 && x.rank - arr[i - 1].rank > 1 && <div className="gap">⋮</div>}
      <div className={"lb" + (x.mine ? " me" : "")}>
        <span className={"rk " + (x.rank < 4 ? "r" + x.rank : "")}>{x.rank}</span>
        <span className="nm">
          {x.team}
          {x.mine && " (you)"}
        </span>
        <b>{x.points}</b>
      </div>
      <div className="bar" style={{ height: 3, margin: "0 8px 4px" }}>
        <i style={{ width: Math.round((x.points / top) * 100) + "%" }} />
      </div>
    </div>
  );
  return (
    <Shell
      nav={
        <>
          <span className="who">{m.team_name}</span>
          <LogoutBtn />
        </>
      }
    >
      {error && (
        <p className="msg err" role="alert">
          {error}
        </p>
      )}
      <div className="d-wrap">
        <aside className="d-side">
          <div className="d-card d-team">
            <div className="d-av-lg">{ini(m.team_name)}</div>
            <h2>{m.team_name}</h2>
            <div className="d-sub">Team of {m.members.length}</div>
            <span className="d-rankpill">Rank #{m.rank}</span>
            <ProgressRing pct={pct} />
            <div className="d-sub">
              {m.solved} of {m.total} challenges solved
            </div>
          </div>
          <nav className="d-card d-nav" aria-label="Sections">
            <button onClick={() => jump("d-overview")}>Overview</button>
            <button onClick={() => jump("d-challenges")}>Challenges</button>
            <button onClick={() => jump("d-board")}>Leaderboard</button>
          </nav>
          <div className="d-card d-members">
            <h4>Team members</h4>
            {m.members.map((x) => (
              <div className="mem" key={x.email}>
                <span className="av">{ini(x.name)}</span>
                <div>
                  {x.name}
                  {x.email === m.leader_email && <span className="lead">leader</span>}
                  <small>{x.email}</small>
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="d-main">
          <div className="d-head" id="d-overview">
            <div>
              <h1>Dashboard</h1>
              <p>Welcome back, {m.team_name}</p>
            </div>
            <span className="live">
              <span className="dot" />
              live · updates every 20s
            </span>
          </div>
          <div className="d-kpis">
            {[
              ["Total points", m.points, "team score"],
              ["Rank", "#" + m.rank, "current position"],
              ["Solved", `${m.solved}/${m.total}`, pct + "% complete"],
              ["Remaining", Math.max(0, m.total - m.solved), "challenges left"],
            ].map(([l, v, s]) => (
              <div className="d-card d-kpi" key={l}>
                <span>{l}</span>
                <b>{v}</b>
                <small>{s}</small>
              </div>
            ))}
          </div>
          <div className="d-grid2">
            <div className="d-card">
              <h3 className="d-title">Progress by category</h3>
              {cats.length ? (
                cats.map((k) => {
                  const t = c.filter((x) => x.category === k),
                    s = t.filter((x) => x.solved).length;
                  return (
                    <div className="d-catrow" key={k}>
                      <div>
                        <span>{k}</span>
                        <span style={{ color: "var(--m)" }}>
                          {s}/{t.length}
                        </span>
                      </div>
                      <div className="bar">
                        <i
                          style={{
                            width: Math.round((s / t.length) * 100) + "%",
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="live">No challenges yet.</p>
              )}
            </div>
            <div className="d-card" id="d-board">
              <h3 className="d-title">
                Leaderboard{" "}
                <span className="live">
                  <span className="dot" />
                  live
                </span>
              </h3>
              {pod.length > 0 && (
                <div className="d-pods">
                  {pod.map((x) => (
                    <div
                      key={x.rank}
                      className={"d-pod p" + x.rank + (x.mine ? " me" : "")}
                    >
                      <i>#{x.rank}</i>
                      <div className="nm">
                        {x.team}
                        {x.mine && " (you)"}
                      </div>
                      <b>{x.points}</b>
                    </div>
                  ))}
                </div>
              )}
              {rest.map(lbRow)}
            </div>
          </div>
          <section id="d-challenges">
            <div className="sec" style={{ marginTop: 0 }}>
              <h2>Challenges</h2>
              <span className="live">{list.length} shown</span>
            </div>
            <div className="chips">
              <button
                className={"chip" + (!f.cat ? " on" : "")}
                onClick={() => setF({ ...f, cat: "" })}
              >
                All ({c.length})
              </button>
              {cats.map((k) => (
                <button
                  key={k}
                  className={"chip" + (f.cat === k ? " on" : "")}
                  onClick={() => setF({ ...f, cat: k })}
                >
                  {k} ({c.filter((x) => x.category === k).length})
                </button>
              ))}
            </div>
            <div className="d-tools">
              <input placeholder="Search challenges" value={f.q} onChange={set("q")} />
              <select value={f.d} onChange={set("d")}>
                <option value="">All difficulties</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
              <select value={f.s} onChange={set("s")}>
                <option value="">Solved + unsolved</option>
                <option value="1">Solved</option>
                <option value="0">Unsolved</option>
              </select>
              <select value={f.p} onChange={set("p")}>
                <option value="a">Points: low to high</option>
                <option value="d">Points: high to low</option>
              </select>
            </div>
            <div className="d-cards">
              {list.map((x) => (
                <div
                  key={x.id}
                  data-d={x.difficulty}
                  className={"d-ch" + (x.solved ? " solved" : "")}
                  tabIndex={0}
                  onClick={() => setOpen(x.id)}
                  onKeyDown={(e) => e.key === "Enter" && setOpen(x.id)}
                >
                  <div className="d-ch-top">
                    <span className="d-id">
                      MISSION {String(x.id).padStart(2, "0")}
                    </span>
                    <span className={"d-diff " + x.difficulty}>
                      {x.difficulty}
                      <span className="d-pips" aria-hidden="true">
                        {[0, 1, 2].map((n) => (
                          <i
                            key={n}
                            className={n < DIFF_LEVEL[x.difficulty] ? "on" : ""}
                          />
                        ))}
                      </span>
                    </span>
                  </div>
                  <span className="d-cat">{x.category}</span>
                  <h3>{x.title}</h3>
                  <p className="clamp">{x.description}</p>
                  <div className="d-ch-foot">
                    <span className="pts">
                      {x.points}
                      <small> pts</small>
                    </span>
                    <span>
                      {x.link && (
                        <a
                          href={x.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          ↗ Website
                        </a>
                      )}{" "}
                      {x.files.length > 0 && (
                        <span className="live">📎 {x.files.length} </span>
                      )}
                      <span className={"badge" + (x.solved ? " ok" : "")}>
                        {x.solved ? "✓ Solved" : "Unsolved"}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
              {!list.length && (
                <div className="empty">
                  No challenges match these filters.
                  <br />
                  <button
                    className="btn alt sm"
                    style={{ marginTop: 10 }}
                    onClick={() => setF({ cat: "", d: "", s: "", p: "a", q: "" })}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {sel && <ChallengeModal c={sel} onClose={() => setOpen(null)} onSolved={load} />}
    </Shell>
  );
}
