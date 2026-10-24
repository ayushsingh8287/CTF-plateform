// SHELL: the page frame (top bar with logo + navigation) wrapped around every screen.
import { logout } from "../lib/api.js";

export default function Shell({ nav, children, mainClass = "" }) {
  return (
    <>
      <header className="top">
        <div className="top-spacer" aria-hidden="true" />
        <nav>{nav}</nav>
      </header>
      <main className={mainClass}>{children}</main>
    </>
  );
}
export const LogoutBtn = () => (
  <button className="btn alt sm" onClick={logout}>
    Logout
  </button>
);
