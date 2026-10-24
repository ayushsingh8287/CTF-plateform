// ADMIN PAGE: checks the admin is logged in with MFA, then shows the tabs.
// To add a new tab: create pages/Admin/YourTab.jsx, import it here and add it to TABS.
import { useState, useEffect, useCallback } from "react";
import { api, go } from "../../lib/api.js";
import Shell, { LogoutBtn } from "../../components/Shell.jsx";
import Mfa from "../../components/Mfa.jsx";
import Overview from "./Overview.jsx";
import Challenges from "./Challenges.jsx";
import Activity from "./Activity.jsx";
import Import from "./Import.jsx";
import Security from "./Security.jsx";

const TABS = {
  overview: Overview,
  challenges: Challenges,
  activity: Activity,
  import: Import,
  security: Security,
};
export default function Admin() {
  const [gate, setGate] = useState(null),
    [gateError, setGateError] = useState(""),
    [tab, setTab] = useState("overview");
  const check = useCallback(async () => {
    const r = await api("/api/admin/mfa/status");
    if (r.status === 401 || r.status === 403) return go("admin-login");
    if (!r.ok) {
      setGateError(r.d.error || "Could not check admin authentication.");
      return;
    }
    setGateError("");
    setGate(r.d.on ? "ok" : "setup");
  }, []);
  useEffect(() => {
    check();
  }, [check]);
  if (!gate)
    return (
      <Shell nav={<LogoutBtn />}>
        <div className="card" role={gateError ? "alert" : "status"}>
          {gateError || "Checking admin authentication..."}
          {gateError && (
            <button className="btn" onClick={check} style={{ marginLeft: 12 }}>
              Retry
            </button>
          )}
        </div>
      </Shell>
    );
  if (gate === "setup")
    return (
      <Shell nav={<LogoutBtn />}>
        <Mfa forced onChange={check} />
      </Shell>
    );
  const T = TABS[tab];
  return (
    <Shell nav={<LogoutBtn />}>
      <div className="tabs">
        {Object.keys(TABS).map((t) => (
          <button
            key={t}
            className={"btn sm" + (t === tab ? "" : " alt")}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <T key={tab} recheck={check} />
    </Shell>
  );
}
