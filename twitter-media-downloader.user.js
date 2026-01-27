// ==UserScript==
// @name         Twitter Media Downloader
// @namespace    https://github.com/FlandreDaisuki/Twitter-Media-Downloader
// @description  Enjoy it.
// @version      __USERSCRIPT_VERSION__
// @author       FlandreDaisuki
// @match        https://x.com/*
// @require      https://unpkg.com/winkblue@0.1.0/dist/winkblue.umd.js
// @license      MIT
// @noframes
// @icon         https://abs.twimg.com/favicons/twitter.3.ico
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @sandbox      raw
// @connect      __USERSCRIPT_HOST_NAME__
// ==/UserScript==

const PORT = __USERSCRIPT_PORT__;
const VIDEO_NAMING_PATTERN = __USERSCRIPT_VIDEO_NAMING_PATTERN__;
const IMAGE_NAMING_PATTERN = __USERSCRIPT_IMAGE_NAMING_PATTERN__;
const COLLAGE_NAMING_PATTERN = __USERSCRIPT_COLLAGE_NAMING_PATTERN__;

/* global Winkblue */

const SERVER_ORIGIN = `http://__USERSCRIPT_HOST_NAME__:${PORT}`;

const getElByHTML = (html) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el.firstElementChild;
};
const injectStyleSheet = (styleSheet) => {
  const styleEl = document.createElement('style');
  styleEl.textContent = styleSheet;
  document.body.appendChild(styleEl);
};

const GM_fetch = (url, details = {}) => {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      ...details,
      onload: resolve,
      onabort: reject,
      onerror: reject,
      ontimeout: reject,
    });
  });
};

const notifDialogEl = document.createElement('dialog');
notifDialogEl.id = '🐦💬';
document.body.appendChild(notifDialogEl);

const notify = (() => {
  const q = [];
  /**
   * @param {string} content
   * @param {number} [timeout=5000]
   */
  return (content, timeout = 5000) => {
    q.push(content);
    notifDialogEl.textContent = q.join('\n');
    notifDialogEl.show();

    setTimeout(() => {
      q.shift();
      if(q.length === 0) {
        notifDialogEl.close();
      }
    }, timeout);
  };
})();


const progressDialogEl = document.createElement('dialog');
progressDialogEl.id = '🐦⏳';
document.body.appendChild(progressDialogEl);


const updateProgressDialog = (() => {
  const dm = new Map();

  /**
   * @param {string} filename
   * @param {number} progress 0 ≦ v ≦ 100
   */
  return (filename, progress) => {
    if(progress === 100) {
      dm.delete(filename);
      notify(`${filename} 下載完成`);
    } else {
      dm.set(filename, progress);
    }

    if(dm.size === 0) {
      return progressDialogEl.close();
    }

    const L = Math.max(...Array.from(dm.keys()).map(s => s.length));

    progressDialogEl.textContent = Array.from(dm.entries())
      .map(([k, v]) => `${k.padStart(L, ' ')}: ${v}%`)
      .join('\n');
    progressDialogEl.show();
  };
})();

/** @param {HTMLElement} videoPlayerEl */
const extractVideoDownloadUrl = (videoPlayerEl) => {
  if (!videoPlayerEl) { return ''; }

  console.debug('videoPlayerEl', videoPlayerEl, Object.keys(videoPlayerEl));
  const pk = Object.keys(videoPlayerEl).find((k) => /^__reactProps[$]/.test(k));
  console.debug('videoPlayerEl::pk', pk);
  const source = videoPlayerEl?.[pk]?.children?._owner?.stateNode?.props?.source;
  if(!source) { return ''; }
  console.debug('extractVideoDownloadUrl::source', source);
  return String(source.downloadLink ?? Array.from(source.variants).at(-1)?.url ?? '');
}
unsafeWindow.extractVideoDownloadUrl = extractVideoDownloadUrl;

const parseTweetUrl = (tweetUrl) => {
  const u = new URL(tweetUrl);
  const pattern = /^[/](?<userId>[^/]+)[/]status[/](?<tweetId>\d+)(?:[/](?<mediaType>video|photo)[/](?<mediaOrdinal>\d+))?[/]?/;
  const matched = u.pathname.match(pattern);
  return {
    userId: matched?.groups?.userId ?? 'unknown-user',
    tweetId: matched?.groups?.tweetId ?? 'unknown-tweet',
    mediaType: matched?.groups?.mediaType ?? null,
    mediaOrdinal: matched?.groups?.mediaOrdinal ?? '1',
  }
};

