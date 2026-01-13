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
// @connect      __USERSCRIPT_HOST_NAME__
// ==/UserScript==

const PORT = __USERSCRIPT_PORT__;
const IMG_NAMING_PATTERN = __USERSCRIPT_IMAGE_NAMING_PATTERN__;
const WATERFALL_IMAGE_NAMING_PATTERN = __USERSCRIPT_WATERFALL_IMAGE_NAMING_PATTERN__;

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

const dialogEl = document.createElement('dialog');
dialogEl.id = '🐦💬';

const openDialog = (content, timeout = 3000) => {
  dialogEl.textContent = content;
  dialogEl.show();
  setTimeout(() => { dialogEl.close(); }, timeout);
};

const requestDownloadVideo = async(currentUrl) => {
  try {
    const u = new URL(`${SERVER_ORIGIN}/download`);
    u.searchParams.set('type', 'video');
    u.searchParams.set('url', currentUrl);
    const resp = await GM_fetch(u.href);
    const result = JSON.parse(resp.responseText);
    if (result.ok) {
      openDialog('已成功下載 ' + result.dest);
      console.log('已成功下載', result.dest);
    } else {
      openDialog('下載失敗');
      console.error('下載失敗', result.reason);
    }
  } catch (err) {
    console.error(err);
  }
};

const requestDownloadWaterfallImages = async(imageIds, tweetURL) => {
  try {
    const u = new URL(`${SERVER_ORIGIN}/download`);
    u.searchParams.set('type', 'waterfall-image');
    u.searchParams.set('url', tweetURL);
    for (const imageId of imageIds) {
      u.searchParams.append('image', imageId);
    }

    const [userId, tweetId] = [...tweetURL.matchAll(/.*\/(.*)\/status\/(\d+)(?:\/(?:video|photo)\/(\d+))?/g)][0].slice(1);
    const filename = WATERFALL_IMAGE_NAMING_PATTERN
      .replace('{userId}', userId)
      .replace('{tweetId}', tweetId)
      .concat('.jpg');

    GM_download(u.href, filename);
  } catch (err) {
    console.error(err);
  }
};

const downloadImage = (imgEl, tweetURL) => {
  const twimgURL = (() => {
    const url = new URL(imgEl.src);
    url.searchParams.set('name', 'orig');
    return url;
  })();
  const twimgId = twimgURL.pathname.replace('/media/', '');
  const [userId, tweetId, imgOrdinal] = [...tweetURL.matchAll(/.*\/(.*)\/status\/(\d+)(?:\/(?:video|photo)\/(\d+))?/g)][0].slice(1);
  const filename = IMG_NAMING_PATTERN
    .replace('{twimgId}', twimgId)
    .replace('{userId}', userId)
    .replace('{tweetId}', tweetId)
    .replace('{imgOrdinal}', imgOrdinal)
    .concat(`.${twimgURL.searchParams.get('format')}`);

  console.info('下載圖片：', `${filename}`, `${twimgURL}`);
  GM_download(`${twimgURL}`, `${filename}`);
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

#🐦💬 {
  position: fixed;
  top: 50%;
  z-index: 301;
  padding: 1rem;
  border-radius: 1rem;
  border-width: 1px;
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

winkblue.on('body', (mainEl) => {
  mainEl.appendChild(dialogEl);
  winkblue.off('body');
});

// tweet with the only video
winkblue.on('article[role="article"]:has(video)', (articleEl) => {
  if(articleEl.querySelectorAll('video').length !== 1) { return; }
  if(articleEl.querySelectorAll('a[href*="/photo"]:not([href$="/media_tags"])').length > 0) { return; }

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
    const href = articleEl.querySelector('a[aria-label]')?.href ??
      articleEl.querySelector('[dir="auto"] > a:not([target])')?.href;
    if (href) {
      requestDownloadVideo(href);
    } else {
      openDialog('找不到連結');
    }
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
    downloadImage(imageEl, linkEl.href);
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
    requestDownloadWaterfallImages(imageIds, tweetLinkEl.href);
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

      const imageEl = theOnlySwipeEl.querySelector('img');
       if(imageEl) {
        return downloadImage(imageEl, location.href);
      }
      const videoEl = theOnlySwipeEl.querySelector('video');
      if(videoEl) {
        return requestDownloadVideo(location.href);
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
      const imageEl = imageListEl.children[currentIndex].querySelector('img');
      if(imageEl) {
        return downloadImage(imageEl, location.href);
      }
      const videoEl = imageListEl.children[currentIndex].querySelector('video');
      if(videoEl) {
        return requestDownloadVideo(location.href);
      }
    };
  }
});
