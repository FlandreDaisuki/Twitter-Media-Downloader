// ==UserScript==
// @name         Tweetdeck Media Downloader
// @namespace    https://github.com/FlandreDaisuki
// @description  Enjoy it.
// @version      0.3.0
// @author       FlandreDaisuki
// @match        https://tweetdeck.twitter.com/
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
}
html dialog {
  z-index: 301;
  top: 50%;
}
.icon-download:before{
  content:"\\F186";
}
`;

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

const downloadImage = (imgEl, tweetURL) => {
  const twimgURL = getImageURL(imgEl.src);
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

// Entry Point
if (location.host === 'tweetdeck.twitter.com') {
  applyStyle(TWEETDECK_CSS);
  tweetdeckSetup();
}

function tweetdeckSetup() {
  const dialog = document.createElement('dialog');
  dialog.className = 'fixed';
  document.body.appendChild(dialog);

  const createDownloadHandler = (href) => async function clickToDownloadVideo() {
    const resp = await GM_fetch(`${SERVER_ORIGIN}/?${href}`).catch(console.error);
    const result = JSON.parse(resp.responseText);
    if (result.ok) {
      dialog.textContent = '已成功下載 ' + result.dest;
      console.log('已成功下載', result.dest);
      dialog.setAttribute('open', 'open');
      setTimeout(function dialogAutoClose() {
        dialog.removeAttribute('open');
      }, 3000);
    }
    else {
      dialog.textContent = '下載失敗';
      console.error('下載失敗', result.reason);
    }
  };

  sentinel.on('.med-origlink', (origlinkEl) => {
    const a = document.createElement('a');
    a.className = 'med-downloadlink';
    a.textContent = 'Download';
    a.href = 'javascript:;';

    const mediaImg = $('.media-img');
    if (mediaImg) {
      a.id = 'TMD-photo-download-btn';
      a.onclick = function clickToDownloadImage() {
        downloadImage(mediaImg, $('#open-modal time > a').href);
      };

      origlinkEl.insertAdjacentElement('afterend', a);
    }

    const mediaVideo = $('.js-media-native-video');
    if (mediaVideo) {
      a.id = 'TMD-video-download-btn';
      a.onclick = createDownloadHandler($('.tweet-timestamp a').href);
      origlinkEl.insertAdjacentElement('afterend', a);
    }
  });

  sentinel.on('.js-media-preview-container.is-gif, .js-media-preview-container.is-video', (previewContainer) => {
    const article = previewContainer.closest('article.stream-item');
    if (!article) { return; }

    const tweetActions = article.querySelector('.js-tweet-actions');
    if (!tweetActions) { return; }
    if (tweetActions.querySelector('a[rel="download"]')) { return; }

    // <li class="tweet-action-item pull-left margin-r--10">
    //   <a class="tweet-action position-rel" href="#" rel="download">
    //     <i class="icon icon-download txt-center pull-left"></i>
    //     <span class="is-vishidden">Download</span>
    //   </a>
    // </li>
    const actionItem = document.createElement('li');
    actionItem.className = 'tweet-action-item pull-left margin-r--10';

    const a = document.createElement('a');
    a.innerHTML = `<i class="icon icon-download txt-center pull-left"></i> <span class="is-vishidden">Download</span> <span class="pull-right margin-l--2 margin-t--1 txt-size--12">下載</span>`;
    a.className = 'tweet-action position-rel';
    a.href = 'javascript:;'
    a.rel = 'download';
    a.onclick = createDownloadHandler(article.querySelector('.tweet-timestamp a').href);

    actionItem.appendChild(a);
    tweetActions.insertAdjacentElement('afterbegin', actionItem);
  });
}
