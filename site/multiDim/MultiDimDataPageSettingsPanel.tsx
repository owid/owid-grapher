import cx from "classnames"
import { useMemo } from "react"
import { useMediaQuery } from "usehooks-ts"

import { MultiDimDimensionChoices } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { useResolvedSettings } from "./multiDimSettings.js"
import MultiDimDropdowns from "./MultiDimDropdowns.js"

export const MultiDimSettingsPanel = ({
    className,
    config,
    settings,
    onChange,
}: {
    className?: string
    config: MultiDimDataPageConfig
    settings: MultiDimDimensionChoices
    onChange: (settings: MultiDimDimensionChoices) => void
}) => {
    const { dimensions } = config
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const resolvedSettings = useResolvedSettings(settings, dimensions)

    const availableSettings = useMemo(() => {
        return config.filterToAvailableChoices(resolvedSettings)
            .dimensionsWithAvailableChoices
    }, [resolvedSettings, config])

    let collapsedCount = Number.POSITIVE_INFINITY
    if (isSmallScreen) {
        const length = Object.values(availableSettings).length
        collapsedCount = length > 3 ? 2 : length
    }

    return (
        <div className={cx("md-settings-row", className)}>
            <div className="h5-black-caps md-settings__configure-data">
                Configure the data
            </div>
            <MultiDimDropdowns
                className="md-settings__dropdowns"
                availableSettings={availableSettings}
                resolvedSettings={resolvedSettings}
                onChange={onChange}
                collapsedCount={collapsedCount}
            />
        </div>
    )
}
