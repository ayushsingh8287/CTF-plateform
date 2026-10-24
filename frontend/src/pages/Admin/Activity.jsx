// Admin tab: live feed of flag submissions and solves.
import { useState, useEffect } from "react";
import { api, fmt, go } from "../../lib/api.js";

export default function Activity() {
  const [a, setA] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
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
  const removeSolve = async (solve) => {
    if (
      !confirm(
        `Remove ${solve.title} from ${solve.team_name}'s score? ${solve.points} points will be revoked. The flag submission history will remain.`,
      )
    )
      return;
    const key = `${solve.team_key}:${solve.challenge_id}`;
    setBusy(key);
    const r = await api("/api/admin/activity/solves", {
      method: "DELETE",
      json: { team_key: solve.team_key, challenge_id: solve.challenge_id },
    });
    setBusy("");
    if (r.status === 401) return go("admin-login");
    if (!r.ok) {
      setError(r.d.error || "Could not remove the solve.");
      return;
    }
    await load();
  };
  const removeSubmission = async (submission) => {
    if (
      !confirm(
        `Delete this ${submission.correct ? "correct" : "wrong"} flag submission by ${submission.team_name || "this team"} for ${submission.title || "this challenge"}? This only removes the selected history entry.`,
      )
    )
      return;
    const key = `submission:${submission.id}`;
    setBusy(key);
    const r = await api(`/api/admin/activity/submissions/${submission.id}`, {
      method: "DELETE",
    });
    setBusy("");
    if (r.status === 401) return go("admin-login");
    if (!r.ok) {
      setError(r.d.error || "Could not delete the submission.");
      return;
    }
    await load();
  };
  return (
    <>
      {error && (
        <div className="card err" role="alert">
          {error}
        </div>
      )}
      <h3>Team member scores</h3>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Member</th>
              <th>Problems solved</th>
              <th>Problems</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {a.members.map((x) => (
              <tr key={`${x.team_key}:${x.email}`}>
                <td>{x.team_name}</td>
                <td>{x.member_name}</td>
                <td>{x.solves}</td>
                <td>{x.problems || "—"}</td>
                <td>{x.points}</td>
              </tr>
            ))}
            {!a.members.length && (
              <tr>
                <td colSpan="5">No team members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h3>Solves</h3>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Team</th>
              <th>Member</th>
              <th>Challenge</th>
              <th>Pts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {a.solves.map((x) => {
              const key = `${x.team_key}:${x.challenge_id}`;
              return (
                <tr key={key}>
                  <td>{fmt(x.ts)}</td>
                  <td>{x.team_name}</td>
                  <td>{x.member_name || x.by_email || "Unknown"}</td>
                  <td>{x.title}</td>
                  <td>{x.points}</td>
                  <td>
                    <button
                      className="btn sm danger"
                      disabled={busy === key}
                      onClick={() => removeSolve(x)}
                    >
                      {busy === key ? "Removing..." : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!a.solves.length && (
              <tr>
                <td colSpan="6">No solves yet.</td>
              </tr>
            )}
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {a.submissions.map((x) => {
              const key = `submission:${x.id}`;
              return (
                <tr key={x.id}>
                  <td>{fmt(x.ts)}</td>
                  <td>{x.team_name}</td>
                  <td>{x.title}</td>
                  <td>{x.flag}</td>
                  <td className={x.correct ? "ok" : "err"}>
                    {x.correct ? "correct" : "wrong"}
                  </td>
                  <td>{x.ip}</td>
                  <td>
                    <button
                      className="btn sm danger"
                      disabled={busy === key}
                      onClick={() => removeSubmission(x)}
                    >
                      {busy === key ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!a.submissions.length && (
              <tr>
                <td colSpan="7">No flag submissions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
