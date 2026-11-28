import { useState } from "react"
import {
    Slider,
    SliderOutput,
    SliderThumb,
    SliderTrack,
} from "react-aria-components"

const MIN_SPAN_YEARS = 1

/** Two-thumb version of the shared TimeSlider, reusing its styles */
export function TimeRangeSlider({
    min,
    max,
    range,
    onChange,
}: {
    min: number
    max: number
    range: [number, number]
    onChange: (range: [number, number]) => void
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
        </div>
    )
}
