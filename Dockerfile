ARG ALPINE_TAG=3.23.2

FROM alpine:${ALPINE_TAG}

ENV YT_DLP_VER=2025.12.08

RUN apk --no-cache add \
      curl \
      ffmpeg \
      imagemagick \
      imagemagick-jpeg \
      python3 \
      tzdata \
    && mkdir -p /app \
    && curl -sL -o /usr/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VER}/yt-dlp" \
    && chmod +x /usr/bin/yt-dlp

COPY server.py twitter-media-downloader.user.js /app/

RUN chmod +x /app/server.py

WORKDIR /app

ENV PORT=10001

EXPOSE "${PORT}"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# https://stackoverflow.com/a/31796350
ENV PYTHONUNBUFFERED=1

CMD [ "/app/server.py" ]
