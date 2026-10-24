// HUD: the decorative side panel (rings + scrolling log) shown next to login-style forms.
const LOG = [
  "> SYNC ........ OK",
  "> HANDSHAKE ... OK",
  "> ENCRYPT ..... AES",
  "> NODE ........ 0x4D41",
  "> LATENCY ..... LOW",
  "> CHANNEL ..... SECURE",
  "> SIGNAL ...... 100%",
  "> UPLINK ...... READY",
];
function Hud({ jp, tag, children }) {
  return (
    <div className="hud-wrap">
      <aside className="hud-side" aria-hidden="true">
        <div className="hud-top">
          <span className="hud-dot" /> {tag}
        </div>
        <div className="hud-rings">
          <i className="r1" />
          <i className="r2" />
          <i className="r3" />
          <b lang="ja">{jp}</b>
        </div>
        <div className="hud-log">
          <div>
            {[...LOG, ...LOG].map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        </div>
        <span className="hud-corner tl" />
        <span className="hud-corner br" />
      </aside>
      <div className="hud-body">{children}</div>
    </div>
  );
}
export default Hud;
