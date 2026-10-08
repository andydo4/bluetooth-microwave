FROM node:22-slim

# yt-dlp standalone binary (bundles its YouTube helper scripts; uses this image's Node as its JS runtime)
ADD --chmod=755 https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000
# YouTube breaks yt-dlp often; self-update on every boot keeps it working.
CMD ["sh", "-c", "yt-dlp -U || true; npm start"]
