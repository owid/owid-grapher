import React, { useState, useRef, useEffect, useCallback } from "react"
import { Time } from "@ourworldindata/types"
import { getRelativeMouse } from "@ourworldindata/utils"
import cx from "classnames"
import "./CausesOfDeathTimeSlider.scss"

export interface CausesOfDeathTimeSliderProps {
    years: Time[]
    selectedYear: Time
    onChange: (year: Time) => void
    isLoading?: boolean
    className?: string
}

export function CausesOfDeathTimeSlider({
    years,
    selectedYear,
    onChange,
    className,
    isLoading = false,
}: CausesOfDeathTimeSliderProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isHovering, setIsHovering] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)
    const sliderRef = useRef<HTMLDivElement>(null)

    const minYear = years.length > 0 ? Math.min(...years) : 0
    const maxYear = years.length > 0 ? Math.max(...years) : 0

    // Calculate progress (0-1) for the selected year
    const selectedProgress = (selectedYear - minYear) / (maxYear - minYear)

    // Get input time from mouse position
    const getInputTimeFromMouse = useCallback(
        (event: MouseEvent | TouchEvent): number | undefined => {
            if (!sliderRef.current) return
            const mouseX = getRelativeMouse(sliderRef.current, event).x
            const rect = sliderRef.current.getBoundingClientRect()
            const fracWidth = mouseX / rect.width
            return minYear + fracWidth * (maxYear - minYear)
        },
        [minYear, maxYear]
    )

    // Handle mouse/touch events
    const handleMouseDown = useCallback(
        (event: React.MouseEvent | React.TouchEvent) => {
            event.preventDefault()
            setIsDragging(true)
            setShowTooltip(true)

            const inputTime = getInputTimeFromMouse(
                event.nativeEvent as MouseEvent | TouchEvent
            )
            if (inputTime) {
                const closestYear = years.reduce((prev, curr) =>
                    Math.abs(curr - inputTime) < Math.abs(prev - inputTime)
                        ? curr
                        : prev
                )
                onChange(closestYear)
            }
        },
        [getInputTimeFromMouse, years, onChange]
    )

    const handleMouseMove = useCallback(
        (event: MouseEvent | TouchEvent) => {
            if (!isDragging) return

            const inputTime = getInputTimeFromMouse(event)
            if (inputTime) {
                const closestYear = years.reduce((prev, curr) =>
                    Math.abs(curr - inputTime) < Math.abs(prev - inputTime)
                        ? curr
                        : prev
                )
                onChange(closestYear)
            }
        },
        [isDragging, getInputTimeFromMouse, years, onChange]
    )

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        // Keep tooltip visible only if still hovering
        if (!isHovering) {
            setShowTooltip(false)
        }
    }, [isHovering])

    // Handle edge marker clicks
    const handleEdgeClick = useCallback(
        (year: Time) => {
            onChange(year)
        },
        [onChange]
    )

    // Add global mouse events for dragging
    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove)
            document.addEventListener("mouseup", handleMouseUp)
            document.addEventListener("touchmove", handleMouseMove)
            document.addEventListener("touchend", handleMouseUp)

            return () => {
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
                document.removeEventListener("touchmove", handleMouseMove)
                document.removeEventListener("touchend", handleMouseUp)
            }
        }
        return undefined
    }, [isDragging, handleMouseMove, handleMouseUp])

    if (!years.length) return null

    return (
        <div
            className={cx("causes-of-death-time-slider", className, {
                "causes-of-death-time-slider--loading": isLoading,
                hover: isHovering,
            })}
            onMouseEnter={() => {
                setIsHovering(true)
                setShowTooltip(true)
            }}
            onMouseLeave={() => {
                setIsHovering(false)
                // Hide tooltip only if not dragging
                if (!isDragging) {
                    setShowTooltip(false)
                }
            }}
        >
            <button
                className="date"
                type="button"
                onClick={() => handleEdgeClick(minYear)}
                disabled={isLoading}
            >
                {minYear}
            </button>

            <div
                ref={sliderRef}
                className="slider"
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                <div
                    className="handle"
                    style={{ left: `${selectedProgress * 100}%` }}
                >
                    <div className="icon" />
                    <div
                        className="causes-of-death-time-slider__tooltip"
                        style={{ display: showTooltip ? "block" : "none" }}
                    >
                        {selectedYear}
                    </div>
                </div>
            </div>

            <button
                className="date"
                type="button"
                onClick={() => handleEdgeClick(maxYear)}
                disabled={isLoading}
            >
                {maxYear}
            </button>
        </div>
    )
}
