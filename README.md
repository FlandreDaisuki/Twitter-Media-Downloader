# Twitter Media Downloader

- [Twitter Media Downloader](#twitter-media-downloader)
  - [Requirement](#requirement)
  - [Installation](#installation)
    - [Backend](#backend)
    - [Frontend](#frontend)
      - [The gapless style](#the-gapless-style)
  - [Customization](#customization)
  - [License](#license)

## Requirement

- Backend
  - Docker
- Frontend
  - [Tampermonkey](https://www.tampermonkey.net)
  - Browsers which can install Tampermonkey

## Installation

### Backend

```shell
$ git clone git@github.com:FlandreDaisuki/Twitter-Media-Downloader.git
$ cd Twitter-Media-Downloader

# Modify .env values
# The most important value is `DOWNLOAD_PATH`
# Please fill it with your host download directory in absolute path
$ mv .env.example .env

$ docker compose up -d
```

### Frontend

```shell
$ docker compose logs twitter-media-downloader
twitter-media-downloader  | Server running at http://0.0.0.0:10001/
twitter-media-downloader  |
twitter-media-downloader  | Usage:
twitter-media-downloader  |   Download userscript:
twitter-media-downloader  |     GET http://0.0.0.0:10001/twitter-media-downloader.user.js
twitter-media-downloader  |
twitter-media-downloader  |   Start an async downloading task by twitter video url:
twitter-media-downloader  |     GET http://0.0.0.0:10001/download?type=video&url=https://x.com/{userId}/status/{tweetId}
twitter-media-downloader  |
twitter-media-downloader  |   Start a waterfall image downloading task by imageId:
twitter-media-downloader  |     GET http://0.0.0.0:10001/download?type=waterfall-image&url=https://x.com/{userId}/status/{tweetId}&image={imageId}[...&image={imageId}]
twitter-media-downloader  |
twitter-media-downloader  |   Video Name:
twitter-media-downloader  |     {userId}@twitter-{tweetId}.mp4
twitter-media-downloader  |
twitter-media-downloader  |   Destination:
twitter-media-downloader  |     /tmp/twitter-downloaded
twitter-media-downloader  |
twitter-media-downloader  | Versions:
twitter-media-downloader  |   yt-dlp: 2025.12.08
twitter-media-downloader  |
```

Copy the userscript url to browser then it will trigger Tampermonkey installation.

#### The gapless style

You can also install the style to make waterfall layout images gapless.

[X Gapless Waterfall Images](https://github.com/FlandreDaisuki/stylus-usercss/blob/master/X%20Gapless%20Waterfall%20Images/README.md)

## Customization

If you are familiar with `yt-dlp`, you may want to pass other args. You can use `--` after `/app/server.py`.

e.g.

```yaml
services:
  twitter-media-downloader:
    image: ghcr.io/flandredaisuki/twitter-media-downloader
    container_name: twitter-media-downloader
    restart: unless-stopped
    ports:
      - "${PORT:-10001}:${PORT:-10001}"
    environment:
      - "TZ=${TZ}"
      - "PORT=${PORT:-10001}"
      - "LANG=${LANG}"
      - "VIDEO_NAMING_PATTERN=${VIDEO_NAMING_PATTERN}"
      - "IMAGE_NAMING_PATTERN=${IMAGE_NAMING_PATTERN}"
    volumes:
      - "${DOWNLOAD_PATH}:/download"
      - "/path/to/my/firefox/profile:/firefox-profile:ro"
    command: /app/server.py -- --cookies-from-browser firefox:/firefox-profile
```

## License

The MIT License (MIT)

Copyright (c) 2019-2026 FlandreDaisuki
