import * as React from "react"
import { FeedbackForm } from "site/Feedback"

export default {
    title: "FeedbackForm",
    component: FeedbackForm,
}

export const Default = () => <FeedbackForm autofocus={false} />
