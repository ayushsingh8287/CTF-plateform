// Admin tab: upload the teams CSV from the registration form.
import { useState } from "react";
import { api } from "../../lib/api.js";

export default function Import() {
  const [csv, setCsv] = useState(""),
    [m, setM] = useState({ t: "", ok: false });
  const submit = async (e) => {
    e.preventDefault();
    const r = await api("/api/admin/import", { method: "POST", json: { csv } });
    setM({
      ok: r.ok,
      t: r.ok ? `Imported ${r.d.teams} teams, ${r.d.emails} emails.` : r.d.error,
    });
  };
  return (
    <form className="card" onSubmit={submit}>
      <h3>Import approved participants</h3>
      <p style={{ color: "var(--m)" }}>
        Export your Google Form responses as CSV with columns: team name, leader name,
        leader email, member 1 name, member 1 email, member 2 name, member 2 email.
        Re-importing is safe: existing accounts, scores and submissions are untouched.
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const r = new FileReader();
          r.onload = () => setCsv(r.result);
          r.readAsText(e.target.files[0]);
        }}
      />
      <label>or paste CSV</label>
      <textarea rows="8" value={csv} onChange={(e) => setCsv(e.target.value)} />
      <p className={"msg " + (m.ok ? "ok" : "err")}>{m.t}</p>
      <button className="btn">Import</button>
    </form>
  );
}
