import {
    Label,
    RadioButton,
    RadioField,
    RadioGroup,
} from "react-aria-components"
import { LATEST_FEED_VIEWS, LatestFeedView } from "./latestUtils.js"

const VIEW_LABELS: Record<LatestFeedView, string> = {
    expanded: "Expanded",
    compact: "Compact",
}

/**
 * "View: Expanded / Compact" radio row. A grid item of its own, rendered
 * before the cards it governs: on desktop it sits at the top of the
 * right-hand column, above the newsletter block; on mobile that column
 * collapses and it stays at the top of the page, above the first card.
 *
 * Rendered only for the type filters that offer it (see
 * `LATEST_TYPES_WITH_VIEW_TOGGLE`), so its absence is what says "not
 * applicable here".
 *
 * Below the sidebar column it takes the column the cards and filters use,
 * not the newsletter block's full-bleed placement — bare text has no padding
 * of its own to keep it off the edge of the viewport.
 */
export const LatestViewToggle = ({
    view,
    onViewChange,
}: {
    view: LatestFeedView
    onViewChange: (view: LatestFeedView) => void
}) => (
    <RadioGroup
        className="latest-view-toggle col-start-11 span-cols-3 col-lg-start-10 span-lg-cols-4 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"
        orientation="horizontal"
        value={view}
        onChange={(value) => onViewChange(value as LatestFeedView)}
    >
        <Label className="latest-view-toggle__label h6-black-caps">View:</Label>
        {LATEST_FEED_VIEWS.map((value) => (
            <RadioField
                key={value}
                value={value}
                className="latest-view-toggle__field"
            >
                <RadioButton className="latest-view-toggle__option note-12-medium">
                    <span className="latest-view-toggle__radio" />
                    {VIEW_LABELS[value]}
                </RadioButton>
            </RadioField>
        ))}
    </RadioGroup>
)
