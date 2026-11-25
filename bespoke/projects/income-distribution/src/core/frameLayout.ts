import type { FrameEditCountriesMode, FrameLegendMode } from "./presentation.js"
import type { View } from "./types.js"

/**
 * Top of the overlays over the plot without the button, and the gap between
 * them (.income-distribution-captioned-chart__overlays in
 * IncomeDistributionFrame.scss)
 */
const OVERLAY_TOP = 38
const OVERLAY_GAP = 8

export interface FrameLayoutInput {
    legend: FrameLegendMode
    editCountries: FrameEditCountriesMode
    view: View
    povertyLine: number | null
    isNarrow: boolean
    /** Countries view with nothing to draw */
    hasNoCountries: boolean
    /** Countries view: some country couldn't be labelled on its curve */
    hasUnlabelled: boolean
    /** Bottom of the "Edit countries" button over the plot, when it's there and measured */
    editCountriesBottom: number | undefined
}

export interface FrameLayout {
    /** The legend floating over the plot's top-right corner (wide charts) */
    showOverlayLegend: boolean
    /** The legend in the row above the plot (narrow charts) */
    showInlineLegend: boolean
    /**
     * Countries view without a line on a wide chart: the overlay legend only
     * appears when a country couldn't be labelled, and then lists every one
     */
    listsLeftovers: boolean
    /** Where that legend starts, in px from the chart area's top; undefined unless listsLeftovers */
    leftoverLegendTop: number | undefined
    /** "Edit countries" anywhere at all */
    showEditCountries: boolean
    /** "Edit countries" as a button over the plot's corner (wide charts) */
    showOverlayEditCountries: boolean
    /** "Edit countries" as a link at the overlay legend's foot */
    showLegendEditCountries: boolean
    /** The row above the plot holding the inline legend and the button (narrow charts) */
    showToolbar: boolean
}

/**
 * Where the frame puts the legend and "Edit countries" for the chart's width
 * and state. On wide charts the legend floats over the plot's top-right
 * corner and turns into the share bars when a poverty line is set, so setting
 * a line never pushes the plot down; narrow charts keep it above the plot,
 * where it doesn't cover the mountains. In the countries view the curves are
 * labelled directly, so without a line the overlay legend only shows when
 * some country couldn't be labelled. Wide charts put the button over the
 * plot's top-right corner, above the overlay legend; narrow ones keep it in
 * the row above the plot; in the legend, it's a link at the legend's foot.
 */
export function resolveFrameLayout({
    legend,
    editCountries,
    view,
    povertyLine,
    isNarrow,
    hasNoCountries,
    hasUnlabelled,
    editCountriesBottom,
}: FrameLayoutInput): FrameLayout {
    const showEditCountries = view === "countries" && editCountries !== "hidden"
    const showOverlayLegend =
        !isNarrow &&
        !hasNoCountries &&
        legend !== "hidden" &&
        (legend === "swatches" ||
            view === "global" ||
            povertyLine !== null ||
            hasUnlabelled)
    const listsLeftovers =
        legend === "auto" &&
        view === "countries" &&
        povertyLine === null &&
        !isNarrow
    // Below the button, else below the poverty line's label
    const leftoverLegendTop = listsLeftovers
        ? editCountriesBottom !== undefined
            ? editCountriesBottom + OVERLAY_GAP
            : OVERLAY_TOP
        : undefined
    const showInlineLegend = isNarrow && !hasNoCountries && legend !== "hidden"
    return {
        showOverlayLegend,
        showInlineLegend,
        listsLeftovers,
        leftoverLegendTop,
        showEditCountries,
        showOverlayEditCountries:
            showEditCountries && !isNarrow && editCountries === "auto",
        showLegendEditCountries:
            showEditCountries && !isNarrow && editCountries === "legend",
        showToolbar: isNarrow && (showInlineLegend || showEditCountries),
    }
}
