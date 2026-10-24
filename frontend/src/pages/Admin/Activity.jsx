// Admin tab: live feed of flag submissions and solves.
import { useState, useEffect } from "react";
import { api, fmt, go } from "../../lib/api.js";

export default function Activity() {
  const [a, setA] = useState(null),
    [error, setError] = useState("");
  const load = async () => {
    const r = await api("/api/admin/activity");
    if (r.status === 401) return go("admin-login");
    if (!r.ok) return setError(r.d.error || "Could not load activity.");
    setError("");
    setA(r.d);
  };
  useEffect(() => {
    load();
  }, []);
  if (!a)
    return (
      <div className="card" role={error ? "alert" : "status"}>
        {error || "Loading activity..."}
        {error && (
          <button className="btn" onClick={load} style={{ marginLeft: 12 }}>
            Retry
          </button>
        )}
      </div>
    );
  return (
    <>
      <h3>Solves</h3>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Team</th>
              <th>Challenge</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {a.solves.map((x, i) => (
              <tr key={i}>
                <td>{fmt(x.ts)}</td>
                <td>{x.team_name}</td>
                <td>{x.title}</td>
                <td>{x.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Flag submissions</h3>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Team</th>
              <th>Challenge</th>
              <th>Submitted</th>
              <th>Result</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {a.submissions.map((x, i) => (
              <tr key={i}>
                <td>{fmt(x.ts)}</td>
                <td>{x.team_name}</td>
                <td>{x.title}</td>
                <td>{x.flag}</td>
                <td className={x.correct ? "ok" : "err"}>
                  {x.correct ? "correct" : "wrong"}
                </td>
                <td>{x.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
