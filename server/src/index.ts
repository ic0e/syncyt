import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBunWebSocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';

interface Room {
  users: Set<WSContext>;
  video: string;
  time: number;
  playing: boolean;
  lastUpdatedAt: number;
  messages: Array<{ username: string; message: string; timestamp: number }>;
  messagesSize: number;
}

const app = new Hono();
const { upgradeWebSocket, websocket } = createBunWebSocket();

app.use('*', cors());

const rooms = new Map<string, Room>();

app.post('/create', (c) => {
  const roomId = crypto.randomUUID().slice(0, 8);
  rooms.set(roomId, {
    users: new Set(),
    video: '',
    time: 0,
    playing: false,
    lastUpdatedAt: Date.now(),
    messages: [],
    messagesSize: 0,
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

        const elapsed = room.playing
          ? (Date.now() - room.lastUpdatedAt) / 1000
          : 0;

        // sync video state on join
        ws.send(
          JSON.stringify({
            action: 'sync',
            video: room.video,
            time: room.time + elapsed,
            playing: room.playing,
          })
        );

        // sync chat history on join
        ws.send(
            JSON.stringify({
              action: 'chat_history',
              messages: room.messages,
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
            room.lastUpdatedAt = Date.now();
          } else if (msg.action === 'play') {
            if (msg.time !== undefined) room.time = msg.time;
            room.playing = true;
            room.lastUpdatedAt = Date.now();
          } else if (msg.action === 'pause') {
            if (msg.time !== undefined) room.time = msg.time;
            room.playing = false;
            room.lastUpdatedAt = Date.now();
          } else if (msg.action === 'seek') {
            if (msg.time !== undefined) room.time = msg.time;
            room.lastUpdatedAt = Date.now();
          } else if (msg.action === 'chat') {
            console.log("chat message sent");
            
            const messageObj = {
              action: "chat",
              username: msg.username,
              message: msg.message,
              timestamp: msg.timestamp
            }

            const messageSize = JSON.stringify(messageObj).length;
            room.messages.push(messageObj);
            room.messagesSize += messageSize;
            
            const payload = JSON.stringify(messageObj);
            for (const user of room.users) {
              user.send(payload);
            }
            return;
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
