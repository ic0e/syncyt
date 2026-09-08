FROM oven/bun:latest

WORKDIR /server

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
