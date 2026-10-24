// Admin dashboard tab: teams, scores, accounts, reset codes, removals.
import { useState, useEffect, useCallback } from "react";
import { api, go, fmt } from "../../lib/api.js";

export default function Overview() {
  const [d, setD] = useState(null),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [z, setZ] = useState(""),
    [sel, setSel] = useState([]);
  const load = useCallback(async () => {
    const r = await api("/api/admin/overview");
    if (r.status === 401) return go("admin-login");
    if (!r.ok) return setError(r.d.error || "Could not load team overview.");
    setError("");
    setD(r.d);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!d)
    return (
      <div className="card" role={error ? "alert" : "status"}>
        {error || "Loading team overview..."}
        {error && (
          <button className="btn" onClick={load} style={{ marginLeft: 12 }}>
            Retry
          </button>
        )}
      </div>
    );
  const s = d.stats;
  const reset = async (email) => {
    const r = await api("/api/admin/reset-code", {
      method: "POST",
      json: { email },
    });
    alert(
      r.ok
        ? `Reset code for ${email}:\n\n${r.d.code}\n\nValid for ${r.d.expires}. Share it privately.`
        : r.d.error,
    );
  };
  const removeTeams = async () => {
    if (
      !sel.length ||
      !confirm(
        `Remove ${sel.length} team(s)? This deletes their emails, accounts, scores and submissions. It cannot be undone.`,
      )
    )
      return;
    const r = await api("/api/admin/teams/remove", {
      method: "POST",
      json: { team_keys: sel },
    });
    if (r.ok) {
      setSel([]);
      load();
    } else alert(r.d.error);
  };
  const removeMember = async (email) => {
    if (!confirm(`Remove ${email}? Their account will be deleted.`)) return;
    const r = await api("/api/admin/participants/remove", {
      method: "POST",
      json: { email },
    });
    if (r.ok) load();
    else alert(r.d.error);
  };
  const rows = [...d.teams]
    .sort((a, b) => a.rank - b.rank)
    .filter(
      (t) =>
        (t.team_name + t.leader_name + t.members.map((m) => m.email).join())
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (!z || String(t.size) === z),
    );
  return (
    <>
      <div className="stats">
        {[
          ["Teams", s.teams],
          ["Participants", s.participants],
          ["Solo", s.solo],
          ["2-member", s.two],
          ["3-member", s.three],
        ].map(([l, v]) => (
          <div className="card stat" key={l}>
            <b>{v}</b>
            {l}
          </div>
        ))}
      </div>
      <p>Recent: {d.recent.join(", ") || "none"}</p>
      <div className="filters">
        <input
          placeholder="Search team, leader or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={z} onChange={(e) => setZ(e.target.value)}>
          <option value="">All sizes</option>
          <option>1</option>
          <option>2</option>
          <option>3</option>
        </select>
        <a className="btn alt" href="/api/admin/export.csv">
          Export CSV
        </a>
        <button className="btn danger" disabled={!sel.length} onClick={removeTeams}>
          Remove selected ({sel.length})
        </button>
      </div>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  aria-label="Select all shown"
                  checked={
                    rows.length > 0 && rows.every((t) => sel.includes(t.team_key))
                  }
                  onChange={(e) =>
                    setSel(e.target.checked ? rows.map((t) => t.team_key) : [])
                  }
                />
              </th>
              <th>Rank</th>
              <th>Team</th>
              <th>Leader</th>
              <th>Members</th>
              <th>Pts</th>
              <th>Accounts (passwords are hashed, never viewable)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.team_key}>
                <td>
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    aria-label={"Select " + t.team_name}
                    checked={sel.includes(t.team_key)}
                    onChange={(e) =>
                      setSel(
                        e.target.checked
                          ? [...sel, t.team_key]
                          : sel.filter((k) => k !== t.team_key),
                      )
                    }
                  />
                </td>
                <td>#{t.rank}</td>
                <td>{t.team_name}</td>
                <td>
                  {t.leader_name}
                  <br />
                  {t.leader_email}
                </td>
                <td>
                  {t.members.map((m) => (
                    <div key={m.email}>
                      {m.name}
                      <br />
                      {m.email}{" "}
                      {m.email !== t.leader_email && (
                        <button
                          className="btn sm danger"
                          title="Remove this email"
                          onClick={() => removeMember(m.email)}
                        >
                          &#10005;
                        </button>
                      )}
                    </div>
                  ))}
                </td>
                <td>{t.points}</td>
                <td>
                  {t.accounts.length
                    ? t.accounts.map((a) => (
                        <div key={a.email}>
                          {a.email}
                          <br />
                          created {fmt(a.created)}
                          <br />
                          pw changed {fmt(a.password_updated)} ({a.history.length}{" "}
                          events)
                          <br />
                          <button
                            className="btn sm ghost"
                            onClick={() => reset(a.email)}
                          >
                            Reset code
                          </button>
                          <hr />
                        </div>
                      ))
                    : "No account yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
