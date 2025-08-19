#!/usr/bin/env python3

import os
import sys
from pathlib import Path
import http.server
import socketserver
import json
import urllib.parse
import subprocess
from typing import Dict, Any, Optional, Tuple, List

APP_ROOT = Path(__file__).resolve().parent
HOSTNAME = '0.0.0.0'
PORT = 10001
OUTPUT_TARGET_PATH = Path('/download')
VIDEO_NAMING_PATTERN = os.environ.get('VIDEO_NAMING_PATTERN', '{userId}@twitter-{tweetId}')
IMAGE_NAMING_PATTERN = os.environ.get('IMAGE_NAMING_PATTERN', '@{userId}-{twimgId}')

pipe_args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

def load_userscript() -> str:
	with open(APP_ROOT / 'twitter-media-downloader.user.js', 'r') as f:
		userscript = f.read()

	replacements = {
		'__USERSCRIPT_VERSION__': '2.1.2',
		'__USERSCRIPT_HOST_NAME__': '127.0.0.1',
		'__USERSCRIPT_PORT__': str(PORT),
		'__USERSCRIPT_IMAGE_NAMING_PATTERN__': json.dumps(IMAGE_NAMING_PATTERN)
	}

	for key, value in replacements.items():
		userscript = userscript.replace(key, value)

	return userscript

userscript_js = load_userscript()

class RequestHandler(http.server.SimpleHTTPRequestHandler):
	def send_json_response(self, status_code: int, data: Dict[str, Any]) -> None:
		self.send_response(status_code)
		self.send_header('Content-type', 'application/json')
		self.end_headers()
		self.wfile.write(json.dumps(data).encode())

	def handle_userscript_request(self) -> None:
		self.send_response(200)
		self.send_header('Content-type', 'application/javascript')
		self.end_headers()
		self.wfile.write(userscript_js.encode())

	def parse_twitter_url(self, url: str) -> Optional[Tuple[str, str]]:
		parsed_url = urllib.parse.urlparse(url)
		path_parts = parsed_url.path.split('/')
		if len(path_parts) >= 4 and path_parts[2] == 'status':
			return path_parts[1], path_parts[3]
		return None

	def handle_download_request(self, query: Dict[str, List[str]]) -> None:
		twitter_param_url = query.get('url', [''])[0]
		url_info = self.parse_twitter_url(twitter_param_url)

		if not url_info:
			self.send_json_response(400, {'ok': False, 'reason': f"unknown twitter url: '{twitter_param_url}'"})
			return

		user_id, tweet_id = url_info
		output_file_name = f"{VIDEO_NAMING_PATTERN.format(userId=user_id, tweetId=tweet_id)}.mp4"
		output_path = OUTPUT_TARGET_PATH / output_file_name

		cmd = ['yt-dlp', *pipe_args, '--output', str(output_path), twitter_param_url]
		result = subprocess.run(cmd, capture_output=True, text=True)

		if result.returncode == 0:
			for line in result.stdout.splitlines():
				if '[download] Destination' in line:
					print(line)
					break
			self.send_json_response(200, {'ok': True, 'dest': output_file_name})
		else:
			self.send_json_response(200, {'ok': False, 'reason': result.stderr})

	def do_GET(self) -> None:
		parsed_path = urllib.parse.urlparse(self.path)

		if parsed_path.path == '/twitter-media-downloader.user.js':
			self.handle_userscript_request()
		elif parsed_path.path == '/download':
			query = urllib.parse.parse_qs(parsed_path.query)
			self.handle_download_request(query)
		else:
			self.send_json_response(404, {'ok': False, 'reason': f"unknown request: {self.command} {self.path}"})

def get_yt_dlp_version() -> str:
	result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True)
	return result.stdout.strip()

with socketserver.TCPServer((HOSTNAME, PORT), RequestHandler) as httpd:
	print(f"Server running at http://{HOSTNAME}:{PORT}/")
	print()
	print(f"Usage:")
	print(f"  Download userscript:")
	print(f"    GET http://{HOSTNAME}:{PORT}/twitter-media-downloader.user.js")
	print()
	print(f"  Start an async downloading task by twitter video url:")
	print(f"    GET http://{HOSTNAME}:{PORT}/download?url=https://x.com/{{userId}}/status/{{tweetId}}")
	print()
	print(f"  Video Name:")
	print(f"    {VIDEO_NAMING_PATTERN}.mp4")
	print()
	print(f"  Destination:")
	print(f"    {OUTPUT_TARGET_PATH}")
	print()
	print(f"Versions:")
	print(f"  yt-dlp: {get_yt_dlp_version()}")
	print()

	httpd.serve_forever()
