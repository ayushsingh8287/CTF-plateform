// Admin tab: create / edit / hide / delete challenges and upload files.
import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";

export default function Challenges() {
  const [d, setD] = useState(null),
    [edit, setEdit] = useState(null),
    [msg, setMsg] = useState(""),
    [loadError, setLoadError] = useState("");
  const load = useCallback(async () => {
    const r = await api("/api/admin/challenges");
    if (r.status === 401) return (location.hash = "admin-login");
    if (!r.ok) return setLoadError(r.d.error || "Could not load challenges.");
    setLoadError("");
    setD(r.d);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  if (!d)
    return (
      <div className="card" role={loadError ? "alert" : "status"}>
        {loadError || "Loading challenges..."}
        {loadError && (
          <button className="btn" onClick={load} style={{ marginLeft: 12 }}>
            Retry
          </button>
        )}
      </div>
    );
  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = await api(
      edit ? `/api/admin/challenges/${edit.id}` : "/api/admin/challenges",
      { method: edit ? "PUT" : "POST", form: fd },
    );
    if (r.ok) {
      setEdit(null);
      setMsg("");
      e.target.reset();
      load();
    } else setMsg(r.d.error);
  };
  const patch = async (id, k, v) => {
    await api("/api/admin/challenges/" + id, {
      method: "PATCH",
      json: { [k]: v },
    });
    load();
  };
  const del = async (id) => {
    if (
      confirm(
        "Delete this challenge? Teams will lose points awarded for it. Submission history will be kept.",
      )
    ) {
      const r = await api("/api/admin/challenges/" + id, {
        method: "DELETE",
      });
      if (!r.ok) return alert(r.d.error || "Could not delete the challenge.");
      await load();
    }
  };
  const e = edit || {};
  return (
    <>
      <form className="card" onSubmit={submit} key={e.id || "new"}>
        <h3>{edit ? `Edit challenge #${e.id}` : "Add challenge"}</h3>
        <div className="filters">
          <div>
            <label>Title</label>
            <input name="title" required maxLength={100} defaultValue={e.title} />
          </div>
          <div>
            <label>Category</label>
            <select name="category" defaultValue={e.category}>
              {d.CATS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Difficulty</label>
            <select name="difficulty" defaultValue={e.difficulty}>
              {d.DIFFS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Points</label>
            <input
              name="points"
              type="number"
              min="1"
              max="10000"
              required
              defaultValue={e.points}
            />
          </div>
        </div>
        <label>Challenge URL (optional, must start with https:// or http://)</label>
        <input
          name="link"
          type="url"
          maxLength={2048}
          placeholder="https://example.com/challenge"
          defaultValue={e.link || ""}
        />
        <label>Description</label>
        <textarea name="description" rows="4" defaultValue={e.description} />
        <label>Flag (leave blank when editing to keep the current one)</label>
        <input name="flag" autoComplete="off" />
        <label>Files (png, jpg, txt, log, zip, pcap, pdf, csv, json)</label>
        <input type="file" name="files" multiple />
        <label>
          <input
            type="checkbox"
            name="replace_files"
            value="1"
            style={{ width: "auto" }}
          />{" "}
          Replace existing files
        </label>
        <p className="msg err">{msg}</p>
        <button className="btn">Save challenge</button>{" "}
        {edit && (
          <button type="button" className="btn alt" onClick={() => setEdit(null)}>
            Cancel edit
          </button>
        )}
      </form>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Pts</th>
              <th>Solves</th>
              <th>Files</th>
              <th>Challenge URL</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {d.cs.map((x) => (
              <tr key={x.id}>
                <td>{x.title}</td>
                <td>
                  {x.category} · {x.difficulty}
                </td>
                <td>{x.points}</td>
                <td>{x.solves}</td>
                <td>{x.files.map((f) => f.name).join(", ")}</td>
                <td>
                  {x.link && (
                    <a href={x.link} target="_blank" rel="noopener noreferrer">
                      {x.link}
                    </a>
                  )}
                </td>
                <td>
                  {x.enabled ? "enabled" : "disabled"}
                  {x.hidden ? ", hidden" : ""}
                </td>
                <td>
                  <button
                    className="btn sm alt"
                    onClick={() => {
                      setEdit(x);
                      scrollTo(0, 0);
                    }}
                  >
                    Edit
                  </button>{" "}
                  <button
                    className="btn sm alt"
                    onClick={() => patch(x.id, "enabled", !x.enabled)}
                  >
                    {x.enabled ? "Disable" : "Enable"}
                  </button>{" "}
                  <button
                    className="btn sm alt"
                    onClick={() => patch(x.id, "hidden", !x.hidden)}
                  >
                    {x.hidden ? "Show" : "Hide"}
                  </button>{" "}
                  <button className="btn sm danger" onClick={() => del(x.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
