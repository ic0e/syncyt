import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBunWebSocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';

interface Room {
  users: Set<WSContext>;
  video: string;
  time: number;
  playing: boolean;
}

const app = new Hono();
const { upgradeWebSocket, websocket } = createBunWebSocket();

// Apply CORS globally to allow fetch requests from frontend dev servers
app.use('*', cors());

const rooms = new Map<string, Room>();

app.post('/create', (c) => {
  const roomId = crypto.randomUUID().slice(0, 8);
  rooms.set(roomId, {
    users: new Set(),
    video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Valid default URL structure
    time: 0,
    playing: false,
  });
  return c.json({ roomId });
});

app.get(
  '/ws/:roomId',
  upgradeWebSocket((c) => {
    const roomId = c.req.param('roomId');
    const room = rooms.get(roomId as string);

    if (!room) {
      return {
        onOpen(_event, ws) {
          ws.send(JSON.stringify({ error: 'Room not found' }));
          ws.close(1008, 'Room not found');
        },
      };
    }

    return {
      onOpen(_event, ws) {
        room.users.add(ws);

        ws.send(
          JSON.stringify({
            action: 'sync',
            video: room.video,
            time: room.time,
            playing: room.playing,
          })
        );
      },

      onMessage(event, ws) {
        try {
          const rawData =
            typeof event.data === 'string'
              ? event.data
              : new TextDecoder().decode(event.data as ArrayBuffer);
          const msg = JSON.parse(rawData);

          if (msg.action === 'video') {
            room.video = msg.url;
            room.time = 0;
            room.playing = false;
          } else if (msg.action === 'play') {
            if (msg.time !== undefined) room.time = msg.time;
            room.playing = true;
          } else if (msg.action === 'pause') {
            if (msg.time !== undefined) room.time = msg.time;
            room.playing = false;
          } else if (msg.action === 'seek') {
            if (msg.time !== undefined) room.time = msg.time;
          }

          const payload = JSON.stringify(msg);
          for (const user of room.users) {
            if (user !== ws) {
              user.send(payload);
            }
          }
        } catch (err) {
          console.error('Invalid JSON message received:', err);
        }
      },

      onClose(_event, ws) {
        room.users.delete(ws);

        if (room.users.size === 0) {
          rooms.delete(roomId as string);
        }
      },
    };
  })
);

export default {
  fetch: app.fetch,
  websocket,
};
