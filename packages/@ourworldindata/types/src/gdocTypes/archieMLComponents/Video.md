An embedded video hosted on OWID's CloudFlare. Videos are not hosted in
Google Drive — a developer must upload the compressed video first
(compress via Handbrake before uploading).

```archie
{.video}
url: https://assets.ourworldindata.org/videos/lead-petrol-ban-video-landscape.mp4
filename: lead-petrol-ban-video-landscape-cover.png
shouldLoop: true
shouldAutoplay: true
caption: Timelapse of the phase-out of leaded gasoline from 1986 to 2021
{}
```

## When to use

- Short screencasts, animations, or motion visuals that need autoplay /
  loop behavior.

## When NOT to use

- External videos (YouTube, Vimeo) — use an iframe inside an `{.html}`
  block.
- Static imagery — use `{.image}`.

## Properties

- `url`: The video file on OWID's CloudFlare assets host. Must end in
  `.mp4`. Required; without it (or with another file extension) the block
  is dropped.
- `shouldLoop`: Whether the video restarts from the beginning when it
  finishes, written as the word `true` or `false`. Omitted, it plays once.
  Any other value drops the block.
- `shouldAutoplay`: Whether the video starts playing (muted) as soon as it
  is visible, written as the word `true` or `false`. Omitted, the reader
  presses play. Any other value drops the block.
- `filename`: The poster / preview image shown before the video plays —
  same aspect ratio as the video, usually its first frame — registered in
  the images admin. Required; without it the block is dropped.
- `caption`: A line of rich text under the video. Omitted, no caption is
  shown.
- `visibility`: Shows the block in one layout only — `desktop` hides it on
  phones, `mobile` hides it everywhere else. Omitted, the video shows in
  both. Any other value drops the block.
