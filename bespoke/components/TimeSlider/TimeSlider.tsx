import React, { useState, useRef, useEffect, useCallback } from "react"
import cx from "classnames"

import { Time } from "@ourworldindata/types"
import { getRelativeMouse } from "@ourworldindata/utils"

export function TimeSlider({
    times,
    selectedTime,
    onChange,
    className,
}: {
    times: Time[]
    selectedTime: Time
    onChange: (time: Time) => void
    className?: string
}) {
    const [isDragging, setIsDragging] = useState(false)
    const [isHovering, setIsHovering] = useState(false)
    const [showTooltip, setShowTooltip] = useState(false)
    const sliderRef = useRef<HTMLDivElement>(null)

    const minTime = times.length > 0 ? Math.min(...times) : 0
    const maxTime = times.length > 0 ? Math.max(...times) : 0

    // Calculate progress (0-1) for the selected time
    const selectedProgress = (selectedTime - minTime) / (maxTime - minTime)

    // Get input time from mouse position
    const getInputTimeFromMouse = useCallback(
        (event: MouseEvent | TouchEvent): number | undefined => {
            if (!sliderRef.current) return
            const mouseX = getRelativeMouse(sliderRef.current, event).x
            const rect = sliderRef.current.getBoundingClientRect()
            const fracWidth = mouseX / rect.width
            return minTime + fracWidth * (maxTime - minTime)
        },
        [minTime, maxTime]
    )

    // Handle mouse/touch events
    const handleMouseDown = useCallback(
        (event: React.MouseEvent | React.TouchEvent) => {
            event.preventDefault()
            setIsDragging(true)
            setShowTooltip(true)

            const inputTime = getInputTimeFromMouse(event.nativeEvent)
            if (inputTime) {
                const closestTime = times.reduce((prev, curr) =>
                    Math.abs(curr - inputTime) < Math.abs(prev - inputTime)
                        ? curr
                        : prev
                )
                onChange(closestTime)
            }
        },
        [getInputTimeFromMouse, times, onChange]
    )

    const handleMouseMove = useCallback(
        (event: MouseEvent | TouchEvent) => {
            if (!isDragging) return

            const inputTime = getInputTimeFromMouse(event)
            if (inputTime) {
                const closestTime = times.reduce((prev, curr) =>
                    Math.abs(curr - inputTime) < Math.abs(prev - inputTime)
                        ? curr
                        : prev
                )
                onChange(closestTime)
            }
        },
        [isDragging, getInputTimeFromMouse, times, onChange]
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

    if (!times.length) return null

    return (
        <div
            className={cx("time-slider", className, { hover: isHovering })}
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
                onClick={() => handleEdgeClick(minTime)}
            >
                {minTime}
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
                        className="time-slider__tooltip"
                        style={{ display: showTooltip ? "block" : "none" }}
                    >
                        {selectedTime}
                    </div>
                </div>
            </div>

            <button
                className="date"
                type="button"
                onClick={() => handleEdgeClick(maxTime)}
            >
                {maxTime}
            </button>
        </div>
    )
}
