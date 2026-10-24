// DATABASE: connection, tiny query helpers, and the table definitions (created on start-up).
//   q("select ...", [params])  -> returns rows
//   cfg("key") / setCfg("key", value) -> small key/value settings stored in the admin_cfg table
const { Pool } = require("pg");
const { E, PROD } = require("./env");
const { sha } = require("./helpers");
const { DEFAULT_FLAG } = require("./settings");

const db = new Pool({
  connectionString: E.DATABASE_URL,
  ssl: PROD ? { rejectUnauthorized: true } : undefined,
});
const q = async (s, p = []) => (await db.query(s, p)).rows;

const cfg = async (k) =>
  (await q("select value from admin_cfg where key=$1", [k]))[0]?.value;
const setCfg = (k, v) =>
  q(
    "insert into admin_cfg(key,value) values($1,$2) on conflict(key) do update set value=$2",
    [k, String(v)],
  );

/* ---------- schema ---------- */
async function init() {
  await db.query(`
 create table if not exists approved(email text primary key,team_key text not null,team_name text not null,leader_name text not null,leader_email text not null,members jsonb not null,size int not null,created timestamptz default now());
 create table if not exists users(email text primary key references approved(email) on delete cascade,hash text not null,created timestamptz default now(),password_updated timestamptz default now(),failed int default 0,failed_since timestamptz,locked_until timestamptz,reset_hash text,reset_expires timestamptz);
 alter table users add column if not exists failed_since timestamptz;
 alter table users add column if not exists session_version int not null default 0;
 create table if not exists admin_cfg(key text primary key,value text);
 create table if not exists flag_locks(team_key text primary key,until timestamptz not null);
 create table if not exists pw_log(id serial primary key,email text,kind text,ts timestamptz default now());
 create table if not exists challenges(id serial primary key,title text,category text,difficulty text,points int,description text,flag_hash text,link text,enabled bool default true,hidden bool default false,deleted bool default false,created timestamptz default now());
 alter table challenges add column if not exists link text;
 create table if not exists files(id serial primary key,challenge_id int references challenges(id),name text,mime text,size int,data bytea);
 create table if not exists solves(team_key text,challenge_id int,points int,by_email text,ts timestamptz default now(),primary key(team_key,challenge_id));
 create table if not exists submissions(id serial primary key,team_key text,challenge_id int,flag text,correct bool,points int,ip text,by_email text,ts timestamptz default now());
 create index if not exists sub_team_ts on submissions(team_key,ts);`);
  if (!(await q("select 1 from challenges limit 1")).length)
    await q(
      `insert into challenges(title,category,difficulty,points,description,flag_hash) values('Welcome Flag','Miscellaneous','Easy',50,'Demo challenge. Submit the default flag to test scoring.',$1)`,
      [sha(DEFAULT_FLAG).toString("hex")],
    );
}

// Leaderboard: every team with its total points (used by the participant and admin pages).
const board = () =>
  q(
    `select a.team_key,a.team_name,coalesce(sum(s.points),0)::int pts,max(s.ts) last from (select distinct team_key,team_name from approved) a left join solves s on s.team_key=a.team_key group by a.team_key,a.team_name order by pts desc,last asc nulls last,a.team_name`,
  );

module.exports = { db, q, cfg, setCfg, init, board };
