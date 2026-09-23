import { useState } from "react"
import cx from "clsx"
import {
    Slider,
    SliderTrack,
    SliderThumb,
    SliderOutput,
} from "react-aria-components"

import { Time } from "@ourworldindata/types"

export function TimeSlider({
    times,
    selectedTime,
    onChange,
    formatTime = (time: Time) => time.toString(),
    className,
    showEdgeLabels = true,
    highlightedRange,
    isDisabled = false,
}: {
    times: Time[]
    selectedTime: Time
    onChange: (time: Time) => void
    formatTime?: (time: Time) => string
    className?: string
    showEdgeLabels?: boolean
    /** An inclusive span of `times` to mark on the track instead of a single
     *  selected time; the thumb is hidden while it is set. For when the chart
     *  covers a period the reader can't move, so the slider shows which one. */
    highlightedRange?: [Time, Time]
    isDisabled?: boolean
}) {
    const [isHovering, setIsHovering] = useState(false)

    if (!times.length) return null

    const minTime = times[0]
    const maxTime = times[times.length - 1]

    const selectedIndex = times.indexOf(selectedTime)
    const value = selectedIndex === -1 ? 0 : selectedIndex

    const isInteractive = !isDisabled && !highlightedRange

    return (
        <div
            className={cx("time-slider", className, {
                "time-slider--disabled": isDisabled,
            })}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {showEdgeLabels && (
                <button
                    className="time-slider__edge-button"
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onChange(minTime)}
                >
                    {formatTime(minTime)}
                </button>
            )}

            <Slider
                className="time-slider__control"
                minValue={0}
                maxValue={times.length - 1}
                step={1}
                value={value}
                onChange={(i: number) => onChange(times[i])}
                aria-label="Time"
                isDisabled={isDisabled}
            >
                <SliderTrack className="time-slider__track">
                    {highlightedRange && (
                        <RangeMarker
                            times={times}
                            range={highlightedRange}
                            formatTime={formatTime}
                        />
                    )}
                    {!highlightedRange && (
                        <SliderThumb
                            className="time-slider__thumb"
                            data-active={
                                (isInteractive && isHovering) || undefined
                            }
                        >
                            <div className="time-slider__knob" />
                            {isInteractive && isHovering && (
                                <SliderOutput className="time-slider__tooltip">
                                    {({ state }) =>
                                        formatTime(times[state.values[0]])
                                    }
                                </SliderOutput>
                            )}
                        </SliderThumb>
                    )}
                </SliderTrack>
            </Slider>

            {showEdgeLabels && (
                <button
                    className="time-slider__edge-button"
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onChange(maxTime)}
                >
                    {formatTime(maxTime)}
                </button>
            )}
        </div>
    )
}

/**
 * A span of `times` marked on the track the way a two-handled timeline shows
 * a selection: a knob at each end and the track between them filled in.
 */
function RangeMarker({
    times,
    range: [start, end],
    formatTime,
}: {
    times: Time[]
    range: [Time, Time]
    formatTime: (time: Time) => string
}): React.ReactElement {
    const lastIndex = Math.max(times.length - 1, 1)
    const toPercent = (time: Time): number => {
        const index = times.indexOf(time)
        // A time outside `times` clamps to the nearest end
        const clamped = index === -1 ? (time < times[0] ? 0 : lastIndex) : index
        return (clamped / lastIndex) * 100
    }
    const left = toPercent(start)
    const right = toPercent(end)

    return (
        <div
            className="time-slider__range"
            role="img"
            aria-label={`${formatTime(start)} to ${formatTime(end)}`}
        >
            <div
                className="time-slider__range-fill"
                style={{
                    left: `${left}%`,
                    width: `${Math.max(right - left, 0)}%`,
                }}
            />
            <div
                className="time-slider__range-knob"
                style={{ left: `${left}%` }}
            />
            <div
                className="time-slider__range-knob"
                style={{ left: `${right}%` }}
            />
        </div>
    )
}