/**
 * @param {string} tweetImageUrl
 * @example
 * https://pbs.twimg.com/media/G-aaaaBBBB12_45?format=jpg&name=small
 * https://pbs.twimg.com/amplify_video_thumb/2011376805664759808/img/pbj94TnbpOQqoipC.jpg?name=orig
 */
const parseTweetImageUrl = (tweetImageUrl) => {
  const u = new URL(tweetImageUrl);

  const pattern = /^[/]media[/](?<imgId>[^/]+)[/]?/;
  const matched = u.pathname.match(pattern);
  return {
    isVideoPoster: (/^[/]amplify_video_thumb/.test(u.pathname)),
    imgId: matched?.groups?.imgId ?? crypto.randomUUID(),
    format: u.searchParams.get('format') ?? 'jpg',
  }
};

/**
 * @param {string} tweetVideoUrl
 * @example
 * https://video.twimg.com/amplify_video/0000000000000000000/vid/avc1/1920x1080/gMq0wzNrNRX1heMO.mp4
 * https://video.twimg.com/amplify_video/0000000000000000000/vid/avc1/1920x1080/aDpM0BxqtoNzcWHe.mp4
 * https://video.twimg.com/amplify_video/0000000000000000000/vid/avc1/1920x1080/IMrqJjSSAVDKjU67.mp4
 * https://video.twimg.com/amplify_video/0000000000000000000/vid/avc1/1920x1080/xzvvOb43I-V3Kqv_.mp4
 */
const parseTweetVideoUrl = (tweetVideoUrl) => {
  const u = new URL(tweetVideoUrl);
  const pattern = /^[/]amplify_video[/](?<videoId>\d+)[/]vid[/](?<codec>[^/]+)[/](?<width>\d+)x(?<height>\d+)[/](?<videoHash>[^.]+)[.](?<ext>\w+)/;
  const matched = u.pathname.match(pattern);
  return {
    videoId: matched?.groups?.videoId ?? '0'.repeat(19),
    videoHash: matched?.groups?.videoHash ?? crypto.randomUUID().split('-')[0],
    ext: matched?.groups?.ext ?? 'mp4',
  }
};

const requestDownloadVideoTask = async(tweetUrl) => {
  try {
    const u = new URL(`${SERVER_ORIGIN}/api/tasks/create/video`);
    u.searchParams.set('url', tweetUrl);
    const taskResp = await GM_fetch(u.href)

    /** @type {{ok: boolean, task_id: number, filename: string}} */
    const tr = JSON.parse(taskResp.responseText);

    const v = new URL(`${SERVER_ORIGIN}/api/tasks/status`);
    v.searchParams.set('id', tr.task_id);
    if(tr.ok) {
      console.info('遠端處理＋下載影片：', tr.filename);
      const updateTaskProgress = async() => {
        const statusResp = await GM_fetch(v.href);

        /**
         * @typedef {'processing'|'completed'|'failed'} TaskStatus
         * @type {{ok: boolean, task: {id: number, result_file: string, status: TaskStatus, progress: number}}}
         */
        const sr = JSON.parse(statusResp.responseText);
        if(!sr.ok) {
          return notify(`${tr.filename} 下載失敗`);
        }

        updateProgressDialog(sr.task.result_file, sr.task.progress);
        if(sr.task.progress < 100 && sr.task.status === 'processing') {
          setTimeout(updateTaskProgress, 2000);
        }
      }
      updateTaskProgress();
    }
  } catch (err) {
    console.error(err);
  }
};


const downloadCollage = async(imageIds, tweetUrl) => {
  try {
    const u = new URL(`${SERVER_ORIGIN}/api/raw/collage`);
    u.searchParams.set('url', tweetUrl);
    for (const imageId of imageIds) {
      u.searchParams.append('image', imageId);
    }

    const tu = parseTweetUrl(tweetUrl);
    const filename = COLLAGE_NAMING_PATTERN
      .replace('{userId}', tu.userId)
      .replace('{tweetId}', tu.tweetId)
      .concat('.jpg');

    console.info('遠端處理＋下載縱長圖：', filename, imageIds);
    GM_download(u.href, filename);
  } catch (err) {
    console.error(err);
  }
};

/**
 * @param {string} imgSrc
 * @param {string} tweetUrl
 */
