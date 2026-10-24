// ADMIN FORGOT-PASSWORD PAGE: emails a code to the admin address, then sets a new password.
import Shell from "../components/Shell.jsx";
import Hud from "../components/Hud.jsx";
import OtpReset from "../components/OtpReset.jsx";

export default function AdminForgot() {
  return (
    <Shell>
      <Hud jp="復旧" tag="RECOVERY LINK">
        <div className="card auth">
          <span className="auth-kicker">// RECOVERY</span>
          <h2>Reset admin password</h2>
          <p style={{ color: "var(--m)", fontSize: 13 }}>
            A verification code will be emailed to the admin email address.
          </p>
          <OtpReset
            withEmail
            reqUrl="/api/admin/forgot/request"
            doUrl="/api/admin/forgot/reset"
          />
          <p style={{ fontSize: 13 }}>
            <a href="#admin-login">Back to admin login</a>
          </p>
        </div>
      </Hud>
    </Shell>
  );
}
