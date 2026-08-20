---
pinned:
    - slug: the-median-age-in-china-has-rapidly-caught-up-with-the-united-kingdom
---

A static image uploaded to the OWID admin. The `filename` must match an
image registered in the admin (where default alt text is also set).

```archie
{.image}
filename: romania-maternal-mortality-abortions.png
{}
```

## When to use

- Photographs, illustrations, diagrams, and static (non-interactive)
  visuals.
- Static grapher exports where the reader doesn't need to interact with
  the chart — consider `hasOutline: true` for clean white-background
  screenshots so they read as visuals rather than floating artwork.

## When NOT to use

- Interactive charts — use `{.chart}` or `{.narrative-chart}`.
- Flagship data visualizations with metadata — use `{.static-viz}`.
- Videos — use `{.video}`.

## Properties

- `filename`: The image to show, matching a file uploaded to the admin.
  Required; a filename with no matching upload renders nothing.
- `smallFilename`: A second upload used on phones, usually a tighter crop.
  Omitted, the main file is used at every width. Despite the name, keep it
  at least 1600px wide for high-density displays.
- `alt`: Alt text for screen readers and for readers whose images fail to
  load. Omitted, the alt text set on the upload is used — prefer setting
  it there, and use this only to make a context-specific point.
- `caption`: A line of text under the image. Omitted, the image is shown
  without one.
- `size`: How wide the image sits. `wide` (what you get when it is
  omitted) is a little wider than the body text, `narrow` matches the text
  column and suits especially tall images, `widest` spans the full page.
- `hasOutline`: Draws a hairline border around the image. On unless you set
  `hasOutline: false` — do that for artwork that already has its own
  edges, keep it for screenshots and white-background exports so they read
  as visuals rather than floating on the page.
- `visibility`: Shows the block in one layout only — `desktop` hides it on
  phones, `mobile` hides it everywhere else. Omitted, the image shows in
  both.
- `originalWidth`: Not authored — filled in from the uploaded file.
- `preferSmallFilename`: Not authored — set by the site for older data
  insights, which always use their `smallFilename`.

## Notes

Pair two image blocks with opposite `visibility` to serve a different crop
per layout.