const downloadImage = (imgSrc, tweetUrl) => {
  const origImgSrc = (() => {
    const u = new URL(imgSrc);
    u.searchParams.set('name', 'orig');
    return u.href;
  })();
  const tiu = parseTweetImageUrl(origImgSrc)
  const tu = parseTweetUrl(tweetUrl);
  const filename = IMAGE_NAMING_PATTERN
    .replace('{imgId}', tiu.imgId)
    .replace('{userId}', tu.userId)
    .replace('{tweetId}', tu.tweetId)
    .replace('{mediaOrdinal}', tu.mediaOrdinal)
    .concat(`.${tiu.format}`);

  console.info('下載圖片：', filename, origImgSrc);
  GM_download(origImgSrc, filename);
};

const TWITTER_STYLE_SHEET = `
:root[data-theme="dark"] {
  --🐦-text-color: rgb(113, 118, 123);
  --🐦-text-color2: rgb(255, 255, 255);
  --🐦-hover-text-color-rgb: 0 200 200;
}
:root[data-theme="dim"] {
  --🐦-text-color: rgb(139, 152, 165);
  --🐦-text-color2: rgb(255, 255, 255);
  --🐦-hover-text-color-rgb: 0 200 200;
}
:root[data-theme="light"] {
  --🐦-text-color: rgb(83, 100, 113);
  --🐦-text-color2: rgb(255, 255, 255);
  --🐦-hover-text-color-rgb: 0 200 200;
}

dialog#🐦💬 {
  position: fixed;
  top: 50%;
  z-index: 301;
  padding: 1rem;
  border-radius: 1rem;
  border-width: 1px;
  font-size: 1.2rem;
  border: 3px solid white;
  white-space: pre-line;
}

dialog#🐦⏳ {
  position: fixed;
  left: 16px;
  bottom: 48px;
  z-index: 301;
  padding: 1rem;
  border-radius: 1rem;
  margin: 0;
  border: 1px solid white;
  white-space: pre-line;
  font-variant-numeric: tabular-nums;
}

.min-width-full {
  min-width: 100%;
}

.🐦📹🔽 {
  .🐦📹🔽-text {
    color: var(--🐦-text-color);
  }
  .🐦📹🔽-icon-background {
    background-color: rgba(0, 0, 0, 0);
  }
  &:hover {
    .🐦📹🔽-text {
      color: rgb(var(--🐦-hover-text-color-rgb));
    }
    .🐦📹🔽-icon-background {
      background-color: rgba(var(--🐦-hover-text-color-rgb) / 0.1);
    }
  }
}

.🐦🖼️🔽 {
  position: absolute;
  left: 6px;
  bottom: 6px;
  background-color: rgba(0, 0, 0, 0.9);
  border-radius: 50px;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 1px 1px white;

  .🐦🖼️🔽-text {
    color: var(--🐦-text-color2);
  }
  .🐦🖼️🔽-icon-svg {
    width: 0.8rem;
    height: 0.8rem;
    transform: translateX(1px);
  }
  .🐦🖼️🔽-icon-background {
    background-color: rgba(0, 0, 0, 0);
  }
  &:hover {
    .🐦🖼️🔽-text {
      color: rgb(var(--🐦-hover-text-color-rgb));
    }
    .🐦🖼️🔽-icon-background {
      background-color: rgba(var(--🐦-hover-text-color-rgb) / 0.1);
    }
  }
}

.🐦🎦🔽 {
  .🐦🎦🔽-text {
    color: var(--🐦-text-color2);
  }
  .🐦🎦🔽-icon-background {
    background-color: rgba(0, 0, 0, 0);
  }
  &:hover {
    .🐦🎦🔽-text {
      color: rgb(var(--🐦-hover-text-color-rgb));
    }
    .🐦🎦🔽-icon-background {
      background-color: rgba(var(--🐦-hover-text-color-rgb) / 0.1);
    }
  }
}


.🐦🖼️⬇️🔽 {
  flex: 1.2 1.2 0%;

  .🐦🖼️⬇️🔽-text {
    color: var(--🐦-text-color);
  }
  .🐦🖼️⬇️🔽-icon-background {
    background-color: rgba(0, 0, 0, 0);
  }
  &:hover {
    .🐦🖼️⬇️🔽-text {
      color: rgb(var(--🐦-hover-text-color-rgb));
    }
    .🐦🖼️⬇️🔽-icon-background {
      background-color: rgba(var(--🐦-hover-text-color-rgb) / 0.1);
    }
  }
}`;
injectStyleSheet(TWITTER_STYLE_SHEET);

const { winkblue } = Winkblue;

