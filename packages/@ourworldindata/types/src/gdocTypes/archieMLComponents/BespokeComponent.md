---
decision: none
---

Embeds a bundle: a custom interactive built by the dev team for a
specific piece of content. Pick one from the Bundles list below, open
its page, and copy the block of the variant you want.

## Properties

- `bundle`: Which bundle to embed — one of the bundles listed above.
  Required; without it the block is dropped and reported as a parse
  error, and an unknown name shows an error message on the page.
- `variant`: Which view of the bundle to show. Each bundle lists its
  variants on its page. Required in practice: omitting it shows an
  error message on the page.
- `size`: How wide the component renders — `narrow` (text column),
  `wide` (what you get when it is omitted), or `widest`. Any other
  value drops the block with a parse error.
- `fallbackImageFilename`: Filename of an image (in the image library) to
  show in place of the component when JavaScript is disabled — the
  component itself needs JS to render anything. Omitted, readers without
  JS get the generic "this content requires JavaScript" warning instead.
- `config`: Settings passed to the bundle, authored as a nested
  `{.config}` … `{}` with one `key: value` line per setting. Values
  must be plain text — nested structures are reported as parse errors.
  The keys each bundle accepts are documented on its page; omitted, the
  bundle receives no settings.
