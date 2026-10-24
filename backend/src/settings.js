// SETTINGS: the numbers and lists an organizer is most likely to change.
// Edit here, save, restart the server. No other file needs touching for these.
const { E } = require("./env");

/* ======== ORGANIZER CONFIG ======== */
const DEFAULT_FLAG = "P4R4DOXCTF{default_flag_here}"; // only seeds the demo challenge. Change real flags in Admin > Challenges.
const CATS = [
    "Steganography",
    "Forensics",
    "Web Exploitation",
    "OSINT",
    "Cryptography",
    "Miscellaneous",
    "Reverse Engineering",
  ],
  DIFFS = ["Easy", "Medium", "Hard"];

// ################################################################################################
// ##  FLAG-ENTRY LOCKOUT TIMER  <-- CHANGE THE NUMBERS HERE (or set the env vars on Render)       ##
// ##  Rule: if a team makes FLAG_MAX_TRIES attempts within FLAG_WINDOW_SEC seconds, that team     ##
// ##  cannot enter flags for FLAG_LOCK_SEC seconds. Default: 5 attempts in 15 s -> locked 120 s. ##
// ################################################################################################
const MAX_TRIES = Number(E.FLAG_MAX_TRIES) || 5; // attempts allowed inside the window
const WINDOW_SEC = Number(E.FLAG_WINDOW_SEC) || 15; // length of the window in seconds (120 = 2 minutes)
const LOCK_SEC = Number(E.FLAG_LOCK_SEC) || 120; // how long flag entry stays locked, in seconds
// ################################################################################################

const LOGIN_MAX_TRIES = 5,
  LOGIN_WINDOW_SEC = 15,
  LOGIN_LOCK_SEC = 120; // LOGIN TIMER
const ALLOWED_EXT = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "txt",
  "log",
  "zip",
  "pcap",
  "pcapng",
  "pdf",
  "csv",
  "json",
  "bin",
];

module.exports = {
  DEFAULT_FLAG,
  CATS,
  DIFFS,
  MAX_TRIES,
  WINDOW_SEC,
  LOCK_SEC,
  LOGIN_MAX_TRIES,
  LOGIN_WINDOW_SEC,
  LOGIN_LOCK_SEC,
  ALLOWED_EXT,
};
