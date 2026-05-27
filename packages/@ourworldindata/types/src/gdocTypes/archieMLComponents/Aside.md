A plaintext caption placed to the right or left of a body paragraph. Useful
for short side notes that shouldn't interrupt the main reading flow.

## When to use

- A short aside or annotation next to a paragraph.

## When NOT to use

- Prefer `{.callout}` when the note needs a title, icon, or rich text.
- Prefer `{.recirc}` when linking to related content.

## Variations

- `position`: `right` (default) | `left`
- Placement in the document matters: put the aside before a paragraph for
  `left`, after the paragraph for `right`.
- `caption` is plaintext only.

### Left-positioned aside

```archie
{.aside}
caption: I will be to the left of the following paragraph.
position: left
{}
```
