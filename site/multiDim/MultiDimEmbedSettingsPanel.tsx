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
        const gap = 8 // Gap between dropdowns as defined in CSS
        const toggleButtonWidth = 88 // Width for "Show more" button

        // Get all dropdown elements
        const dropdowns = Array.from(
            dropdownsContainer.querySelectorAll(".md-settings__dropdown")
        ) as HTMLDivElement[]

        const availableWidth = containerWidth - containerPadding

        // First, try to fit all dropdowns without toggle button
        let totalWidthAllDropdowns = 0
        for (let i = 0; i < dropdowns.length; i++) {
            const dropdownWidth = dropdowns[i].offsetWidth
            totalWidthAllDropdowns += dropdownWidth
            if (i > 0) totalWidthAllDropdowns += gap
        }

        if (totalWidthAllDropdowns <= availableWidth) {
            // All dropdowns fit without toggle button
            setCollapsedCount(dropdowns.length)
            return
        }

        // Not all dropdowns fit, so we need toggle button
        // Try to fit as many as possible with toggle button space reserved
        let totalWidth = 0
        let fittingDropdowns = 0
        const availableWidthWithToggle = availableWidth - toggleButtonWidth

        for (let i = 0; i < dropdowns.length; i++) {
            const dropdownWidth = dropdowns[i].offsetWidth
            const widthWithGap = i === 0 ? dropdownWidth : dropdownWidth + gap

            if (totalWidth + widthWithGap <= availableWidthWithToggle) {
                totalWidth += widthWithGap
                fittingDropdowns++
            } else {
                break
            }
        }

        // Ensure at least 1 dropdown is visible if there are any
        fittingDropdowns = Math.max(1, fittingDropdowns)

        setCollapsedCount(fittingDropdowns)
    }, [dimensionsArray.length, isSmallScreen])

    useResizeObserver({
        ref: containerRef,
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
