#!/usr/bin/env node

import { readFile } from 'fs/promises';
import process from 'process';
import http from 'http';
import path from 'path';
import { spawnSync, execSync } from 'child_process';

const APP_ROOT = import.meta.dirname;
const HOSTNAME = '0.0.0.0';
const PORT = 10001;
const OUTPUT_TARGET_PATH = '/download';
const VIDEO_NAMING_PATTERN = process.env.VIDEO_NAMING_PATTERN || '{userId}@twitter-{tweetId}';
const IMAGE_NAMING_PATTERN = process.env.IMAGE_NAMING_PATTERN || '@{userId}-{twimgId}';

const pipeArgs = (()=>{
  const idx = process.argv.indexOf('--');
  if(idx >= 0) {
    return process.argv.slice(idx + 1);
  }
  return [];
})();

const userscriptJs = (await readFile(path.resolve(APP_ROOT, 'twitter-media-downloader.user.js'), 'utf8'))
  .replaceAll('__USERSCRIPT_VERSION__', '2.0.0')
  .replaceAll('__USERSCRIPT_HOST_NAME__', '127.0.0.1')
  .replaceAll('__USERSCRIPT_PORT__', String(PORT))
  .replaceAll('__USERSCRIPT_IMAGE_NAMING_PATTERN__', JSON.stringify(IMAGE_NAMING_PATTERN));

const server = http.createServer(async(req, res) => {
  const incoming = new URL(req.url, 'http://server');
  if(req.method === 'GET' && incoming.pathname === '/twitter-media-downloader.user.js') {
    return res.end(userscriptJs);
  }

  if(req.method === 'GET' && incoming.pathname === '/download') {
    const twitterParamUrl = incoming.searchParams.get('url');
    const twitterUrl = new URL(twitterParamUrl);
    const [userId, tweetId] = twitterUrl.pathname.match(/^[/]([^/]+)[/]status[/]([^/]+)/)?.slice(1) ?? [];
    if(!userId || !tweetId) {
      return res
        .writeHead(400, {
          'Content-Type': 'application/json',
        })
        .end(JSON.stringify({
          ok: false,
          reason: `unknown twitter url: '${twitterParamUrl}'`,
        }));
    }
    const outputFileName = VIDEO_NAMING_PATTERN
      .replace('{userId}', userId)
      .replace('{tweetId}', tweetId)
      .concat('.mp4');

    const cmdArgs = [
      ...pipeArgs,
      '--output',
      `'${path.resolve(OUTPUT_TARGET_PATH, outputFileName)}'`,
      twitterUrl.href,
    ];

    const ytdlpOutput = spawnSync('yt-dlp', cmdArgs, { shell: true });
    const stdout = ytdlpOutput.stdout.toString().trim();
    const stderr = ytdlpOutput.stderr.toString().trim();
    if (stdout) {
      const msg = stdout
        .split('\n')
        .filter((line) => String(line).includes('[download] Destination'))[0];

      console.log(msg);
    }
    if (stderr) { console.error(`stderr:\n${stderr}\n`); }

    if (ytdlpOutput.status === 0) {
      return res
        .writeHead(200, {
          'Content-Type': 'application/json',
        })
        .end(JSON.stringify({
          ok: true,
          dest: outputFileName,
        }));
    } else {
      return res
        .writeHead(200, {
          'Content-Type': 'application/json',
        })
        .end(JSON.stringify({
          ok: false,
          reason: stderr,
        }));
    }
  }

  return res
    .writeHead(404, {
      'Content-Type': 'application/json',
    })
    .end(JSON.stringify({
      ok: false,
      reason: `unknown request: ${req.method} ${req.url}`,
    }));
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`Server running at http://${HOSTNAME}:${PORT}/`);
  console.log();
  console.log('Usage:');
  console.log('  Download userscript:');
  console.log(`    GET http://${HOSTNAME}:${PORT}/twitter-media-downloader.user.js`);
  console.log();
  console.log('  Start an async downloading task by twitter video url:');
  console.log(`    GET http://${HOSTNAME}:${PORT}/download?url=https://x.com/{userId}/status/{tweetId}`);
  console.log();
  console.log(  'Video Name:');
  console.log(`  ${VIDEO_NAMING_PATTERN}.mp4`);
  console.log();
  console.log(  'Destination:');
  console.log(`  ${OUTPUT_TARGET_PATH}`);
  console.log();
  console.log('Versions:');
  console.log(`  yt-dlp: ${execSync('yt-dlp --version').toString().trim()}`, );
  console.log();
});
