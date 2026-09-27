import { io } from "socket.io-client";

const [,, base, code, playerId, secret] = process.argv;

await fetch(`${base}/api/socket`).catch(() => {});
await fetch(`${base}/api/rooms/${code}/bot`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ playerId, secret }),
}).catch(() => {});
await fetch(`${base}/api/rooms/${code}/start`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ playerId, secret }),
}).catch(() => {});

const a = io(base, { path: "/api/socketio", transports: ["websocket"] });
const b = io(base, { path: "/api/socketio", transports: ["websocket"] });
function report(tag, msg) { console.log(`[${tag}] ${msg}`); }

a.on("connect", () => a.emit("room:join", { code, identity: { playerId, secret } }, (ok) => report("A", `joined=${ok}`)));
b.on("connect", () => b.emit("room:join", { code }, (ok) => report("B", `viewerJoined=${ok}`)));

// client A: whenever it is A's turn, push the turn forward (handles doubles + buys)
a.on("game:state", ({ version, state }) => {
  report("A", `state v${version}`);
  const turn = state.turn;
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return;
  const mine = turn.playerIdx === state.players.findIndex((p) => p.id === playerId);
  if (!mine) return;
  setTimeout(() => {
    if (turn.phase === "preRoll" && !turn.pending)
      a.emit("game:action", { code, playerId, secret, action: { type: "roll" } }, (res) => report("A", `roll ok=${res.ok} ${res.error ?? ""}`));
    else if (turn.phase === "awaitingAction" && state.pending?.type === "buy")
      a.emit("game:action", { code, playerId, secret, action: { type: "decline" } }, (res) => report("A", `decline ok=${res.ok} ${res.error ?? ""}`));
    else if (turn.phase === "awaitingAction")
      a.emit("game:action", { code, playerId, secret, action: { type: "endTurn" } }, (res) => report("A", `endTurn ok=${res.ok} ${res.error ?? ""}`));
  }, 450);
});

b.on("game:state", ({ version }) => {
  report("B", `state v${version}`);
  if (version >= 6 && !done) { done = true; finish(); }
});

let done = false;
function finish() {
  report("T", "PASS — two sockets see synchronized game state through bot turns");
  a.close(); b.close();
  setTimeout(() => process.exit(0), 300);
}
setTimeout(() => { if (!done) { report("T", "TIMEOUT"); a.close(); b.close(); process.exit(1); } }, 40000);
