// ==UserScript==
// @name         Twitter Media Downloader
// @namespace    https://github.com/FlandreDaisuki
// @description  Close service worker at twitter.com and enjoy it.
// @version      0.2.1
// @author       FlandreDaisuki
// @match        https://tweetdeck.twitter.com/
// @match        https://twitter.com/*
// @match        https://mobile.twitter.com/*
// @require      https://unpkg.com/sentinel-js@0.0.5/dist/sentinel.js
// @resource     dialog.css https://raw.githubusercontent.com/GoogleChrome/dialog-polyfill/master/dist/dialog-polyfill.css
// @license      MIT
// @noframes
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @connect      127.0.0.1
// ==/UserScript==

const PORT = 10001;
const IMG_NAMING_PATTERN = '@{userId}-{twimgId}';

/* global sentinel */

const SERVER_ORIGIN = `http://127.0.0.1:${PORT}`;

const TWITTER_CSS = `
.r-11yh6sk .r-184en5c > .r-1ftll1t {
  z-index: 1;
  background-color: rgba(0,0,0,0.5);
}`;

const TWEETDECK_CSS = `
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
}`;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const getImageURL = (src) => {
  const url = new URL(src);
  url.searchParams.set('name', 'orig');
  return url;
};

const applyStyle = (styleStr = '') => {
  const style = document.createElement('style');
  style.textContent = styleStr;
  document.head.appendChild(style);
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

const isBoundingRectShows = (el) => {
  const { x } = el.getBoundingClientRect();
  return x >= 0 && x <= window.innerWidth;
};

const downloadImage = (imgEl, tweetURL) => {
  const twimgURL = getImageURL(imgEl.src);
  const twimgId = twimgURL.pathname.replace('/media/', '');
  const [userId, tweetId, imgOrdinal] = [...tweetURL.matchAll(/.*\/(.*)\/status\/(\d+)(?:\/(?:video|photo)\/(\d+))?/)][0].slice(1);
  const filename = IMG_NAMING_PATTERN
    .replace('{twimgId}', twimgId)
    .replace('{userId}', userId)
    .replace('{tweetId}', tweetId)
    .replace('{imgOrdinal}', imgOrdinal)
    .concat(`.${twimgURL.searchParams.get('format')}`);

  console.info('下載圖片：', `${filename}`, `${twimgURL}`);
  GM_download(`${twimgURL}`, `${filename}`);
};

// Entry Point
if (location.host === 'twitter.com' || location.host === 'mobile.twitter.com') {
  applyStyle(TWITTER_CSS);
  applyStyle(GM_getResourceText('dialog.css'));
  twitterImageSetup();
  twitterVideoSetup();
}
else if (location.host === 'tweetdeck.twitter.com') {
  applyStyle(TWEETDECK_CSS);
  tweetdeckSetup();
}

function twitterImageSetup() {
  const carouselTrigger = () => {
    const el = document.createElement('div');
    el.id = 'carousel-trigger';
    document.body.appendChild(el);
    setTimeout(() => {
      document.body.removeChild(el);
    }, 1000);
  };

  const createCarouselPhotoDownloadBtn = () => {
    const root = document.createElement('div');
    root.id = 'TMD-carousel-photo-download-btn';
    root.className = 'css-1dbjc4n r-18u37iz r-16y2uox r-1h0z5md';
    root.innerHTML = `
<div role="button" data-focusable="true" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-11cpok1 r-1ny4l3l r-bztko3 r-lrvibr">
  <div dir="ltr" class="css-901oao r-1awozwy r-jwli3a r-6koalj r-1qd0xha r-a023e6 r-16dba41 r-1h0z5md r-ad9z0x r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
    <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
      <span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x r-1n0xq6e r-bcqeeo r-d3hbe1 r-1wgg2b2 r-axxi2z r-qvutc0">
        <span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x r-bcqeeo r-qvutc0">下載圖片</span>
      </span>
    </div>
  </div>
</div>`;

    root.addEventListener('click', (ev) => {
      ev.stopPropagation();
      $$('.r-11yh6sk.r-buy8e9 img.css-9pa8cd')
        .filter(isBoundingRectShows)
        .map((imgEl) => downloadImage(imgEl, location.href));
    });
    return root;
  };

  const createCarouselVideoDownloadBtn = (isGif) => {
    const root = document.createElement('div');
    root.id = 'TMD-carousel-video-download-btn';
    root.className = 'css-1dbjc4n r-18u37iz r-16y2uox r-1h0z5md';
    root.innerHTML = `
<div role="button" data-focusable="true" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-11cpok1 r-1ny4l3l r-bztko3 r-lrvibr">
  <div dir="ltr" class="css-901oao r-1awozwy r-jwli3a r-6koalj r-1qd0xha r-a023e6 r-16dba41 r-1h0z5md r-ad9z0x r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
    <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
      <span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x r-1n0xq6e r-bcqeeo r-d3hbe1 r-1wgg2b2 r-axxi2z r-qvutc0">
        <span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x r-bcqeeo r-qvutc0">下載${isGif ? ' GIF 影片' : '影片'}</span>
      </span>
    </div>
  </div>
</div>`;

    root.addEventListener('click', async() => {
      const href = location.href.replace(/\/(video|photo)\/.*/, '');
      const resp = await GM_fetch(`${SERVER_ORIGIN}/_?${href}`).catch(console.error);
      const result = JSON.parse(resp.responseText);
      if (result.ok) {
        console.log('已成功下載');
      }
      else {
        console.error('下載失敗', result.reason);
      }
    });
    return root;
  };

  sentinel.on('.r-g6jmlv', (carouselRoot) => {
    console.info('大圖展示開啟！', carouselRoot);
  });

  sentinel.on('.r-g6jmlv [role="group"]', (groupRoot) => {
    console.info('功能按鈕！', groupRoot);
    carouselTrigger();
  });

  sentinel.on('.r-g6jmlv .r-o7ynqc [role="button"]', (pagingBtn) => {
    console.info('換頁按鈕！', pagingBtn);
    pagingBtn.addEventListener('click', carouselTrigger);
  });

  sentinel.on('div#carousel-trigger', (trigger) => {
    console.info('大圖觸發！', trigger);
    console.log(location.href);

    setTimeout(() => {
      const currentListItem = $$('[role="listitem"]').filter(isBoundingRectShows)[0];
      const isVideo = currentListItem && currentListItem.querySelector('video');
      const isGIF = isVideo && currentListItem.querySelector('video[src^="https"]');

      const groupRoot = $('.r-g6jmlv [role="group"]');
      [...groupRoot.querySelectorAll('[id^="TMD-carousel-"]')].map((btn) => btn.remove());
      if (isVideo) {
        groupRoot.insertAdjacentElement('afterbegin', createCarouselVideoDownloadBtn(isGIF));
      }
      else {
        groupRoot.insertAdjacentElement('afterbegin', createCarouselPhotoDownloadBtn());
      }
    }, 200);
  });

  applyStyle();
}

function twitterVideoSetup() {
  const dialog = document.createElement('dialog');
  dialog.className = 'fixed';
  document.body.appendChild(dialog);

  const bindClickThenReturn = (btn, href) => {
    btn.addEventListener('click', async() => {
      const resp = await GM_fetch(`${SERVER_ORIGIN}/_?${href}`).catch(console.error);
      const result = JSON.parse(resp.responseText);
      if (result.ok) {
        dialog.textContent = '已成功下載 ' + result.dest;
        console.log('已成功下載', result.dest);
        dialog.setAttribute('open', 'open');
        setTimeout(() => {
          dialog.removeAttribute('open');
        }, 3000);
      }
      else {
        dialog.textContent = '下載失敗';
        console.error('下載失敗', result.reason);
      }
    });

    return btn;
  };

  const createTimelineVideoDownloadBtn = (articleEl, isGif) => {
    const root = document.createElement('div');
    root.id = 'TMD-timeline-video-download-btn';
    root.className = 'css-1dbjc4n r-18u37iz r-16y2uox r-1h0z5md';
    root.innerHTML = `
<div role="button" data-focusable="true" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-11cpok1 r-1ny4l3l r-bztko3 r-lrvibr">
  <div dir="ltr" class="css-901oao r-1awozwy r-111h2gw r-6koalj r-1qd0xha r-a023e6 r-16dba41 r-1h0z5md r-ad9z0x r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
    <div class="css-1dbjc4n r-xoduu5 r-1udh08x">
      <span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x r-1n0xq6e r-bcqeeo r-d3hbe1 r-1wgg2b2 r-axxi2z r-qvutc0">
        <span class="css-901oao css-16my406 r-1qd0xha r-ad9z0x r-bcqeeo r-qvutc0">下載${isGif ? ' GIF 影片' : '影片'}</span>
      </span>
    </div>
  </div>
</div>`;
    return bindClickThenReturn(root, articleEl.querySelector('a[title][aria-label]').href);
  };

  const createTweetVideoDownloadBtn = (isGif) => {
    const root = document.createElement('div');
    root.id = 'TMD-tweet-video-download-btn';
    root.className = 'css-1dbjc4n r-18u37iz r-1h0z5md r-3qxfft r-h4g966 r-rjfia';
    root.innerHTML = `
<div role="button" data-focusable="true" tabindex="0" class="css-18t94o4 css-1dbjc4n r-1777fci r-11cpok1 r-1ny4l3l r-bztko3 r-lrvibr">
  <div dir="ltr" class="css-901oao r-1awozwy r-111h2gw r-6koalj r-1qd0xha r-a023e6 r-16dba41 r-1h0z5md r-ad9z0x r-bcqeeo r-o7ynqc r-clp7b1 r-3s2u2q r-qvutc0">
    <div class="css-1dbjc4n r-xoduu5">
      <div class="css-1dbjc4n r-sdzlij r-1p0dtai r-xoduu5 r-1d2f490 r-xf4iuw r-u8s1d r-zchlnj r-ipm5af r-o7ynqc r-6416eg">下載${isGif ? ' GIF 影片' : '影片'}</div>
    </div>
  </div>
</div>`;
    return bindClickThenReturn(root, location.href);
  };

  const cache = new WeakSet();

  sentinel.on('article[role="article"] video', function(video) {
    if (cache.has(video)) { return; }

    const isGif = video.src.startsWith('https');
    if (isGif) {
      console.info('新GIF！', video);
    }
    else {
      console.info('新影片！', video);
    }

    const articleEl = video.closest('article');

    const timelineGroupEl = articleEl.querySelector('.r-1mdbhws[role="group"]');
    if (timelineGroupEl) {
      const btn = createTimelineVideoDownloadBtn(articleEl, isGif);
      timelineGroupEl.insertAdjacentElement('afterbegin', btn);
    }

    const tweetGroupEl = articleEl.querySelector('.r-a2tzq0[role="group"]');
    if (tweetGroupEl) {
      const btn = createTweetVideoDownloadBtn(isGif);
      tweetGroupEl.insertAdjacentElement('afterbegin', btn);
    }
  });
}

function tweetdeckSetup() {
  sentinel.on('.med-origlink', (origLinkEl) => {
    const mediaImg = $('.media-img');
    if (mediaImg) {
      const a = document.createElement('a');
      a.id = 'TMD-photo-download-btn';
      a.className = 'med-downloadlink';
      a.textContent = 'Download';
      a.href = 'javascript:;';
      a.onclick = () => {
        downloadImage(mediaImg, $('#open-modal time > a').href);
      };

      origLinkEl.insertAdjacentElement('afterend', a);
    }
  });
}
