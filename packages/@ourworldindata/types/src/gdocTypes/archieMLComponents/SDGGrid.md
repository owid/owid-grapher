A grid of tiles for the UN Sustainable Development Goals. Legacy
block used on the SDG tracker. Undocumented in the author reference.

## Properties

- `items`: The SDG tiles — the block itself is the list, authored as
  `[.sdg-grid]` … `[]` with a `goal:` (the goal's text shown on the
  tile) and a `link:` line per tile. Both are required on every entry;
  an entry missing either is dropped with a parse error, and an empty
  list drops the whole block. The tile's number and official SDG icon
  come from its position in the list (first tile is SDG 1), so the 17
  goals must be listed in order.
