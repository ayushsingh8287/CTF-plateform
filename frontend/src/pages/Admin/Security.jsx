// Admin tab: change admin password and manage authenticator (MFA).
import OtpReset from "../../components/OtpReset.jsx";
import Mfa from "../../components/Mfa.jsx";

export default function Security({ recheck }) {
  return (
    <>
      <Mfa onChange={recheck} />
      <div className="card" style={{ maxWidth: 520, marginTop: 14 }}>
        <h3>Change admin password</h3>
        <p style={{ color: "var(--m)", fontSize: 13 }}>
          Use this right away if anyone else may know the password. A 6-digit code is
          emailed to the admin email. After the change every admin session (including
          this one) is signed out.
        </p>
        <OtpReset reqUrl="/api/admin/security/otp" doUrl="/api/admin/security/change" />
      </div>
    </>
  );
}
