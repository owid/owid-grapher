import cx from "clsx"

import { ColorBy } from "../core/constants.js"
import { COLOR_SCHEMES } from "../core/colorSchemes.js"

/**
 * The color key for the current "Color by". Clicking a group brings its
 * dots forward and fades the rest; clicking it again clears that.
 */
export function Legend({
    colorBy,
    counts,
    focusedGroup,
    onFocusChange,
}: {
    colorBy: ColorBy
    /** Models per group in view; groups without any are left out */
    counts: ReadonlyMap<string, number>
    focusedGroup?: string
    onFocusChange: (group: string | undefined) => void
}) {
    return (
        <ul className="compute-legend">
            {COLOR_SCHEMES[colorBy].groups
                .filter(({ name }) => counts.get(name))
                .map(({ name, color }) => {
                    const isFocused = name === focusedGroup
                    return (
                        <li key={name}>
                            <button
                                type="button"
                                className={cx("compute-legend__item", {
                                    "compute-legend__item--faded":
                                        focusedGroup !== undefined &&
                                        !isFocused,
                                })}
                                aria-pressed={isFocused}
                                onClick={() =>
                                    onFocusChange(isFocused ? undefined : name)
                                }
                            >
                                <span
                                    className="compute-legend__swatch"
                                    style={{ backgroundColor: color }}
                                />
                                {name}
                            </button>
                        </li>
                    )
                })}
        </ul>
    )
}
