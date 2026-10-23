import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faThumbsDown, faThumbsUp } from "@fortawesome/free-solid-svg-icons"
import type { PanelStore } from "./configureWithAiStore.js"

/** 👍/👎 on an answer, in the side panel and in the overlay */
export function Feedback({
    store,
    feedback,
    prompt = "Was this useful?",
}: {
    store: PanelStore
    feedback: "up" | "down" | undefined
    prompt?: string
}) {
    return (
        <div className="configure-with-ai__feedback">
            <span>{feedback ? "Thanks for the feedback" : prompt}</span>
            <button
                className="configure-with-ai__thumb"
                type="button"
                aria-pressed={feedback === "up"}
                aria-label="Useful"
                onClick={() => store.sendFeedback("up")}
            >
                <FontAwesomeIcon icon={faThumbsUp} />
            </button>
            <button
                className="configure-with-ai__thumb"
                type="button"
                aria-pressed={feedback === "down"}
                aria-label="Not useful"
                onClick={() => store.sendFeedback("down")}
            >
                <FontAwesomeIcon icon={faThumbsDown} />
            </button>
        </div>
    )
}