// Selector notes:
//   `article[role="article"]`: tweet, including reply tweets
//   `article[role="article"] div[id][aria-labelledby]`: tweet quoting block
//   `article[role="article"] [aria-label][role="group"]`: action group block of tweet
//   `article[role="article"] a[href*="/photo"]:not([href$="/media_tags"]) img`: tweet image attachment
//   `article[role="article"] a[href$="/media_tags"]`: tweet tag of image attachment
//   `#layers [aria-modal][role="dialog"]`: gallery dialog

// tweet has the only video
winkblue.on('article[role="article"]:has(video)', (articleEl) => {
  if(articleEl.querySelectorAll('video').length !== 1) { return; }
  if(articleEl.querySelectorAll(':scope:not(:has(div[id][aria-labelledby])) a[href*="/photo"]:not([href$="/media_tags"])').length > 0) { return; }

  const tweetActionGroupEl = articleEl.querySelector('[role="group"]');
  tweetActionGroupEl.children[3].insertAdjacentHTML('afterend', `
<div class="🐦📹🔽 css-175oi2r r-18u37iz r-1h0z5md r-13awgt0">
  <div role="button" tabindex="0" class="css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l">
    <div dir="ltr" class="🐦📹🔽-text css-1rynq56 r-bcqeeo r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q">
      <div class="🐦📹🔽-icon css-175oi2r r-xoduu5">
        <div class="🐦📹🔽-icon-background css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l"></div>
          <svg aria-hidden="true" class="🐦📹🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-50lct3 r-1srniue" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200">
            <path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path>
          </svg>
      </div>
      <div class="css-175oi2r r-xoduu5 r-1udh08x">
        <span data-testid="app-text-transition-container" style="transition-property: transform; transition-duration: 0.3s; transform: translate3d(0px, 0px, 0px);">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-s1qlax" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div>`);

  const downloadBtnEl = tweetActionGroupEl.querySelector('.🐦📹🔽');
  downloadBtnEl.onclick = () => {
    const tweetUrl = articleEl.querySelector('a[aria-label]')?.href ??
      articleEl.querySelector('[dir="auto"] > a:not([target])')?.href;

    requestDownloadVideoTask(tweetUrl);
  };
});


// premium user can reorder their image layout into waterfall layout
// const WATERFALL_LAYOUT_IMG_SELECTOR = 'article[role="article"] div[id]:not([aria-labelledby]) a[href*="/photo"]:not([href$="/media_tags"]) img';

// tweet has single picture, multiple pictures or mixed pictures and videos
winkblue.on('article[role="article"] div[id][aria-labelledby] a[href*="/photo"]:not([href$="/media_tags"]) img', (imageEl) => {
  const linkEl = imageEl.closest('a[href*="/photo"]');

  const downloadBtnHTML = `
<div class="🐦🖼️🔽 css-175oi2r r-18u37iz r-1h0z5md r-13awgt0">
  <div role="button" tabindex="0" class="css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l">
    <div dir="ltr" class="🐦🖼️🔽-text css-1rynq56 r-bcqeeo r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q">
      <div class="🐦🖼️🔽-icon css-175oi2r r-xoduu5">
        <div class="🐦🖼️🔽-icon-background css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l"></div>
          <svg aria-hidden="true" class="🐦🖼️🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-50lct3 r-1srniue" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200">
            <path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path>
          </svg>
      </div>

      <!--
      <div class="css-175oi2r r-xoduu5 r-1udh08x">
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1pn2ns4" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載</span>
          </span>
        </span>
      </div>
      -->

    </div>
  </div>
</div>`;

  const downloadBtnEl = getElByHTML(downloadBtnHTML);
  linkEl.appendChild(downloadBtnEl);

  downloadBtnEl.onclick = (e) => {
    e.preventDefault();
    downloadImage(imageEl.src, linkEl.href);
  };
});

