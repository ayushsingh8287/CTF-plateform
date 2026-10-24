// PASSWORD FIELD: a password input with a SHOW / HIDE button.
import { useState } from "react";

export default function PasswordField({ id, label }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input id={id} name={id} type={show ? "text" : "password"} required />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow(!show)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? "HIDE" : "SHOW"}
        </button>
      </div>
    </div>
  );
}
