import cx from "classnames"
import { useMemo, useState, useRef, useCallback } from "react"
import { useMediaQuery, useResizeObserver } from "usehooks-ts"

import { MultiDimDimensionChoices } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { useResolvedSettings } from "./multiDimSettings.js"
import MultiDimDropdowns from "./MultiDimDropdowns.js"

export default function MultiDimEmbedSettingsPanel({
    className,
    config,
    settings,
    onChange,
}: {
    className?: string
    config: MultiDimDataPageConfig
    settings: MultiDimDimensionChoices
    onChange: (settings: MultiDimDimensionChoices) => void
}) {
    const { dimensions } = config
    const resolvedSettings = useResolvedSettings(settings, dimensions)
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownsRef = useRef<HTMLDivElement>(null)

    const availableSettings = useMemo(() => {
        return config.filterToAvailableChoices(resolvedSettings)
            .dimensionsWithAvailableChoices
    }, [resolvedSettings, config])

    const dimensionsArray = useMemo(() => {
        return Object.values(availableSettings)
    }, [availableSettings])

    const [collapsedCount, setCollapsedCount] = useState(dimensionsArray.length)

    const calculateCollapsedCount = useCallback(() => {
        if (isSmallScreen) {
            const length = dimensionsArray.length
            setCollapsedCount(length > 3 ? 2 : length)
            return
        }

        const container = containerRef.current
        const dropdownsContainer = dropdownsRef.current
        if (!container || !dropdownsContainer) return

        const containerWidth = container.offsetWidth
        const containerPadding = 32 // 16px on each side
        const buffer = 5 // For some reason the numbers don't add up precisely
        const availableWidth = containerWidth - containerPadding - buffer
        const gap = 8 // Gap between dropdowns (and also toggle button) as defined in CSS
        const toggleButtonWidth = 90

        const dropdowns = Array.from(
            dropdownsContainer.querySelectorAll(".md-settings__dropdown")
        ) as HTMLDivElement[]

        // First, try to fit all dropdowns without toggle button
        let totalWidthAllDropdowns = 0
        for (let i = 0; i < dropdowns.length; i++) {
            const dropdownWidth = dropdowns[i].offsetWidth
            totalWidthAllDropdowns += dropdownWidth
            if (i > 0) totalWidthAllDropdowns += gap
        }

        let newCollapsedCount: number
        if (totalWidthAllDropdowns <= availableWidth) {
            // All dropdowns fit without toggle button
            newCollapsedCount = dropdowns.length
        } else {
            // Not all dropdowns fit, so we need toggle button
            // Try to fit as many as possible with toggle button space reserved
            let totalWidth = 0
            let fittingDropdowns = 0
            const availableWidthWithToggle = availableWidth - toggleButtonWidth

            for (const dropdown of dropdowns) {
                // We always add the gap, because it exists also between the
                // last dropdown and the toggle button.
                const dropdownWidth = dropdown.offsetWidth + gap
                const totalWidthWithThisDropdown = totalWidth + dropdownWidth
                if (totalWidthWithThisDropdown <= availableWidthWithToggle) {
                    totalWidth = totalWidthWithThisDropdown
                    fittingDropdowns++
                } else {
                    break
                }
            }

            // Ensure at least 1 dropdown is visible if there are any
            newCollapsedCount = Math.max(1, fittingDropdowns)
        }

        setCollapsedCount(newCollapsedCount)
    }, [dimensionsArray.length, isSmallScreen])

    useResizeObserver({
        ref: containerRef as React.RefObject<HTMLDivElement>,
        onResize: calculateCollapsedCount,
    })

    return (
        <div className={cx("md-embed-settings", className)} ref={containerRef}>
            <div className="h6-black-caps md-embed-settings__header">
                Configure the data
            </div>
            <MultiDimDropdowns
                ref={dropdownsRef}
                availableSettings={availableSettings}
                resolvedSettings={resolvedSettings}
                onChange={onChange}
                collapsedCount={collapsedCount}
            />
        </div>
    )
}