// waterfall layout tweet
winkblue.on('main[role="main"] article[role="article"]:has(.css-175oi2r.r-6koalj.r-6gpygo.r-1s2bzr4 ~ .css-175oi2r.r-6koalj.r-6gpygo.r-1s2bzr4)', (articleEl) => {
  const tweetActionGroupEl = articleEl.querySelector('[aria-label][role="group"]');
  if (tweetActionGroupEl.querySelector('.🐦🖼️⬇️🔽')) { return; }

  tweetActionGroupEl.children[3].insertAdjacentHTML('afterend',`
<div class="🐦🖼️⬇️🔽 css-175oi2r r-18u37iz r-1h0z5md r-13awgt0">
  <div role="button" tabindex="0" class="css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l">
    <div dir="ltr" class="🐦🖼️⬇️🔽-text css-1rynq56 r-bcqeeo r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q" style="text-overflow: unset;">
      <div class="🐦🖼️⬇️🔽-icon css-175oi2r r-xoduu5">
        <div class="🐦🖼️⬇️🔽-icon-background css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l"></div>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="🐦🖼️⬇️🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-50lct3 r-1srniue" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200"><path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path></svg>
      </div>
      <div class="css-175oi2r r-xoduu5 r-1udh08x">
        <span style="transition-property: transform; transition-duration: 0.3s; transform: translate3d(0px, 0px, 0px);">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-s1qlax" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載縱長圖</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div>`);


  const downloadBtnEl = tweetActionGroupEl.querySelector('.🐦🖼️⬇️🔽');
  downloadBtnEl.onclick = (e) => {
    e.preventDefault();

    const tweetLinkEl = articleEl.querySelector('a[aria-describedby]');
    if(!tweetLinkEl) {
      return console.error('Can not find tweetLinkEl');
    }
    const imageEls = Array.from(articleEl.querySelectorAll('a[href*="/status/"][href*="/photo/"] img'));
    const imageIds = imageEls.map(imgEl => new URL(imgEl.src).pathname.replace('/media/', ''));
    downloadCollage(imageIds, tweetLinkEl.href);
  };
});

// gallery mode
winkblue.on('#layers [aria-modal][role="dialog"]:has([aria-label][role="group"]):has(article[role="article"])', (dialogModelEl) => {
  const tweetActionGroupEl = dialogModelEl.querySelector('[aria-label][role="group"]');
  if (tweetActionGroupEl.querySelector('.🐦🎦🔽')) { return; }

  tweetActionGroupEl.children[3].insertAdjacentHTML('afterend',`
<div class="🐦🎦🔽 css-175oi2r r-18u37iz r-1h0z5md r-13awgt0">
  <div role="button" tabindex="0" class="css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l">
    <div dir="ltr" class="🐦🎦🔽-text css-1rynq56 r-bcqeeo r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q" style="text-overflow: unset;">
      <div class="🐦🎦🔽-icon css-175oi2r r-xoduu5">
        <div class="🐦🎦🔽-icon-background css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l"></div>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="🐦🎦🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-50lct3 r-1srniue" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200"><path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path></svg>
      </div>
      <div class="css-175oi2r r-xoduu5 r-1udh08x">
        <span style="transition-property: transform; transition-duration: 0.3s; transform: translate3d(0px, 0px, 0px);">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-s1qlax" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div>`);
  const downloadBtnEl = tweetActionGroupEl.querySelector('.🐦🎦🔽');
  const swipeEls = dialogModelEl.querySelectorAll('[data-testid="swipe-to-dismiss"]');
  if (swipeEls.length === 1) {
    const theOnlySwipeEl = swipeEls[0];
    downloadBtnEl.onclick = (event) => {
      event.stopPropagation();

      const tu = parseTweetUrl(location.href);
      if (tu.mediaType === 'video') {
        requestDownloadVideoTask(location.href);
      } else if (tu.mediaType === 'photo') {
        const imageEl = theOnlySwipeEl.querySelector('img');
        if(imageEl) {
          return downloadImage(imageEl.src, location.href);
        }
      } else {
        notify('找不到連結');
      }
    };
  } else {
    downloadBtnEl.onclick = (event) => {
      event.stopPropagation();
      const imageListEl = swipeEls[0].closest('ul');

      const transformString = imageListEl.style.transform; // "translate3d(-1234px, 0px, 0px)"
      const widthString = imageListEl.style.width; // "3702px"

      const transformOffset = (new DOMMatrix(transformString)).m41;
      const width = parseFloat(widthString.replace(/[^\d]/g, ''));

      const unitOffset = width / imageListEl.children.length;
      const currentIndex = Math.abs(Math.round(transformOffset / unitOffset));
      const currentSlide = imageListEl.children[currentIndex];

      const tu = parseTweetUrl(location.href);
      if (tu.mediaType === 'video') {
        requestDownloadVideoTask(location.href);
      } else if (tu.mediaType === 'photo') {
        const imageEl = currentSlide.querySelector('img');
        if(imageEl) {
          return downloadImage(imageEl.src, location.href);
        }
      } else {
        notify('找不到連結');
      }
    };
  }
});
