import { useState } from "react"
import cx from "clsx"
import {
    Slider,
    SliderOutput,
    SliderThumb,
    SliderTrack,
} from "react-aria-components"

import { TimePreset } from "../core/timeline.js"

const MIN_SPAN_YEARS = 3

/**
 * Two-thumb version of the shared TimeSlider, reusing its styles. The
 * presets sit below as quick jumps to common ranges.
 */
export function TimeRangeSlider({
    min,
    max,
    range,
    onChange,
    presets,
}: {
    min: number
    max: number
    range: [number, number]
    onChange: (range: [number, number]) => void
    presets: TimePreset[]
}) {
    const [isHovering, setIsHovering] = useState(false)

    const handleChange = (values: number | number[]): void => {
        if (!Array.isArray(values)) return
        const [start, end] = values
        // Keep a minimal span so the chart never collapses to nothing,
        // moving whichever thumb the reader is dragging
        if (end - start < MIN_SPAN_YEARS) {
            if (start !== range[0])
                onChange([Math.min(start, end - MIN_SPAN_YEARS), end])
            else onChange([start, Math.max(end, start + MIN_SPAN_YEARS)])
            return
        }
        onChange([start, end])
    }

    return (
        <div className="time-range-slider">
            <div
                className="time-slider"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <button
                    className="time-slider__edge-button"
                    type="button"
                    onClick={() => onChange([min, range[1]])}
                    aria-label={`Start the time range at ${min}`}
                >
                    {range[0]}
                </button>
                <Slider
                    className="time-slider__control"
                    minValue={min}
                    maxValue={max}
                    step={1}
                    value={range}
                    onChange={handleChange}
                    aria-label="Time range"
                >
                    <SliderTrack className="time-slider__track">
                        {({ state }) => (
                            <>
                                <div
                                    className="time-range-slider__fill"
                                    style={{
                                        left: `${state.getThumbPercent(0) * 100}%`,
                                        width: `${(state.getThumbPercent(1) - state.getThumbPercent(0)) * 100}%`,
                                    }}
                                />
                                {[0, 1].map((index) => (
                                    <SliderThumb
                                        key={index}
                                        index={index}
                                        aria-label={
                                            index === 0
                                                ? "Start year"
                                                : "End year"
                                        }
                                        className="time-slider__thumb"
                                        data-active={isHovering || undefined}
                                    >
                                        <div className="time-slider__knob" />
                                        {isHovering && (
                                            <SliderOutput className="time-slider__tooltip">
                                                {() => state.values[index]}
                                            </SliderOutput>
                                        )}
                                    </SliderThumb>
                                ))}
                            </>
                        )}
                    </SliderTrack>
                </Slider>
                <button
                    className="time-slider__edge-button"
                    type="button"
                    onClick={() => onChange([range[0], max])}
                    aria-label={`End the time range at ${max}`}
                >
                    {range[1]}
                </button>
            </div>
            <div className="time-range-slider__presets">
                {presets.map((preset) => {
                    const isActive =
                        preset.range[0] === range[0] &&
                        preset.range[1] === range[1]
                    return (
                        <button
                            key={preset.label}
                            type="button"
                            className={cx("time-range-slider__preset", {
                                "time-range-slider__preset--active": isActive,
                            })}
                            aria-pressed={isActive}
                            onClick={() => onChange(preset.range)}
                        >
                            {preset.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
