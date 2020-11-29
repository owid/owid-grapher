import * as React from "react"
import { FeedbackForm } from "site/client/Feedback"

export default {
    title: "FeedbackForm",
    component: FeedbackForm,
}

export const Default = () => <FeedbackForm autofocus={false} />
