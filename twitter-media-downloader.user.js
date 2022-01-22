// ==UserScript==
// @name         Tweetdeck Media Downloader
// @namespace    https://github.com/FlandreDaisuki
// @description  Enjoy it.
// @version      0.4.2
// @author       FlandreDaisuki
// @match        https://tweetdeck.twitter.com/*
// @match        https://twitter.com/*
// @require      https://unpkg.com/sentinel-js@0.0.5/dist/sentinel.js
// @license      MIT
// @noframes
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==

const PORT = 10001;
const IMG_NAMING_PATTERN = '@{userId}-{twimgId}';

/* global sentinel */

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
🐦🖼️🔽-icon-background {
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

  sentinel.on('main', (mainEl) => {
    mainEl.appendChild(dialogEl);
    sentinel.off('main');
  });

  sentinel.on('article[role="article"] video', (videoEl) => {
    const articleEl = videoEl.closest('article');
    const tweetActionGroupEl = articleEl.querySelector('[role="group"]');
    tweetActionGroupEl.classList.add('min-width-full');
    const downloadBtnHTML = `
<div class="🐦📹🔽 css-1dbjc4n r-18u37iz r-1h0z5md">
  <div role="button" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
    <div dir="ltr" class="🐦📹🔽-text css-901oao r-1awozwy r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
      <div class="🐦📹🔽-icon css-1dbjc4n r-xoduu5">
        <div class="🐦📹🔽-icon-background css-1dbjc4n r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="🐦📹🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-1xvli5t r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1hdv0qi" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200"><path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path></svg>
      </div>
      <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-901oao css-16my406 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1e081e0 r-qvutc0">
            <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">下載</span>
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

  sentinel.on('article[role="article"] a[href*="/photo"] img', (imageEl) => {
    const articleEl = imageEl.closest('article');
    const photoCountInArticle = articleEl.querySelectorAll('a[href*="/photo"]').length;
    if (photoCountInArticle > 1) { return; }

    const tweetActionGroupEl = articleEl.querySelector('[role="group"]');
    tweetActionGroupEl.classList.add('min-width-full');
    const downloadBtnHTML = `
<div class="🐦📹🔽 css-1dbjc4n r-18u37iz r-1h0z5md">
  <div role="button" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
    <div dir="ltr" class="🐦📹🔽-text css-901oao r-1awozwy r-14j79pv r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
      <div class="🐦📹🔽-icon css-1dbjc4n r-xoduu5">
        <div class="🐦📹🔽-icon-background css-1dbjc4n r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="🐦📹🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-1xvli5t r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1hdv0qi" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200"><path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path></svg>
      </div>
      <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-901oao css-16my406 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1e081e0 r-qvutc0">
            <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">下載</span>
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

  sentinel.on('#layers [aria-modal][role="dialog"] [aria-label][role="group"]', (maybeDialogModelTweetActionGroupEl) => {
    const dialogModelEl = maybeDialogModelTweetActionGroupEl.closest('[aria-modal][role="dialog"]');
    if (!dialogModelEl) { return; }

    // 畫廊模式右邊的互動按鈕
    const articleEl = maybeDialogModelTweetActionGroupEl.closest('article[role="article"]');
    if (articleEl) { return; }


    const tweetActionGroupEl = maybeDialogModelTweetActionGroupEl;
    if (tweetActionGroupEl.querySelector('.🐦🖼️🔽')) { return; }

    const downloadBtnHTML = `
<div class="🐦🖼️🔽 css-1dbjc4n r-18u37iz r-1h0z5md">
  <div role="button" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-bt1l66 r-1ny4l3l r-bztko3 r-lrvibr">
    <div dir="ltr" class="🐦🖼️🔽-text css-901oao r-1awozwy r-jwli3a r-6koalj r-37j5jr r-a023e6 r-16dba41 r-1h0z5md r-rjixqe r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
      <div class="🐦🖼️🔽-icon css-1dbjc4n r-xoduu5">
        <div class="🐦🖼️🔽-icon-background css-1dbjc4n r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-1ny4l3l r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg"></div>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="🐦🖼️🔽-icon-svg iconify iconify--ph r-4qtqp9 r-yyyyoo r-50lct3 r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-1srniue" width="32" height="32" preserveAspectRatio="xMidYMid meet" viewBox="24 40 216 200"><path d="M80.3 115.7a8 8 0 0 1 11.4-11.3l28.3 28.3V40a8 8 0 0 1 16 0v92.7l28.3-28.3a8 8 0 0 1 11.4 11.3l-42 42a8.2 8.2 0 0 1-11.4 0zM216 144a8 8 0 0 0-8 8v56H48v-56a8 8 0 0 0-16 0v56a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16v-56a8 8 0 0 0-8-8z" fill="currentColor"></path></svg>
      </div>
      <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
        <span data-testid="app-text-transition-container" style="transform: translate3d(0px, 0px, 0px); transition-property: transform; transition-duration: 0.3s;">
          <span class="css-901oao css-16my406 r-poiln3 r-n6v787 r-1cwl3u0 r-1k6nrdp r-1e081e0 r-qvutc0">
            <span class="css-901oao css-16my406 r-poiln3 r-bcqeeo r-qvutc0">下載</span>
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
      const imageEl = theOnlySwipeEl.querySelector('img');
      downloadBtnEl.onclick = () => downloadImage(imageEl, location.href);
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

const TWEETDECK_STYLE_SHEET = `
html .med-tray.js-mediaembed {
  display: grid;
  grid-template-areas: "thumb thumb thumb" "link-vo link-dl link-fm";
}
html .med-tray.js-mediaembed > :first-child {
  grid-area: thumb;
  justify-self: center;
  margin-bottom: 25px !important;
}
html .med-origlink,
html .med-flaglink {
  position: relative !important;
}
html .med-origlink {
  grid-area: link-vo;
}
html .med-downloadlink {
  grid-area: link-dl;
}
html .med-flaglink {
  grid-area: link-fm;
}
#🐦💬 {
  position: fixed;
  top: 50%;
  z-index: 301;
}
.icon-download:before{
  content:"\\F186";
}
`;

if (hostname === 'tweetdeck.twitter.com') {
  injectStyleSheet(TWEETDECK_STYLE_SHEET);

  document.body.appendChild(dialogEl);

  sentinel.on('.med-origlink', (origlinkEl) => {
    const dialogModelEl = origlinkEl.closest('#open-modal');

    const a = document.createElement('a');
    a.className = 'med-downloadlink';
    a.textContent = 'Download';
    a.href = 'javascript:;';

    const mediaImg = dialogModelEl.querySelector('.media-img');
    if (mediaImg) {
      a.id = '🐦🖼️🔽';
      a.onclick = function clickToDownloadImage() {
        downloadImage(mediaImg, dialogModelEl.querySelector('time > a').href);
      };

      origlinkEl.insertAdjacentElement('afterend', a);
    }

    const mediaVideo = dialogModelEl.querySelector('.js-media-native-video');
    if (mediaVideo) {
      a.id = '🐦📹🔽';
      origlinkEl.insertAdjacentElement('afterend', a);
      a.onclick = () => {
        const href = dialogModelEl.querySelector('.tweet-timestamp a').href;
        if (href) {
          downloadVideo(href);
        } else {
          openDialog('找不到連結');
        }
      };
    }
  });

  sentinel.on('.js-media-preview-container.is-gif, .js-media-preview-container.is-video', (previewContainerEl) => {
    const articleEl = previewContainerEl.closest('article.stream-item');
    if (!articleEl) { return; }

    const tweetActionGroupEl = articleEl.querySelector('.js-tweet-actions');
    if (!tweetActionGroupEl) { return; }
    if (tweetActionGroupEl.querySelector('a[rel="download"]')) { return; }

    const downloadBtnHTML = `
<li class="tweet-action-item pull-left margin-r--10">
  <a class="tweet-action position-rel" href="javascript:;" rel="download">
    <i class="icon icon-download txt-center pull-left"></i>
    <span class="is-vishidden">Download</span>
    <span class="pull-right margin-l--2 margin-t--1 txt-size--12">下載</span>
  </a>
</li>`;

    const downloadBtnEl = getElByHTML(downloadBtnHTML);
    tweetActionGroupEl.insertAdjacentElement('afterbegin', downloadBtnEl);
    downloadBtnEl.onclick = () => {
      const href = articleEl.querySelector('.tweet-timestamp a')?.href;
      if (href) {
        downloadVideo(href);
      } else {
        openDialog('找不到連結');
      }
    };
  });
}
