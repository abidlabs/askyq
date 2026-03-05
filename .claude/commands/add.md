Find new Yasir Qadhi fatwa/Q&A videos on YouTube that are not yet indexed in this repo, fetch their transcripts, and create structured fatwa articles.

**Optional argument**: The user may provide a YouTube video URL (e.g., `https://www.youtube.com/watch?v=VIDEO_ID`). If provided, skip Steps 1-4 and go directly to Step 5 using that video. Extract the `videoId` from the URL. To get the video's title and publish date, run:
```bash
python3 scripts/yt.py search "" 1
```
and instead use the YouTube API to fetch the video's snippet directly:
```bash
python3 -c "
import json, subprocess, os
exec(open('scripts/yt.py').read().split('def cmd_search')[0])  # load _load_env, _api_key, _yt_get
data = _yt_get('videos', {'part': 'snippet', 'id': 'VIDEO_ID'})
item = data['items'][0]['snippet']
print(json.dumps({'title': item['title'], 'publishedAt': item['publishedAt'][:10]}))
"
```
If the videoId is already in the indexed set, tell the user and stop.

$ARGUMENTS

## Step 1: Prerequisites

1. Verify `youtube-transcript-api` is installed. If not, run `pip install youtube-transcript-api`.
2. Verify the YouTube API key works by running: `python3 scripts/yt.py search "Q&A" 1`

## Step 2: Load Existing Data

Read `data/fatwas.json` and collect all `videoId` values into a set of already-indexed IDs.

## Step 3: Search for New Videos

Run multiple searches to cast a wide net for fatwa/Q&A content. Run these in parallel:

```bash
python3 scripts/yt.py search "Q&A" 15
python3 scripts/yt.py search "Ask Shaykh YQ" 15
python3 scripts/yt.py search "fatwa ruling halal haram" 10
python3 scripts/yt.py search "permissible in islam" 10
```

Collect all results, deduplicate by `videoId`, and remove any whose `videoId` is already in the indexed set.

Filter out videos that are clearly NOT fatwa/Q&A content based on their title (e.g., full-length lectures on seerah, tafsir series, khutbahs about general topics, Ramadan series, etc.). Keep only videos that look like they answer specific Islamic ruling questions.

## Step 4: Present Candidates

Show the user a numbered list of candidate videos with title, date, and videoId. Ask which to process. The user can pick specific numbers, a range, or say "all".

## Step 5: Process Each Selected Video

For each video:

### 5a. Fetch Transcript
```bash
python3 scripts/yt.py transcript <videoId>
```
This saves two files:
- `tmp/transcript_<videoId>.txt` — plain text transcript
- `tmp/transcript_<videoId>_ts.json` — timestamped JSON array where each entry has `{"text": "...", "start": <seconds>, "duration": <seconds>}`

Read both files. If the transcript fetch fails (no captions available), skip the video and tell the user.

### 5b. Analyze the Transcript

Read the full transcript carefully. Identify the distinct fatwa/ruling topics discussed. A single video may answer multiple independent questions — each becomes its own fatwa entry.

For each topic, determine:
- The specific question being answered
- Yasir Qadhi's ruling/position
- Key evidence, reasoning, and nuances
- Relevant tags and category
- **The approximate start timestamp** (in seconds) for this topic by finding where the topic begins in the timestamped JSON

### 5c. Generate Fatwa Entries

For each identified topic, create two things:

**1. Individual fatwa file** at `api/fatwas/{id}.json`:
```json
{
  "id": "<slug>",
  "title": "<the question being answered, phrased as a question>",
  "scholar": "Yasir Qadhi",
  "videoId": "<videoId>",
  "videoUrl": "https://www.youtube.com/watch?v=<videoId>",
  "datePublished": "<YYYY-MM-DD from search results>",
  "tags": ["<relevant>", "<search>", "<terms>"],
  "category": "<see categories below>",
  "stanceSummary": "<2-4 sentence summary of the ruling with key nuances and conditions>",
  "transcript": "<full cleaned transcript in Markdown — see cleaning guidelines>"
}
```

**2. Summary entry** — append to the array in `data/fatwas.json`:
```json
{
  "id": "<same slug>",
  "title": "<same title>",
  "summary": "<1-2 sentence plain summary of the ruling>",
  "scholar": "Yasir Qadhi",
  "videoId": "<videoId>",
  "videoUrl": "https://www.youtube.com/watch?v=<videoId>",
  "datePublished": "<YYYY-MM-DD>",
  "tags": ["<same tags>"],
  "category": "<same category>"
}
```

### Categories (pick the best fit)
- Financial Transactions
- Worship & Prayer
- Family & Marriage
- Food & Drink
- Social Issues
- Theology & Creed
- Daily Life
- Death & Afterlife
- Dress & Appearance
- Other

### ID / Slug Guidelines
- Lowercase kebab-case
- Descriptive but concise: `insurance-in-islam`, `ruling-on-music`, `mortgage-in-the-west`
- Avoid generic slugs like `qa-session-1`
- If multiple topics come from one video, each gets its own descriptive slug

### Transcript Cleaning Guidelines

The raw YouTube auto-captions need significant cleanup. Transform them into well-structured Markdown:

1. **Start with** `## Summary of Yasir Qadhi's Position` — a bullet-point summary of his key conclusions
2. **Follow with** `## Full Lecture Transcript (Cleaned)` — the organized, readable transcript
3. Fix capitalization, punctuation, and grammar errors from auto-captions
4. Add paragraph breaks at natural topic transitions
5. Add Markdown headings (`###`) for major sections within the transcript
6. Preserve Arabic/Islamic terms with proper transliteration (e.g., gharar, riba, darurah, tawakkul, qadr)
7. Use **bold** for key terms and rulings
8. If the video covers multiple topics, each topic's transcript should contain only the relevant portion
9. Include the source video link in the summary section: `In a [YYYY video](videoUrl), Yasir Qadhi...`

### Timestamp Links in Transcripts

Use the timestamped JSON (`_ts.json`) to add clickable timestamp links at section headings. This lets readers jump to the corresponding part of the video.

**How to find timestamps**: Search the `_ts.json` array for the snippet whose `text` best matches the beginning of each section. Use the `start` value (in seconds) to construct the link.

**Format**: Convert seconds to `MM:SS` (or `H:MM:SS` for videos over an hour). Add the timestamp link next to each `###` heading:

```markdown
### The Ruling on Insurance — [12:34](https://www.youtube.com/watch?v=VIDEO_ID&t=754)
```

Also add a timestamp link in the summary section for the overall topic start:

```markdown
In a [2025 video](https://www.youtube.com/watch?v=VIDEO_ID) (starting at [5:23](https://www.youtube.com/watch?v=VIDEO_ID&t=323)), Yasir Qadhi...
```

**Rules**:
- Every `###` heading in the transcript section MUST have a timestamp link
- Timestamps should be approximate — match to the nearest snippet in the `_ts.json`
- For multi-topic videos, the summary timestamp should point to where THIS specific topic begins in the video

## Step 6: Update API Index

Read `api/index.json`, update `fatwaCount` to match the total number of entries now in `data/fatwas.json`, and write it back.

## Step 7: Summary

Tell the user:
- How many new fatwas were created
- List each one with its title, ID, and category
- Remind them to review the generated content since transcripts are AI-cleaned from auto-captions
