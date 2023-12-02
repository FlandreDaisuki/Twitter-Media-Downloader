// ==UserScript==
// @name         Tweetdeck Media Downloader
// @namespace    https://github.com/FlandreDaisuki
// @description  Enjoy it.
// @version      0.5.0
// @author       FlandreDaisuki
// @match        https://twitter.com/*
// @require      https://unpkg.com/winkblue@0.0.3/dist/winkblue.js
// @license      MIT
// @noframes
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

const PORT = 10001;
const IMG_NAMING_PATTERN = '@{userId}-{twimgId}';

/* global winkblue */
/* cSpell:ignore winkblue */

const SERVER_ORIGIN = `http://127.0.0.1:${PORT}`;
const { hostname } = location;

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
  dialogEl.setAttribute('open', 'open');
  setTimeout(function dialogAutoClose() {
    dialogEl.removeAttribute('open');
  }, timeout);
};

const downloadVideo = async(href) => {
  const resp = await GM_fetch(`${SERVER_ORIGIN}/?${href}`).catch(console.error);
  const result = JSON.parse(resp.responseText);
  if (result.ok) {
    openDialog('已成功下載 ' + result.dest);
    console.log('已成功下載', result.dest);
  } else {
    openDialog('下載失敗');
    console.error('下載失敗', result.reason);
  }
};

