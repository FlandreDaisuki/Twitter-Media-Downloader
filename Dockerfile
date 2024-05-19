FROM node:20-alpine

RUN apk add --no-cache tzdata python3 \
    && mkdir -p /app \
    && apk add --virtual build-deps curl \
    && curl -sL -o /usr/bin/yt-dlp 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp' \
    && chmod +x /usr/bin/yt-dlp \
    && apk del build-deps

COPY server.mjs twitter-media-downloader.user.js /app/

RUN chmod +x /app/server.mjs

WORKDIR /app

EXPOSE 10001

CMD [ "/app/server.mjs" ]
