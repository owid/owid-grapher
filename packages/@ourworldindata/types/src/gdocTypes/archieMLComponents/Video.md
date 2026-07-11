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

## Notes

`filename` is the poster / preview image (same aspect ratio as the
video, usually the first frame) and must be registered in the images
admin.
