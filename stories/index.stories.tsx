import * as React from "react"

import { storiesOf } from "@storybook/react"
import { action } from "@storybook/addon-actions"
import { linkTo } from "@storybook/addon-links"

import { FeedbackForm } from "site/client/Feedback"
import { ChartStoryView } from "site/client/ChartStoryView"
import "site/client/owid.scss"
import "charts/client/chart.scss"

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
