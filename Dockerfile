ARG ALPINE_TAG=3.23.2

FROM alpine:${ALPINE_TAG}

ENV YT_DLP_VER=2025.12.08

RUN apk add --no-cache tzdata python3 ffmpeg \
    && mkdir -p /app \
    && apk add --virtual build-deps curl \
    && curl -sL -o /usr/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VER}/yt-dlp" \
    && chmod +x /usr/bin/yt-dlp \
    && apk del build-deps

COPY server.py twitter-media-downloader.user.js /app/

RUN chmod +x /app/server.py

WORKDIR /app

EXPOSE 10001

# https://stackoverflow.com/a/31796350
ENV PYTHONUNBUFFERED=1

CMD [ "/app/server.py" ]
