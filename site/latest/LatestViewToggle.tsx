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
 * before the cards it governs, at the top of the right-hand column above the
 * newsletter block.
 *
 * Rendered only for the type filters that offer it (see
 * `LATEST_TYPES_WITH_VIEW_TOGGLE`), so its absence is what says "not
 * applicable here" — and hidden below the breakpoint where that column
 * collapses (see the scss).
 */
export const LatestViewToggle = ({
    view,
    onViewChange,
}: {
    view: LatestFeedView
    onViewChange: (view: LatestFeedView) => void
}) => (
    <RadioGroup
        className="latest-view-toggle col-start-11 span-cols-3 col-lg-start-10 span-lg-cols-4"
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
