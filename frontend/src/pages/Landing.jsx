// LANDING PAGE: the public home screen (title, categories, login / sign-up buttons).
import { EVENT } from "../config.js";
import Shell from "../components/Shell.jsx";

const CATEGORIES = [
  "Steganography",
  "Forensics",
  "Web Exploitation",
  "OSINT",
  "Cryptography",
  "Reverse Engineering",
];

function Landing() {
  return (
    <Shell
      mainClass="landing-main"
      nav={
        <div className="landing-nav">
          <a href="#login">Participant login</a>
          <a href="#admin-login">Organizer portal</a>
        </div>
      }
    >
      <div className="landing-content">
        <section className="landing-hero">
          <div className="hero-rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <p className="type">
            <span className="status-light" /> [ CLASSIFIED ] // OPERATION: PARADOX
          </p>
          <h1>
            <span className="h1-main" data-text={EVENT}>
              {EVENT}
            </span>
            <span className="h1-jp" aria-hidden="true" lang="ja">
              電脳街の夜
            </span>
          </h1>
          <p>
            Every clue opens a new arc. Solve the challenge, capture the flag, and climb
            the ranks while the city never sleeps.
          </p>
          <div className="cta">
            <a className="btn" href="#signup">
              Create account <span aria-hidden="true">→</span>
            </a>
            <a className="btn alt" href="#login">
              Log in
            </a>
          </div>
          <ul className="landing-cats" aria-label="Challenge categories">
            {CATEGORIES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
        <section className="landing-entries" aria-label="Choose your portal">
          <a className="landing-entry" href="#login">
            <span className="entry-index">01 / PLAYER</span>
            <h2>Participants</h2>
            <p>
              Register with the event form, then create your account using that same
              email.
            </p>
            <span className="entry-action">
              Enter the arena <span aria-hidden="true">↗</span>
            </span>
          </a>
          <a className="landing-entry organizer" href="#admin-login">
            <span className="entry-index">02 / ORGANIZER</span>
            <h2>Organizers</h2>
            <p>Manage participants, challenges, and the scoreboard.</p>
            <span className="entry-action">
              Organizer login <span aria-hidden="true">↗</span>
            </span>
          </a>
        </section>
        <div className="landing-mantra" aria-label="CTF values">
          <span>THINK SHARP</span>
          <i aria-hidden="true">✦</i>
          <span>PLAY FAIR</span>
          <i aria-hidden="true">✦</i>
          <span>CAPTURE THE FLAG</span>
        </div>
      </div>
    </Shell>
  );
}
export default Landing;
