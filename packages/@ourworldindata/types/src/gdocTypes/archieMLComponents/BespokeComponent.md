---
decision: none
---

A self-contained custom data viz component bundled under
`bespoke/projects/` and embedded via Shadow DOM. Each bundle can
expose multiple variants and accepts a free-form `config` map.
Undocumented in the author reference (developer-facing).

## Properties

- `bundle`: Name of the component in the bespoke component registry.
  Required; without it the block is dropped and reported as a parse
  error, and an unregistered name shows an error message on the page.
- `variant`: A label distinguishing this instance when the same bundle
  is embedded more than once in an article — e.g. a map and a chart
  that share state but render in different places. Passed through to
  the component; omitted, nothing is passed.
- `size`: How wide the component renders — `narrow` (text column),
  `wide` (what you get when it is omitted), or `widest`. Any other
  value drops the block with a parse error.
- `fallbackImageFilename`: Filename of an image (in the image library) to
  show in place of the component when JavaScript is disabled — the
  component itself needs JS to render anything. Omitted, readers without
  JS get the generic "this content requires JavaScript" warning instead.
- `config`: Free-form key–value settings passed to the component,
  authored as a nested `{.config}` … `{}` with one `key: value` line
  per setting. Values must be plain text — nested structures are
  reported as parse errors. What keys mean is up to each bundle;
  omitted, the component receives no settings.
