// PARTICIPANT AUTH PAGES: Login, Sign up and Forgot password share one form component.
// To change a form's fields or texts, edit the FORMS list below.
import { useState } from "react";
import { api, go } from "../lib/api.js";
import Shell from "../components/Shell.jsx";
import Hud from "../components/Hud.jsx";
import PasswordField from "../components/PasswordField.jsx";

export const FORMS = {
  login: {
    t: "Login",
    url: "/api/login",
    f: [
      ["email", "Registered email", "email"],
      ["password", "Password", "password"],
    ],
    to: "dash",
    links: (
      <>
        <a href="#forgot">Forgot password?</a> · <a href="#signup">Create account</a>
      </>
    ),
  },
  signup: {
    t: "Sign up",
    url: "/api/signup",
    f: [
      ["email", "Email used in the Google Form", "email"],
      ["password", "New password", "password"],
      ["confirm", "Confirm password", "password"],
    ],
    to: "login",
    ok: "Account created. You can now login.",
    links: <a href="#login">Already have an account?</a>,
  },
  forgot: {
    t: "Reset password",
    url: "/api/forgot",
    f: [
      ["email", "Registered email", "email"],
      ["code", "Reset code from the organizer", "text"],
      ["password", "New password", "password"],
    ],
    to: "login",
    links: (
      <>
        Ask the organizer for a reset code. <a href="#login">Back to login</a>
      </>
    ),
  },
};

const JP = { login: "接続", signup: "登録", forgot: "復旧" };

export default function Auth({ kind }) {
  const F = FORMS[kind],
    [msg, setMsg] = useState({ t: "", ok: false });
  const submit = async (e) => {
    e.preventDefault();
    const r = await api(F.url, {
      method: "POST",
      json: Object.fromEntries(new FormData(e.target)),
    });
    if (!r.ok) return setMsg({ t: r.d.error || "Request failed.", ok: false });
    setMsg({ t: r.d.message || F.ok || "Success", ok: true });
    setTimeout(() => go(F.to), kind === "login" || kind === "admin-login" ? 0 : 1400);
  };
  return (
    <Shell>
      <Hud jp={JP[kind]} tag="SECURE CHANNEL">
        <form className="card auth" onSubmit={submit} autoComplete="off" key={kind}>
          <span className="auth-kicker">// ACCESS TERMINAL</span>
          <h2>{F.t}</h2>
          {F.f.map(([n, l, t]) =>
            t === "password" ? (
              <PasswordField key={n} id={n} label={l} />
            ) : (
              <div key={n}>
                <label htmlFor={n}>{l}</label>
                <input id={n} name={n} type={t} required />
              </div>
            ),
          )}
          <p className={"msg " + (msg.ok ? "ok" : "err")} role="alert">
            {msg.t}
          </p>
          <button className="btn" style={{ width: "100%" }}>
            {F.t}
          </button>
          <p style={{ color: "var(--m)", fontSize: 13 }}>{F.links}</p>
        </form>
      </Hud>
    </Shell>
  );
}
