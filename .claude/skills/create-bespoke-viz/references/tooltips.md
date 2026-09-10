# Tooltips

Two kinds, with different tooling.

## Data tooltips (hovering chart marks)

Build on Grapher's tooltip primitives rather than your own chrome: `TooltipCard` (`@ourworldindata/grapher/src/tooltip/TooltipCard.js`) with `TooltipValue`/`TooltipTable` rows inside. Its `Tooltip.scss` comes in via the copied `grapher.scss`. `causes-of-death/src/components/CausesOfDeathTreemap.tsx` and its `CausesOfDeathTreemapTooltip.tsx` are the worked example of the wiring — hover state plus a `position` updated with `getRelativeMouse`, and the chart's `containerBounds` passed down so the card flips and clamps instead of overflowing.

Two rules the code alone won't explain:

- **Touch devices don't hover.** `usePinnedTooltip(isActive, onDismiss)` returns `isPinned` (true on touch) and a `ref` for the chart container — without that ref attached it silently never dismisses. When pinned it owns dismissal, so bail out of your own mouse-leave logic (`if (isTouchDevice()) return`), and render the card with `anchor={GrapherTooltipAnchor.Bottom}` and **no** `containerBounds`, so it sits fixed at the bottom of the viewport instead of following a cursor that doesn't exist.
- If the pointer crosses gaps between adjacent marks (treemap tiles, say), delay hover-out ~200 ms before clearing the target, cancelled on re-enter, so the tooltip doesn't flicker. For contiguous marks, clearing on `mouseleave` is fine.

Content conventions: title is the hovered mark or series, subtitle adds context, `TooltipValue` rows take the mark's `color`.

## UI tooltips (info icons, "why is this control disabled")

`Tippy` from `@ourworldindata/utils`, with `useTippyContainer()`'s `getTippyContainer` as `appendTo` — see [styling.md](styling.md#portals). Bundle tippy's CSS and theme in `index.scss`.
