// PROGRESS RING: small circular "% solved" graphic.
const Ring = ({ pct }) => (
  <svg
    viewBox="0 0 90 90"
    className="d-ring"
    role="img"
    aria-label={pct + "% complete"}
  >
    <circle cx="45" cy="45" r="36" className="d-ring-bg" />
    <circle
      cx="45"
      cy="45"
      r="36"
      className="d-ring-fg"
      strokeDasharray={`${pct * 2.262} 226.2`}
      transform="rotate(-90 45 45)"
    />
    <text x="45" y="50" textAnchor="middle" className="d-ring-t">
      {pct}%
    </text>
  </svg>
);

export default Ring;
