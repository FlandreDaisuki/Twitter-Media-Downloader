#!/usr/bin/env python3

import os
import sys
import re
from pathlib import Path
import http.server
import socketserver
import json
import urllib.parse
import shutil
import subprocess
import sqlite3
from typing import Dict, Any, Optional, NamedTuple
import logging
import threading

APP_ROOT = Path(__file__).resolve().parent
PUBLIC_HOST = os.environ.get('PUBLIC_HOST', '127.0.0.1')
PORT = int(os.environ.get('PORT', '10001'))
CACHE_DIR = Path('/cache')
DOWNLOAD_DIR = Path('/download')
HOST_DOWNLOAD_DIR = os.environ.get('HOST_DOWNLOAD_DIR', '')
VIDEO_NAMING_PATTERN = os.environ.get('VIDEO_NAMING_PATTERN', '{userId}@twitter-{tweetId}-{mediaOrdinal}')
IMAGE_NAMING_PATTERN = os.environ.get('IMAGE_NAMING_PATTERN', '@{userId}-{imgId}')
COLLAGE_NAMING_PATTERN = os.environ.get('COLLAGE_NAMING_PATTERN', '@{userId}-{tweetId}')

DB_PATH = APP_ROOT / "db.sqlite3"

if HOST_DOWNLOAD_DIR == '':
	raise RuntimeError('You should setup HOST_DOWNLOAD_DIR env variable.')

pipe_args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

raw_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
numeric_level = getattr(logging, raw_level, logging.INFO)
logging.basicConfig(format='[%(funcName)s] %(message)s')
logger = logging.getLogger('main')
logger.setLevel(numeric_level)

def load_userscript() -> str:
	with open(APP_ROOT / 'twitter-media-downloader.user.js') as f:
		userscript = f.read()

	replacements = {
		'__USERSCRIPT_VERSION__': '5.0.3',
		'__USERSCRIPT_HOST_NAME__': PUBLIC_HOST,
		'__USERSCRIPT_PORT__': str(PORT),
		'__USERSCRIPT_VIDEO_NAMING_PATTERN__': json.dumps(VIDEO_NAMING_PATTERN),
		'__USERSCRIPT_IMAGE_NAMING_PATTERN__': json.dumps(IMAGE_NAMING_PATTERN),
		'__USERSCRIPT_COLLAGE_NAMING_PATTERN__': json.dumps(COLLAGE_NAMING_PATTERN)
	}

	for key, value in replacements.items():
		userscript = userscript.replace(key, value)

	return userscript

userscript_js = load_userscript()

def init_db():
	with sqlite3.connect(DB_PATH) as conn:
		conn.execute("""
			CREATE TABLE IF NOT EXISTS tasks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				url TEXT,
				type TEXT NOT NULL,
				status TEXT DEFAULT 'processing',
				progress INTEGER DEFAULT 0,
				result_file TEXT,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP
			)
		""")
	logger.debug(f"Database initialized at {DB_PATH}")

class TweetUrl(NamedTuple):
	user_id: str
	tweet_id: str
	media_type: Optional[str] = None
	media_ordinal: Optional[str] = None

