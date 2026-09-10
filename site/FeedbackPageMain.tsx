import { createRoot } from "react-dom/client"
import { FeedbackForm } from "./Feedback.js"

export function runFeedbackPage() {
    const elem = document.querySelector(".FeedbackPage main")
    if (!elem) throw new Error("FeedbackPage main element not found in DOM")

    const root = createRoot(elem)
    root.render(
        <div className="box">
            <FeedbackForm />
        </div>
    )
}
