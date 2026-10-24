// ADMIN LOGIN PAGE: step 1 password, step 2 authenticator code (or first-time MFA setup).
import { useState } from "react";
import { api, go } from "../lib/api.js";
import Shell from "../components/Shell.jsx";
import Hud from "../components/Hud.jsx";
import Mfa from "../components/Mfa.jsx";

export default function AdminLogin() {
  const [tk, setTk] = useState(null),
    [setup, setSetup] = useState(false),
    [msg, setMsg] = useState("");
  const s1 = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/admin/login", {
        method: "POST",
        json: Object.fromEntries(new FormData(e.target)),
      });
      if (!r.ok) return setMsg(r.d.error || "Request failed.");
      if (r.d.mfa) {
        setMsg("");
        return setTk(r.d.ticket);
      }
      if (r.d.mfa_setup) {
        setMsg("");
        return setSetup(true);
      }
      go("admin");
    } catch {
      setMsg("Could not connect to the server. Please try again.");
    }
  };
  const s2 = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/admin/login/mfa", {
        method: "POST",
        json: { ticket: tk, code: new FormData(e.target).get("code") },
      });
      if (!r.ok) {
        if (r.d.restart) setTk(null);
        return setMsg(r.d.error || "Request failed.");
      }
      go("admin");
    } catch {
      setMsg("Could not connect to the server. Please try again.");
    }
  };
  if (setup)
    return (
      <Shell>
        <Mfa forced onChange={() => go("admin")} />
      </Shell>
    );
  return (
    <Shell>
      <Hud jp="管理" tag="ORGANIZER LINK">
        <div className="card auth">
          <span className="auth-kicker">// ORGANIZER CONSOLE</span>
          <h2>Admin login</h2>
          {!tk ? (
            <form onSubmit={s1} autoComplete="off">
              <label htmlFor="email">Admin email</label>
              <input id="email" name="email" type="email" required />
              <label htmlFor="password">Admin password</label>
              <input id="password" name="password" type="password" required />
              <p className="msg err" role="alert">
                {msg}
              </p>
              <button className="btn" style={{ width: "100%" }}>
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={s2} autoComplete="off">
              <label htmlFor="code">Authenticator app code (or a recovery code)</label>
              <input id="code" name="code" maxLength={11} autoFocus required />
              <p className="msg err" role="alert">
                {msg}
              </p>
              <button className="btn" style={{ width: "100%" }}>
                Verify and login
              </button>
            </form>
          )}
          <p style={{ color: "var(--m)", fontSize: 13 }}>
            <a href="#admin-forgot">Forgot admin password?</a> · <a href="#">Back</a>
          </p>
        </div>
      </Hud>
    </Shell>
  );
}
