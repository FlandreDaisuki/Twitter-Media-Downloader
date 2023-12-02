# Twitter Media Downloader

- [Twitter Media Downloader](#twitter-media-downloader)
  - [Requirement](#requirement)
  - [Installation](#installation)
    - [Backend](#backend)
    - [Frontend](#frontend)
  - [License](#license)

## Requirement

- Backend
  - Docker
- Frontend
  - Tampermonkey
  - Tampermonkey of supported browser

## Installation

### Backend

```shell
$ git clone git@github.com:FlandreDaisuki/Twitter-Media-Downloader.git
$ cd Twitter-Media-Downloader

$ ./run.sh ~/Downloads

# with options
$ PORT=20002 \
  VIDEO_NAMING_PATTERN='{tweetId}' \
  ./run.sh ~/Downloads
```

### Frontend

Close service worker at `*.twitter.com`:

1. Add following rules to uBlock Origin
   - `||twitter.com/push_service_worker.js$script,domain=twitter.com`
   - `||twitter.com/sw.js$script,domain=twitter.com`
2. Unregister service worker of twitter
   - Firefox:
      1. Go [about:serviceworkers](about:serviceworkers)
      2. Find `*.twitter.com` and unregister it
   - Chromium-based:
      1. Go [chrome://serviceworker-internals/](chrome://serviceworker-internals/)
      2. Find `*.twitter.com` and unregister it

Click [**here**](https://github.com/FlandreDaisuki/Twitter-Media-Downloader/raw/master/twitter-media-downloader.user.js) to install userscript after Tampermonkey has been installed.

Change the configuration of `twitter-media-downloader.user.js` to yours.

```javascript
/**
 - This value should correspond to
 - left hand side of "ports" you run in backend, default 10001
 */
const PORT = 10001;

/**
 - Pattern Placeholder:
 *
 - tweetURL:
 -   https://twitter.com/{userId}/status/{tweetId}/photo/{imgOrdinal}
 - twimgURL:
 -   https://pbs.twimg.com/media/{twimgId}?format=jpg&name=medium
 *
 - Example:
 *
 - https://twitter.com/sakipee36/status/1172804045368487936/photo/2
 - https://pbs.twimg.com/media/EEajDOtUEAAfM7e?format=jpg&name=medium
 */
const IMG_NAMING_PATTERN = '@{userId}-{twimgId}';
```

## License

The MIT License (MIT)

Copyright (c) 2019-2023 FlandreDaisuki
