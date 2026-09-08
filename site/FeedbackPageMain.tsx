import { createRoot } from "react-dom/client"
import { FeedbackForm, FEEDBACK_FORM_CONTAINER_CLASS } from "./Feedback.js"

export function runFeedbackPage() {
    const container = document.querySelector(
        `.${FEEDBACK_FORM_CONTAINER_CLASS}`
    )
    if (!container) throw new Error("Feedback form container not found in DOM")

    const root = createRoot(container)
    root.render(<FeedbackForm />)
}