class RequestHandler(http.server.SimpleHTTPRequestHandler):
	def handle_userscript_file(self) -> None:
		self.send_response(200)
		self.send_header('Content-type', 'application/javascript')
		self.end_headers()
		self.wfile.write(userscript_js.encode())

	def response_json(self, status_code: int, data: Dict[str, Any]) -> None:
		self.send_response(status_code)
		self.send_header('Content-type', 'application/json')
		self.end_headers()
		self.wfile.write(json.dumps(data).encode())

	def response_video_mp4(self, filepath: Path) -> None:
		self.send_response(200)
		self.send_header('Content-Length', str(filepath.stat().st_size))
		self.send_header('Content-Type', 'video/mp4')
		filename = os.path.basename(filepath)
		self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
		self.end_headers()
		with open(filepath, 'rb') as f:
			shutil.copyfileobj(f, self.wfile)

	def parse_tweet_url(self, url: str) -> Optional[TweetUrl]:
		"""
		- https://x.com/:userId/status/:tweetId
		- https://x.com/:userId/status/:tweetId/video/:mediaOrdinal
		- https://x.com/:userId/status/:tweetId/photo/:mediaOrdinal
		"""
		pattern = r"https://(?:x|twitter)\.com/(?P<user_id>[^/]+)/status/(?P<tweet_id>\d+)(?:/(?P<media_type>video|photo)/(?P<media_ordinal>\d+))?/?"
		matched = re.match(pattern, url)

		if matched:
				return TweetUrl(**matched.groupdict())
		return None


	def handle_raw_video(self, tweet_url: str) -> None:
		"""
		Handle /api/raw/video?url={tweet_url}
		"""
		tu = self.parse_tweet_url(tweet_url)

		if not tu:
			self.response_json(400, {'ok': False, 'reason': f"unknown twitter url: '{tweet_url}'"})
			return

		ordinal = tu.media_ordinal if tu.media_ordinal is not None else '1'

		output_filename = VIDEO_NAMING_PATTERN.format(
			userId=tu.user_id,
			tweetId=tu.tweet_id,
			mediaOrdinal=ordinal
		)
		output_filename += '.mp4'
		output_path = CACHE_DIR / output_filename

		cmd = ['yt-dlp', '--newline', '--progress', *pipe_args,
						'--playlist-items', ordinal, '--output', str(output_path), tweet_url]

		with subprocess.Popen(
			cmd,
			stdout=subprocess.PIPE,
			stderr=subprocess.STDOUT,
			text=True,
			bufsize=1
		) as process:
				if process.stdout:
					for line in process.stdout:
						# TODO: parse yt-dlp line for progress api
						logger.debug(f"[{tu.tweet_id}-{ordinal}] {line.rstrip()}")

		return_code = process.wait()
		if return_code == 0:
			self.response_video_mp4(output_path)
		else:
			self.response_json(500, {'ok': False, 'reason': 'yt-dlp process failed. Check server logs.'})

	def response_image_jpg(self, filepath: Path) -> None:
		self.send_response(200)
		self.send_header('Content-Type', 'image/jpeg')
		self.send_header('Content-Length', str(filepath.stat().st_size))
		filename = os.path.basename(filepath)
		self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
		self.end_headers()
		with open(filepath, 'rb') as f:
			shutil.copyfileobj(f, self.wfile)

	def handle_raw_collage(self, tweet_url: str, image_ids: list[str]) -> None:
		"""
		Handle /api/raw/collage?url={tweet_url}&image={imageId}[...&image={imageId}]
		"""
		tu = self.parse_tweet_url(tweet_url)
		if not tu:
			self.response_json(400, {'ok': False, 'reason': f"unknown twitter url: '{tweet_url}'"})
			return

		# Security: Validate image_ids to prevent argument injection
		clean_ids = [image_id for image_id in image_ids if re.match(r'^[^-][a-zA-Z0-9_-]+$', image_id)]
		if len(clean_ids) != len(image_ids):
			self.response_json(400, {'ok': False, 'reason': 'Invalid image ID detected'})
			return

		output_filename = COLLAGE_NAMING_PATTERN.format(
			userId=tu.user_id,
			tweetId=tu.tweet_id
		)
		output_filename += '.jpg'
		output_path = CACHE_DIR / output_filename

		image_urls = map(lambda image_id: f"https://pbs.twimg.com/media/{image_id}?format=jpg&name=orig", image_ids)

		cmd = ['magick', *image_urls, '-append', str(output_path)]
		result = subprocess.run(cmd)

		if result.returncode == 0:
			self.response_image_jpg(output_path)
		else:
			self.response_json(500, {'ok': False, 'reason': result.stderr})

	def handle_create_video_task(self, tweet_url: str) -> None:
		tu = self.parse_tweet_url(tweet_url)
		if not tu:
			return self.response_json(400, {'ok': False, 'reason': f"Invalid URL: {tweet_url}"})

		ordinal = tu.media_ordinal if tu.media_ordinal else '1'
		output_filename = VIDEO_NAMING_PATTERN.format(
			userId=tu.user_id,
			tweetId=tu.tweet_id,
			mediaOrdinal=ordinal
		)
		output_filename += '.mp4'
		output_path = DOWNLOAD_DIR / output_filename

		try:
			with sqlite3.connect(DB_PATH, timeout=15) as conn:
				existing = conn.execute(
					"SELECT id FROM tasks WHERE url = ? AND status = 'processing'",
					(tweet_url,)
				).fetchone()

				if existing:
					return self.response_json(202, {'ok': True, 'task_id': existing[0], 'filename': output_filename})

				cursor = conn.execute(
					"INSERT INTO tasks (type, url, status, result_file) VALUES (?, ?, ?, ?)",
					('video', tweet_url, 'processing', output_filename)
				)
				task_id = cursor.lastrowid
				# TODO: should i check task_id is not None?
		except sqlite3.Error as e:
			logger.error(e)
			return self.response_json(500, {'ok': False, 'reason': f"Database Error: {str(e)}"})

		thread = threading.Thread(
			target=self._video_download_worker,
			args=(task_id, tweet_url, ordinal, output_path)
		)
		thread.start()

		self.response_json(202, {'ok': True, 'task_id': task_id})

	def _video_download_worker(self, task_id: int, tweet_url: str, ordinal: str, output_path: Path) -> None:
		"""Background worker that runs yt-dlp and updates the database."""
		self._update_task_db(task_id, status='processing', progress=0)

		cmd = ['yt-dlp', '--newline', '--progress', *pipe_args,
						'--playlist-items', ordinal, '--output', str(output_path), tweet_url]

		progress_re = re.compile(r'(\d+\.\d+)%')
		is_audio_phase = False
		raw_percent = 0

		try:
			with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1) as process:
				if process.stdout:
					for line in process.stdout:
						logger.debug(line.rstrip())
						if "[download]" in line:
							if 'audio' in line.lower():
								is_audio_phase = True

							match = progress_re.search(line)
							if match:
								raw_percent = float(match.group(1))

							# total progress weight: video 0-90%, audio 90-99%, remux 99-100%
							if not is_audio_phase:
								total_progress = int(raw_percent * 0.9)
							else:
								total_progress = int(90 + (raw_percent * 0.09))

							self._update_task_db(task_id, progress=total_progress)

				return_code = process.wait()
				if return_code == 0:
					self._update_task_db(task_id, status='completed', progress=100)
				else:
					self._update_task_db(task_id, status='failed')
		except Exception as e:
			logger.error(f"[task={task_id}]", e)
			self._update_task_db(task_id, status='failed')

	def handle_create_collage_task(self) -> None:
		pass

	def _update_task_db(self, task_id: int, **kwargs) -> None:
		cols = ", ".join([f"{k} = ?" for k in kwargs.keys()])
		vals = list(kwargs.values()) + [task_id]
		try:
			with sqlite3.connect(DB_PATH, timeout=20) as conn:
				conn.execute(f"UPDATE tasks SET {cols} WHERE id = ?", vals)
		except sqlite3.Error as e:
			logger.error(e)

	def handle_get_task_status(self, task_id: str) -> None:
		"""Check task status in DB and return as JSON."""
		try:
			with sqlite3.connect(DB_PATH, timeout=10) as conn:
				conn.row_factory = sqlite3.Row
				row = conn.execute("SELECT * FROM tasks WHERE id = ?", (int(task_id),)).fetchone()
				if row:
					self.response_json(200, {'ok': True, 'task': dict(row)})
				else:
					self.response_json(404, {'ok': False, 'reason': 'Task not found'})
		except sqlite3.Error as e:
			logger.error(e)
			self.response_json(500, {'ok': False, 'reason': str(e)})

	def handle_cache(self, filename: str) -> None:
		# Security: Prevent Path Traversal
		try:
			file_path = (CACHE_DIR / filename).resolve()
			if not file_path.is_relative_to(CACHE_DIR) or not file_path.exists():
				raise ValueError
		except (ValueError, OSError):
			self.response_json(404, {'ok': False, 'reason': 'File not found or expired'})
			return

		if filename.lower().endswith('.mp4'):
			self.response_video_mp4(file_path)
		elif filename.lower().endswith(('.jpg', '.jpeg')):
			self.response_image_jpg(file_path)
		else:
			self.send_response(200)
			self.send_header('Content-Type', 'application/octet-stream')
			self.send_header('Content-Length', str(file_path.stat().st_size))
			self.end_headers()
			with open(file_path, 'rb') as f:
				shutil.copyfileobj(f, self.wfile)

	def do_GET(self) -> None:
		"""
		Request entry
		"""
		parsed_path = urllib.parse.urlparse(self.path)
		path = parsed_path.path
		query = urllib.parse.parse_qs(parsed_path.query)

		if path == '/health':
			self.send_response(200)
			self.end_headers()
			return

		# Static Files
		if path == '/twitter-media-downloader.user.js':
			return self.handle_userscript_file()

		# Binary APIs
		if path == '/api/raw/video':
			tweet_url = query.get('url', [''])[0]
			return self.handle_raw_video(tweet_url)

		if path == '/api/raw/collage':
			tweet_url = query.get('url', [''])[0]
			image_ids = query.get('image', [])
			return self.handle_raw_collage(tweet_url, image_ids)

		# Async Task APIs
		if path == '/api/tasks/create/video':
			tweet_url = query.get('url', [''])[0]
			return self.handle_create_video_task(tweet_url)

		if path == '/api/tasks/create/collage':
			url = query.get('url', [''])[0]
			# TODO: This would return a JSON with a task_id
			return self.handle_create_collage_task(url)

		if path == '/api/tasks/status':
			task_id = query.get('id', [''])[0]
			return self.handle_get_task_status(task_id)

		# Cache Access
		if path.startswith('/api/cache/'):
			filename = path.replace('/api/cache/', '')
			return self.handle_cache(filename)

		# Fallback
		self.response_json(404, {'ok': False, 'reason': 'Not Found'})


