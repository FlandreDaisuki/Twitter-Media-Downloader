#!/bin/bash

PORT="${PORT:-10001}"

if [ -z "${VIDEO_NAMING_PATTERN}" ]; then
  VIDEO_NAMING_PATTERN='{userId}@twitter-{tweetId}'
fi

DOWNLOAD_PATH="${1}"
if [ -z "${DOWNLOAD_PATH}" ]; then
  echo >&2 "no download path"
  echo "usage: ${0} <download_path>"
  exit 1
fi

docker run -d \
  --name twitter-media-downloader \
  --restart unless-stopped \
  -p "10001:${PORT}" \
  -v "$(realpath "${DOWNLOAD_PATH}"):/download" \
  -e "TZ=${TZ:-Asia/Taipei}" \
  -e "LANG=${LANG:-zh_TW.UTF-8}" \
  -e "PORT=${PORT}" \
  -e "VIDEO_NAMING_PATTERN=${VIDEO_NAMING_PATTERN}" \
  ghcr.io/flandredaisuki/twitter-media-downloader:latest
