import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPause, faPlay } from "@fortawesome/free-solid-svg-icons"

import { TimeSlider } from "../../../../components/TimeSlider/TimeSlider.js"

interface TimelineProps {
    years: number[]
    year: number
    isPlaying: boolean
    onChange: (year: number) => void
    onTogglePlay: () => void
}

/** Grapher's timeline: a play button and the shared year slider */
export function Timeline({
    years,
    year,
    isPlaying,
    onChange,
    onTogglePlay,
}: TimelineProps): React.ReactElement {
    return (
        <div className="dd-timeline">
            <button
                type="button"
                className="dd-timeline__play"
                aria-label={isPlaying ? "Pause" : "Play the time series"}
                onClick={onTogglePlay}
            >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            <TimeSlider times={years} selectedTime={year} onChange={onChange} />
        </div>
    )
}