def server_start():
	yt_dlp_version = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True).stdout.strip()

	with socketserver.ThreadingTCPServer(('0.0.0.0', 80), RequestHandler) as httpd:
		httpd.allow_reuse_address = True

		print(f"Server running at http://{PUBLIC_HOST}:{PORT}/")
		print()
		print(f"Usage:")
		print(f"  Download userscript:")
		print(f"    GET http://{PUBLIC_HOST}:{PORT}/twitter-media-downloader.user.js")
		print()
		print(f"  Start an async downloading task by twitter video url:")
		print(f"    GET http://{PUBLIC_HOST}:{PORT}/api/tasks/create/video?url=https://x.com/{{userId}}/status/{{tweetId}}")
		print(f"    GET http://{PUBLIC_HOST}:{PORT}/api/tasks/create/video?url=https://x.com/{{userId}}/status/{{tweetId}}/video/{{mediaOrdinal}}")
		print()
		print(f"  Download a collage by imageId:")
		print(f"    GET http://{PUBLIC_HOST}:{PORT}/api/raw/collage?url=https://x.com/{{userId}}/status/{{tweetId}}&image={{imageId}}[...&image={{imageId}}]")
		print()
		print(f"  Video Name:")
		print(f"    {VIDEO_NAMING_PATTERN}.mp4")
		print()
		print(f"  Destination:")
		print(f"    {HOST_DOWNLOAD_DIR}")
		print()
		print(f"Versions:")
		print(f"  yt-dlp: {yt_dlp_version}")
		print()

		httpd.serve_forever()


def run_daily_cleanup():
	"""
	Background task that runs once every 24 hours to clean CACHE_DIR.
	"""
	import time
	SECONDS_IN_DAY = 24 * 60 * 60
	SECONDS_IN_WEEK = 7 * SECONDS_IN_DAY

	while True:
		logger.info("Starting scheduled file maintenance...")
		now = time.time()
		cutoff = now - SECONDS_IN_WEEK

		try:
			for file_path in CACHE_DIR.iterdir():
				if file_path.is_file():
					if file_path.stat().st_mtime < cutoff:
						file_path.unlink()
						logger.info(f"Removed old file: {file_path.name}")
		except Exception as e:
			logger.error(e)

		time.sleep(SECONDS_IN_DAY)

if __name__ == "__main__":
	cleanup_thread = threading.Thread(target=run_daily_cleanup, daemon=True)
	cleanup_thread.start()

	init_db()
	server_start()
