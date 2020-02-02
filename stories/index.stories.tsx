import * as React from "react"

import { storiesOf } from "@storybook/react"

import "charts/client/chart.scss"
import { ChartStoryView } from "site/client/ChartStoryView"
import { FeedbackForm } from "site/client/Feedback"
import "site/client/owid.scss"

storiesOf("FeedbackForm", module).add("normal", () => <FeedbackForm />)

storiesOf("ChartStoryView", module).add("normal", () => <ChartStoryView />)

// storiesOf('Button', module)
//   .add('with text', () => <Button onClick={action('clicked')}>Hello Button</Button>)
//   .add('with some emoji', () => (
//     <Button onClick={action('clicked')}>
//       <span role="img" aria-label="so cool">
//         😀 😎 👍 💯
//       </span>
//     </Button>
//   ));
