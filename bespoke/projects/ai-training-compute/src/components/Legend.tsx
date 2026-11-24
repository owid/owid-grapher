import cx from "clsx"

import { ColorScheme } from "../core/constants.js"
import {
    COLOR_SCHEME_DEFINITIONS,
    getGroupColor,
} from "../core/colorSchemes.js"
import { COMPUTER_KIND_LABELS, ComputerKind } from "../core/computers.js"
import { ComputerMarker } from "./ComputeScatter.js"

/**
 * Color key for the current scheme. Clicking a group focuses it, clicking
 * again clears. When computers are shown, a second row keys their shapes.
 */
export function Legend({
    colorScheme,
    counts,
    focusedGroup,
    onFocusChange,
    computerKinds,
}: {
    colorScheme: ColorScheme
    counts: Map<string, number>
    focusedGroup?: string
    onFocusChange: (group: string | undefined) => void
    computerKinds: ComputerKind[]
}) {
    const definition = COLOR_SCHEME_DEFINITIONS[colorScheme]
    return (
        <div className="ai-legend">
            <p className="ai-legend__title">{definition.legendTitle}</p>
            <ul className="ai-legend__items">
                {definition.groups
                    .filter((group) => counts.get(group))
                    .map((group) => {
                        const isFocused = group === focusedGroup
                        return (
                            <li key={group}>
                                <button
                                    type="button"
                                    className={cx("ai-legend__item", {
                                        "ai-legend__item--faded":
                                            focusedGroup !== undefined &&
                                            !isFocused,
                                    })}
                                    aria-pressed={isFocused}
                                    onClick={() =>
                                        onFocusChange(
                                            isFocused ? undefined : group
                                        )
                                    }
                                >
                                    <span
                                        className="ai-legend__swatch"
                                        style={{
                                            backgroundColor: getGroupColor(
                                                colorScheme,
                                                group
                                            ),
                                        }}
                                    />
                                    {group}
                                </button>
                            </li>
                        )
                    })}
            </ul>
            {computerKinds.length > 0 && (
                <ul className="ai-legend__items ai-legend__items--computers">
                    {computerKinds.map((kind) => (
                        <li key={kind} className="ai-legend__computer">
                            <svg width={14} height={14} aria-hidden>
                                <ComputerMarker kind={kind} x={7} y={7} />
                            </svg>
                            {COMPUTER_KIND_LABELS[kind]}
                        </li>
                    ))}
                    <li className="ai-legend__computer-note">
                        Computers are shown at the computation they do running
                        flat out for one month
                    </li>
                </ul>
            )}
        </div>
    )
}
