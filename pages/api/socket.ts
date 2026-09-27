import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Socket.IO attachment point (AGENTS.md trap 2). The first client request attaches.
 * The initializer dynamic-imports the app-server modules so their "server-only"
 * guards evaluate in the right bundle (pages/api dev chunks misclassify them).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { ensureSocketServer } = (await import("@/lib/server/socketServer")) as {
      ensureSocketServer: (res: unknown) => void;
    };
    ensureSocketServer(req.socket ? { socket: req.socket } : (res as unknown as never));
    res.status(200).json({ ok: true, mode: "socketio" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "attach failed";
    res.status(500).json({ error: message });
  }
}

export const config = {
  api: { bodyParser: true },
};
