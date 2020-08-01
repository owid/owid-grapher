import * as React from "react"

import { storiesOf } from "@storybook/react"

import "site/client/owid.scss"
import "charts/client/chart.scss"
import { FeedbackForm } from "site/client/Feedback"
import { ChartStoryView } from "site/client/ChartStoryView"
import { ChartSwitcher } from "charts/ChartSwitcher"

storiesOf("FeedbackForm", module).add("normal", () => <FeedbackForm />)

storiesOf("ChartStoryView", module).add("normal", () => <ChartStoryView />)

storiesOf("ChartSwitcher", module).add("basics", () => {
    return <ChartSwitcher />
})
