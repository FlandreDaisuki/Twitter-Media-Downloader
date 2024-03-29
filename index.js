#!/usr/bin/env node

const { argv } = require('process');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const HOSTNAME = '0.0.0.0';
const PORT = process.env.PORT || 10001;
const OUTPUT_TARGET_PATH = '/download';
const VIDEO_NAMING_PATTERN = process.env.VIDEO_NAMING_PATTERN || '{userId}@twitter-{tweetId}';

const pipeArgs = (()=>{
  const idx = argv.indexOf('--');
  if(idx >= 0) {
    return argv.slice(idx + 1);
  }
  return [];
})()

const server = http.createServer((req, res) => {
  req.resume().on('end', () => {
    const tweetURL = new URL(req.url, 'https://dummy.io').search.slice(1);
    const [userId, tweetId] = [...[...tweetURL.matchAll(/.*\/(.*)\/status\/(\d+).*/g)][0]].slice(1);
    const outputFileName = VIDEO_NAMING_PATTERN
      .replace('{userId}', userId)
      .replace('{tweetId}', tweetId)
      .concat('.mp4');

    const cmdArgs = [
      ...pipeArgs,
      '--output',
      `'${path.join(OUTPUT_TARGET_PATH, outputFileName)}'`,
      tweetURL,
    ];

    const output = spawnSync('yt-dlp', cmdArgs, { shell: true });
    const stdout = output.stdout.toString().trim();
    const stderr = output.stderr.toString().trim();
    if (stdout) {
      const msg = stdout
        .split('\n')
        .filter((line) => String(line).includes('[download] Destination'))[0];

      console.log(msg);
    }
    if (stderr) { console.error(`stderr:\n${stderr}\n`); }

    if (output.status === 0) {
      const resBody = { ok: true, dest: outputFileName };
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify(resBody));
    } else {
      const resBody = { ok: false, reason: stderr };
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify(resBody));
    }
  });
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`Server running at http://${HOSTNAME}:${PORT}/`);
  console.log();
  console.log('Usage:');
  console.log(`  GET http://${HOSTNAME}:${PORT}/?https://twitter.com/{userId}/status/{tweetId}`);
  console.log(`  download as '${VIDEO_NAMING_PATTERN}.mp4'`);
  console.log();
  console.log('Destination:');
  console.log(`  ${OUTPUT_TARGET_PATH}`);
  console.log();
});
