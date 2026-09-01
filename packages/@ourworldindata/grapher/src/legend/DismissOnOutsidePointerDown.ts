import { useDismissOnOutsidePointerDownOrUnmount } from "../hooks.js"

/**
 * Holds the dismiss-on-outside-pointerdown effect for a colour legend, and
 * renders nothing.
 *
 * The effect lives here rather than in the legends themselves because the
 * legends are also rendered by `renderToStaticMarkup` in the thumbnail worker,
 * where calling a hook throws. Rendering this only when the legend is
 * interactive keeps the hook out of the static export path.
 */
export function DismissOnOutsidePointerDown({
    onDismiss,
}: {
    onDismiss: () => void
}): null {
    useDismissOnOutsidePointerDownOrUnmount(onDismiss)
    return null
}
