import { useState } from "react"
import cx from "classnames"
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
}: {
    times: Time[]
    selectedTime: Time
    onChange: (time: Time) => void
    formatTime?: (time: Time) => string
    className?: string
    showEdgeLabels?: boolean
}) {
    const [isHovering, setIsHovering] = useState(false)

    if (!times.length) return null

    const minTime = times[0]
    const maxTime = times[times.length - 1]

    const selectedIndex = times.indexOf(selectedTime)
    const value = selectedIndex === -1 ? 0 : selectedIndex

    return (
        <div
            className={cx("time-slider", className)}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {showEdgeLabels && (
                <button
                    className="time-slider__edge-button"
                    type="button"
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
            >
                <SliderTrack className="time-slider__track">
                    <SliderThumb
                        className="time-slider__thumb"
                        data-active={isHovering || undefined}
                    >
                        <div className="time-slider__knob" />
                        {isHovering && (
                            <SliderOutput className="time-slider__tooltip">
                                {({ state }) =>
                                    formatTime(times[state.values[0]])
                                }
                            </SliderOutput>
                        )}
                    </SliderThumb>
                </SliderTrack>
            </Slider>

            {showEdgeLabels && (
                <button
                    className="time-slider__edge-button"
                    type="button"
                    onClick={() => onChange(maxTime)}
                >
                    {formatTime(maxTime)}
                </button>
            )}
        </div>
    )
}