const downloadImage = (imgEl, tweetURL) => {
  const twimgURL = ((src) => {
    const url = new URL(src);
    url.searchParams.set('name', 'orig');
    return url;
  })(imgEl.src);
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
#🐦💬 {
  position: fixed;
  top: 50%;
  z-index: 301;
}
.min-width-full {
  min-width: 100%;
}
.🐦📹🔽 {
  justify-content: flex-end;
}
.🐦📹🔽-text {
  color: var(--🐦-text-color);
}
.🐦📹🔽:hover .🐦📹🔽-text {
  color: rgb(0, 200, 200);
}
.🐦📹🔽-icon-background {
  background-color: rgba(0, 0, 0, 0);
}
.🐦📹🔽:hover .🐦📹🔽-icon-background {
  background-color: rgba(0, 200, 200, 0.1);
}
.🐦🖼️🔽-icon-background {
  background-color: rgba(0, 0, 0, 0);
}
.🐦🖼️🔽:hover .🐦🖼️🔽-icon-background {
  background-color: rgba(255, 255, 255, 0.1);
}
`;

if (hostname === 'twitter.com') {
  const isDarkMode = document.body.style.backgroundColor === 'rgb(21, 32, 43)';
  if (isDarkMode) {
    injectStyleSheet(`
    :root {
      --🐦-text-color: rgb(136, 153, 166);
    } ${TWITTER_STYLE_SHEET}`);
  } else {
    injectStyleSheet(`
    :root {
      --🐦-text-color: rgb(83, 100, 113);
    } ${TWITTER_STYLE_SHEET}`);
  }

  winkblue.on('main', (mainEl) => {
    mainEl.appendChild(dialogEl);
    winkblue.off('main');
  });

  winkblue.on('article[role="article"] video', (videoEl) => {
    const articleEl = videoEl.closest('article');
    const tweetActionGroupEl = articleEl.querySelector('[role="group"]');
    tweetActionGroupEl.classList.add('min-width-full');
    const downloadBtnHTML = `
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
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1pn2ns4" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div>`;

    const downloadBtnEl = getElByHTML(downloadBtnHTML);
    tweetActionGroupEl.appendChild(downloadBtnEl);
    downloadBtnEl.onclick = () => {
      const href = articleEl.querySelector('a[aria-label]')?.href ??
        articleEl.querySelector('[dir="auto"] > a:not([target])')?.href;
      if (href) {
        downloadVideo(href);
      } else {
        openDialog('找不到連結');
      }
    };
  });

  winkblue.on('article[role="article"] a[href*="/photo"] img', (imageEl) => {
    const articleEl = imageEl.closest('article');
    const photoCountInArticle = articleEl.querySelectorAll('a[href*="/photo"]').length;
    if (photoCountInArticle > 1) { return; }

    const tweetActionGroupEl = articleEl.querySelector('[role="group"]');
    tweetActionGroupEl.classList.add('min-width-full');
    const downloadBtnHTML = `
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
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1pn2ns4" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div>`;

    const downloadBtnEl = getElByHTML(downloadBtnHTML);
    tweetActionGroupEl.appendChild(downloadBtnEl);

    downloadBtnEl.onclick = () => {
      const href = articleEl.querySelector('a[aria-label]')?.href ??
        articleEl.querySelector('[dir="auto"] > a:not([target])')?.href;
      if (href) {
        downloadImage(imageEl, href);
      } else {
        openDialog('找不到連結');
      }
    };
  });

  winkblue.on('#layers [aria-modal][role="dialog"] [aria-label][role="group"]', (maybeDialogModelTweetActionGroupEl) => {
    const dialogModelEl = maybeDialogModelTweetActionGroupEl.closest('[aria-modal][role="dialog"]');
    if (!dialogModelEl) { return; }

    // 畫廊模式右邊的互動按鈕
    const articleEl = maybeDialogModelTweetActionGroupEl.closest('article[role="article"]');
    if (articleEl) { return; }


    const tweetActionGroupEl = maybeDialogModelTweetActionGroupEl;
    if (tweetActionGroupEl.querySelector('.🐦🖼️🔽')) { return; }

    const downloadBtnHTML = `
<div class="🐦🖼️🔽 css-175oi2r r-18u37iz r-1h0z5md">
  <div role="button" tabindex="0" class="css-175oi2r r-1777fci r-bt1l66 r-bztko3 r-lrvibr r-1loqt21 r-1ny4l3l">
    <div dir="ltr" class="🐦🖼️🔽-text css-1rynq56 r-bcqeeo r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-1awozwy r-6koalj r-1h0z5md r-o7ynqc r-clp7b1 r-3s2u2q">
      <div class="🐦🖼️🔽-icon css-175oi2r r-xoduu5">
        <div class="🐦🖼️🔽-icon-background css-175oi2r r-xoduu5 r-1p0dtai r-1d2f490 r-u8s1d r-zchlnj r-ipm5af r-1niwhzg r-sdzlij r-xf4iuw r-o7ynqc r-6416eg r-1ny4l3l"></div>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="🐦🖼️🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-50lct3 r-1srniue" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200"><path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path></svg>
      </div>
      <div class="css-175oi2r r-xoduu5 r-1udh08x">
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-1qaijid r-qvutc0 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1pn2ns4" style="text-overflow: unset;">
            <span class="css-1qaijid r-bcqeeo r-qvutc0 r-poiln3" style="text-overflow: unset;">下載</span>
          </span>
        </span>
      </div>
    </div>
  </div>
</div>`;

    const downloadBtnEl = getElByHTML(downloadBtnHTML);
    tweetActionGroupEl.appendChild(downloadBtnEl);

    const swipeEls = dialogModelEl.querySelectorAll('[data-testid="swipe-to-dismiss"]');
    if (swipeEls.length === 1) {
      const theOnlySwipeEl = swipeEls[0];
      downloadBtnEl.onclick = (event) => {
        event.stopPropagation();

        const imageEl = theOnlySwipeEl.querySelector('img');
        downloadImage(imageEl, location.href);
      };
    } else {
      downloadBtnEl.onclick = (event) => {
        event.stopPropagation();
        const imageListEl = swipeEls[0].closest('ul');

        const transformString = imageListEl.style.transform; // "translate3d(-1234px, 0px, 0px)"
        const widthString = imageListEl.style.width; // "3702px"

        const transformOffset = parseFloat(transformString.replace(/translate3d\(([.-\d]+)px.*/, '$1'));
        const width = parseFloat(widthString.replace(/[^\d]/g, ''));

        const unitOffset = width / imageListEl.children.length;
        const currentIndex = Math.abs(Math.round(transformOffset / unitOffset));
        const imageEl = imageListEl.children[currentIndex].querySelector('img');

        downloadImage(imageEl, location.href);
      };
    }
  });
}
