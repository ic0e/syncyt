# sync-yt • [![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Bun](https://img.shields.io/badge/Bun-1.4+-f471b5?style=flat-square&logo=bun&logoColor=white)](https://bun.sh) [![Hono](https://img.shields.io/badge/Hono-4.0+-orange?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
Watch YouTube videos in real time with a customizeable live chat, no sign ups.

## Introduction

**sync-yt** is a tool for watching YouTube videos together in real time. Create a room, share the link, and everyone sees the same video at the same timestamp. Seeking syncs across all viewers. Chat is persistent per room and supports profile pictures via URL.

> *!! Early beta:* sync-yt is in early development, expect changes and new features.

## Features

### Real-time Synchronization
Play, pause, and seek events sync across viewers with WebSocket.

### Live Chat
Persistent messages with optional profile pictures (URL based).

### URL-based Rooms
No accounts or signups, share a link & join a room.

## Setup and Development

Clone the repository and install dependencies:

```bash
git clone https://github.com/ic0e/sync-yt
cd sync-yt
bun install
bun run dev
```

Frontend runs on `http://localhost:5173`. Backend (Hono) runs on `http://localhost:3000`.


## Known Limitations

- YouTube videos only.
- Chat and room state persist only while the server is running.
- No user accounts or permanent profiles.

## Roadmap

- Host and deploy
- Persistent database for chat history.
- User accounts and saved profiles.
- Support for other video platforms.

## License
This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
