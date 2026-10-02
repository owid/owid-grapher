import { useCallback, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faGear, faXmark } from "@fortawesome/free-solid-svg-icons"
import { LabeledSwitch } from "@ourworldindata/components"

import { LabeledControl } from "../../../../components/Controls/Controls.js"

import { SMALL_COUNTRY_POP } from "../core/constants.js"
import { useDismiss } from "./Popover.js"

interface SettingsMenuProps {
    sizeByPopulation: boolean
    showSmallCountries: boolean
    onSizeByPopulation: (value: boolean) => void
    onShowSmallCountries: (value: boolean) => void
}

/** Grapher's settings menu, with the two switches this chart has */
export function SettingsMenu({
    sizeByPopulation,
    showSmallCountries,
    onSizeByPopulation,
    onShowSmallCountries,
}: SettingsMenuProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const close = useCallback(() => setIsOpen(false), [])
    useDismiss(containerRef, isOpen, close)
    const threshold = SMALL_COUNTRY_POP.toLocaleString("en-US")

    return (
        <LabeledControl label={" "} className="dd-settings-menu">
            <div
                ref={containerRef}
                className="dd-popover-anchor dd-popover-anchor--right"
            >
                <button
                    type="button"
                    className={cx("dd-menu-toggle", { active: isOpen })}
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen((open) => !open)}
                >
                    <FontAwesomeIcon icon={faGear} />
                    <span>Settings</span>
                </button>
                {isOpen && (
                    <div
                        className="dd-settings-popover"
                        role="dialog"
                        aria-label="Chart settings"
                    >
                        <div className="dd-settings-popover__header">
                            <span className="dd-settings-popover__title">
                                Chart settings
                            </span>
                            <button
                                type="button"
                                className="dd-settings-popover__close"
                                aria-label="Close"
                                onClick={close}
                            >
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>
                        <div className="dd-settings-popover__content">
                            <section>
                                <div className="dd-settings-popover__name">
                                    Bubble size
                                </div>
                                <div className="dd-settings-popover__subtitle">
                                    Size each country's bubble by its
                                    population, as in our scatter charts, or
                                    draw every country the same size
                                </div>
                                <LabeledSwitch
                                    label="Size bubbles by population"
                                    value={sizeByPopulation}
                                    onToggle={() =>
                                        onSizeByPopulation(!sizeByPopulation)
                                    }
                                />
                            </section>
                            <section>
                                <div className="dd-settings-popover__name">
                                    Small countries
                                </div>
                                <div className="dd-settings-popover__subtitle">
                                    Countries with fewer than {threshold} people
                                    are hidden by default: their estimates are
                                    noisier and they crowd the chart without
                                    changing the picture
                                </div>
                                <LabeledSwitch
                                    label={`Show countries with fewer than ${threshold} people`}
                                    value={showSmallCountries}
                                    onToggle={() =>
                                        onShowSmallCountries(
                                            !showSmallCountries
                                        )
                                    }
                                />
                            </section>
                        </div>
                    </div>
                )}
            </div>
        </LabeledControl>
    )
}
