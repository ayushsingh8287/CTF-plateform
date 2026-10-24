import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api.js";
// Authenticator-app (TOTP) setup. forced = the admin cannot use the panel until this is finished.
export default function Mfa({ forced, onChange }) {
  const [st, setSt] = useState(null),
    [setup, setSetup] = useState(null),
    [codes, setCodes] = useState(null),
    [msg, setMsg] = useState({ t: "", ok: false }),
    [loading, setLoading] = useState(true),
    [starting, setStarting] = useState(false),
    [otpSent, setOtpSent] = useState(false),
    [ticket, setTicket] = useState(""),
    [loadError, setLoadError] = useState("");
  const autoStarted = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const r = await api("/api/admin/mfa/status");
      if (!r.ok)
        throw new Error(
          r.d.error || "Could not check multi-factor authentication status.",
        );
      setSt(r.d);
    } catch (e) {
      setLoadError(e.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const say = (t, ok = false) => setMsg({ t, ok });
  const start = async () => {
    setStarting(true);
    try {
      const r = await api("/api/admin/mfa/authorize", {
        method: "POST",
        json: {},
      });
      if (r.ok) {
        setOtpSent(true);
        say(r.d.message || "Check the admin email for a verification code.", true);
      } else say(r.d.error || "Could not send the verification code.");
    } catch {
      say("Could not connect to the server. Please try again.");
    } finally {
      setStarting(false);
    }
  };
  useEffect(() => {
    if (forced && st && !st.on && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [forced, st]);
  const verifyEmail = async (e) => {
    e.preventDefault();
    setStarting(true);
    try {
      const r = await api("/api/admin/mfa/authorize/verify", {
        method: "POST",
        json: { code: new FormData(e.target).get("code") },
      });
      if (!r.ok) return say(r.d.error || "Could not verify the email code.");
      setTicket(r.d.ticket);
      const setupResponse = await api("/api/admin/mfa/setup", {
        method: "POST",
        json: { ticket: r.d.ticket },
      });
      if (!setupResponse.ok)
        return say(setupResponse.d.error || "Could not start MFA setup.");
      setSetup(setupResponse.d);
      say("");
    } catch {
      say("Could not connect to the server. Please try again.");
    } finally {
      setStarting(false);
    }
  };
  const enable = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/api/admin/mfa/enable", {
        method: "POST",
        json: { ticket, code: new FormData(e.target).get("code") },
      });
      if (!r.ok) return say(r.d.error || "Could not enable MFA.");
      setCodes(r.d.codes);
      setSetup(null);
      say("Multi-factor authentication is now ON.", true);
      load();
    } catch {
      say("Could not connect to the server. Please try again.");
    }
  };
  const reset = async (e) => {
    e.preventDefault();
    if (
      !confirm(
        "Reset the authenticator? You must set it up again on your phone right away.",
      )
    )
      return;
    try {
      const r = await api("/api/admin/mfa/disable", {
        method: "POST",
        json: { code: new FormData(e.target).get("code") },
      });
      if (!r.ok) return say(r.d.error || "Could not reset MFA.");
      setCodes(null);
      onChange && onChange();
    } catch {
      say("Could not connect to the server. Please try again.");
    }
  };
  if (!st)
    return (
      <div className="card" style={{ maxWidth: 520, margin: forced ? "30px auto" : 0 }}>
        <h3>
          {forced
            ? "Set up multi-factor authentication"
            : "Multi-factor authentication"}
        </h3>
        {loading ? (
          <p role="status">Checking MFA status...</p>
        ) : (
          <>
            <p className="msg err" role="alert">
              {loadError}
            </p>
            <button className="btn" onClick={load}>
              Retry
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className="card" style={{ maxWidth: 520, margin: forced ? "30px auto" : 0 }}>
      <h3>
        {forced ? "Set up multi-factor authentication" : "Multi-factor authentication"}
      </h3>
      <p style={{ color: "var(--m)", fontSize: 13 }}>
        {forced
          ? "MFA is required for the admin panel. Set it up to continue."
          : "MFA is required for the admin panel."}{" "}
        Status: <b className={st.on ? "ok" : "err"}>{st.on ? "ON" : "NOT SET UP"}</b>.
        Every admin login needs the password and a code from your authenticator app.
      </p>
      {!st.on && !setup && (
        <p style={{ color: "var(--m)", fontSize: 13 }}>
          For security, we first verify access to the admin email before showing an
          authenticator QR code.
        </p>
      )}
      {codes && (
        <div className="card" style={{ margin: "12px 0" }}>
          <b>Recovery codes. Save them now, they are shown only once.</b>
          <p style={{ color: "var(--m)", fontSize: 13 }}>
            Each works one time if you lose your phone.
          </p>
          <pre>{codes.join("\n")}</pre>
          {forced && (
            <button className="btn" onClick={() => onChange && onChange()}>
              I saved them, continue
            </button>
          )}
        </div>
      )}
      {!st.on && !setup && (
        <button className="btn" onClick={start} disabled={starting}>
          {starting
            ? "Sending code..."
            : otpSent
              ? "Resend email verification code"
              : "Send email verification code"}
        </button>
      )}
      {!st.on && otpSent && !setup && (
        <form onSubmit={verifyEmail} autoComplete="off">
          <label htmlFor="mfa-email-code">
            6-digit verification code sent to the admin email
          </label>
          <input
            id="mfa-email-code"
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
          />
          <button className="btn" disabled={starting}>
            {starting ? "Verifying..." : "Verify email and continue"}
          </button>
        </form>
      )}
      {setup && (
        <form onSubmit={enable} autoComplete="off">
          <p style={{ fontSize: 13 }}>
            Scan with Google Authenticator, Microsoft Authenticator or Authy, or type
            this key: <code>{setup.secret}</code>
          </p>
          <img
            src={setup.qr}
            alt="QR code for the authenticator app"
            width="220"
            height="220"
            style={{ background: "#fff", padding: 8, borderRadius: 8 }}
          />
          <label htmlFor="mc">6-digit code shown in the app</label>
          <input
            id="mc"
            name="code"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
          />
          <p />
          <button className="btn">Turn on MFA</button>
        </form>
      )}
      {st.on && !forced && (
        <form onSubmit={reset} autoComplete="off">
          <p style={{ fontSize: 13 }}>Recovery codes left: {st.recovery}</p>
          <label htmlFor="md">
            New phone? Enter a current app code or an unused recovery code to reset the
            authenticator
          </label>
          <input id="md" name="code" maxLength={11} required />
          <p />
          <button className="btn danger">Reset authenticator</button>
        </form>
      )}
      <p className={"msg " + (msg.ok ? "ok" : "err")} role="alert">
        {msg.t}
      </p>
    </div>
  );
}
