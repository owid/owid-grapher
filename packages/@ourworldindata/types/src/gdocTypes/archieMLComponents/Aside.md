A plaintext caption placed to the right or left of a body paragraph. Useful
for short side notes that shouldn't interrupt the main reading flow.

```archie
{.aside}
caption: I will be to the left of the following paragraph.
position: left
{}
```

## When to use

- A short aside or annotation next to a paragraph.

## When NOT to use

- Prefer `{.callout}` when the note needs a title, icon, or rich text.
- Prefer `{.recirc}` when linking to related content.

## Properties

- `caption`: The note itself. Plaintext only — formatting and links are
  not rendered. Required; without it the block is dropped.
- `position`: Which margin the note sits in, `right` (what you get when it
  is omitted) or `left`. Placement in the document matters: put the block
  before the paragraph for a left aside, after it for a right one. On
  narrow screens both sit in the text column, in document order.
