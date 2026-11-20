// More than the width of a classic (non-overlay) scrollbar, which is at most
// 17px.
export const TOGGLE_BUTTONS_FIT_SLACK = 20

/**
 * Whether a dimension's toggle buttons should be shown (rather than the
 * dropdown they fall back to), given the width they need and the width of
 * the controls row.
 *
 * Toggle buttons that are showing stay for as long as they fit. Once they've
 * given way to the dropdown, they only come back when they fit with some
 * slack. Without the slack the control could flip back and forth: the two
 * controls differ in width, so switching can change how the row wraps and
 * with it the page height, which can show or hide a scrollbar and change the
 * available width by the scrollbar's width.
 */
export function fitsAsToggleButtons({
    showsToggleButtons,
    requiredWidth,
    availableWidth,
}: {
    /** What is showing right now */
    showsToggleButtons: boolean
    requiredWidth: number | undefined
    availableWidth: number | undefined
}): boolean {
    // Keep what is showing until both widths are known, including during SSR.
    if (requiredWidth === undefined || !availableWidth)
        return showsToggleButtons
    const slack = showsToggleButtons ? 0 : TOGGLE_BUTTONS_FIT_SLACK
    return requiredWidth + slack <= availableWidth
}
