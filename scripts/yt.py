#!/usr/bin/env python3
"""YouTube helper for AskYQ - search Yasir Qadhi's channel and fetch transcripts."""

import sys
import json
import os
import subprocess
import urllib.parse

CHANNEL_ID = "UClUa7-iHJNKEM2e_zWYSPQg"  # Yasir Qadhi


def _load_env():
    """Load .env file from project root if env vars not already set."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _api_key():
    _load_env()
    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        print("Error: YOUTUBE_API_KEY not set. Add it to .env or export it.", file=sys.stderr)
        sys.exit(1)
    return key


def _yt_get(endpoint, params):
    params["key"] = _api_key()
    url = f"https://www.googleapis.com/youtube/v3/{endpoint}?{urllib.parse.urlencode(params)}"
    result = subprocess.run(["curl", "-s", url], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error: curl failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


def cmd_search(query="", max_results=10, page_token=None):
    """Search Yasir Qadhi's channel for videos."""
    params = {
        "part": "snippet",
        "channelId": CHANNEL_ID,
        "type": "video",
        "maxResults": max_results,
        "order": "date",
    }
    if query:
        params["q"] = query
    if page_token:
        params["pageToken"] = page_token

    data = _yt_get("search", params)
    results = []
    for item in data.get("items", []):
        vid = item["id"].get("videoId")
        if not vid:
            continue
        results.append({
            "videoId": vid,
            "title": item["snippet"]["title"],
            "description": item["snippet"]["description"],
            "publishedAt": item["snippet"]["publishedAt"][:10],
        })

    out = {"results": results}
    if "nextPageToken" in data:
        out["nextPageToken"] = data["nextPageToken"]
    print(json.dumps(out, indent=2))


def cmd_transcript(video_id):
    """Fetch captions for a YouTube video and save to tmp/."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print("Error: pip install youtube-transcript-api", file=sys.stderr)
        sys.exit(1)

    try:
        api = YouTubeTranscriptApi()
        t = api.fetch(video_id, languages=["en"])
        snippets = [{"text": s.text, "start": s.start, "duration": s.duration} for s in t]
    except (TypeError, AttributeError):
        t = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
        snippets = [{"text": s["text"], "start": s["start"], "duration": s["duration"]} for s in t]

    text = " ".join(s["text"] for s in snippets)

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tmp_dir = os.path.join(project_root, "tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    # Save plain text version (word-wrapped paragraphs)
    path = os.path.join(tmp_dir, f"transcript_{video_id}.txt")
    words = text.split()
    with open(path, "w") as f:
        for i in range(0, len(words), 150):
            f.write(" ".join(words[i:i + 150]) + "\n\n")

    # Save timestamped JSON version
    ts_path = os.path.join(tmp_dir, f"transcript_{video_id}_ts.json")
    with open(ts_path, "w") as f:
        json.dump(snippets, f, indent=2)

    print(path)
    print(ts_path)


def main():
    usage = (
        "Usage:\n"
        "  yt.py search [query] [max_results] [page_token]\n"
        "  yt.py transcript <video_id>\n"
    )
    if len(sys.argv) < 2:
        print(usage)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        max_results = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        page_token = sys.argv[4] if len(sys.argv) > 4 else None
        cmd_search(query, max_results, page_token)
    elif cmd == "transcript":
        if len(sys.argv) < 3:
            print("Error: video_id required", file=sys.stderr)
            sys.exit(1)
        cmd_transcript(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}\n{usage}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
