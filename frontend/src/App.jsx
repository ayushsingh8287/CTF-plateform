// APP: the "router". It looks at the part of the URL after # (like #login or #admin)
// and shows the matching page. To add a new page: create it in pages/, import it, add a line below.
//
//   #            -> Landing        #login/#signup/#forgot -> Auth
//   #dash        -> Dashboard      #admin-login           -> AdminLogin
//   #admin       -> Admin          #admin-forgot          -> AdminForgot
import { useState, useEffect } from "react";
import { api } from "./lib/api.js";
import CityBackdrop from "./components/CityBackdrop.jsx";
import MusicPlayer from "./components/MusicPlayer.jsx";
import Landing from "./pages/Landing.jsx";
import Auth, { FORMS } from "./pages/Auth.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminForgot from "./pages/AdminForgot.jsx";
import Dash from "./pages/Dashboard";
import Admin from "./pages/Admin";

export default function App() {
  const [h, setH] = useState(location.hash.slice(1)),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const f = () => setH(location.hash.slice(1));
    addEventListener("hashchange", f);
    api("/api/me").then(() => setReady(true)); // also sets the CSRF cookie
    return () => removeEventListener("hashchange", f);
  }, []);
  const known =
    h === "admin-login" ||
    h === "admin-forgot" ||
    FORMS[h] ||
    h === "dash" ||
    h === "admin";
  // The backdrop is mounted once at the app root so the scene never restarts
  // when the route changes. Data screens get a calmer, darker grade.
  const page = !ready ? null : h === "admin-login" ? (
    <AdminLogin />
  ) : h === "admin-forgot" ? (
    <AdminForgot />
  ) : FORMS[h] ? (
    <Auth kind={h} />
  ) : h === "dash" ? (
    <Dash />
  ) : h === "admin" ? (
    <Admin />
  ) : (
    <Landing />
  );
  return (
    <>
      <CityBackdrop variant={known ? "app" : "hero"} />
      {page && <div className="app-root">{page}</div>}
      <MusicPlayer />
    </>
  );
}
