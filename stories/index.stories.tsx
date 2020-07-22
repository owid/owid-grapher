import * as React from "react"

import { storiesOf } from "@storybook/react"

import { FeedbackForm } from "site/client/Feedback"
import { ChartStoryView } from "site/client/ChartStoryView"
import "site/client/owid.scss"
import "charts/client/chart.scss"
import { CovidDataExplorer } from "charts/covidDataExplorer/CovidDataExplorer"
import { covidSampleRows } from "test/fixtures/CovidSampleRows"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import {
    CommandPalette,
    Command
} from "charts/covidDataExplorer/CommandPalette"

storiesOf("FeedbackForm", module).add("normal", () => <FeedbackForm />)

storiesOf("ChartStoryView", module).add("normal", () => <ChartStoryView />)

storiesOf("CovidDataExplorer", module)
    .add("single with keyboard shortcuts", () => {
        const dummyMeta = {
            charts: {},
            variables: {}
        }
        return (
            <CovidDataExplorer
                data={covidSampleRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
                enableKeyboardShortcuts={true}
            />
        )
    })
    .add("multiple", () => {
        const dummyMeta = {
            charts: {},
            variables: {}
        }
        return (
            <>
                <CovidDataExplorer
                    data={covidSampleRows}
                    params={new CovidQueryParams("")}
                    covidChartAndVariableMeta={dummyMeta}
                    updated="2020-05-09T18:59:31"
                />
                <CovidDataExplorer
                    data={covidSampleRows}
                    params={new CovidQueryParams("")}
                    covidChartAndVariableMeta={dummyMeta}
                    updated="2020-05-09T18:59:31"
                />
            </>
        )
    })

storiesOf("CommandPalette", module).add("testCommands", () => {
    const demoCommands: Command[] = [
        {
            combo: "ctrl+o",
            fn: () => {},
            title: "Open",
            category: "File"
        },
        {
            combo: "ctrl+s",
            fn: () => {},
            title: "Save",
            category: "File"
        },
        {
            combo: "ctrl+c",
            fn: () => {},
            title: "Copy",
            category: "Edit"
        }
    ]
    return <CommandPalette commands={demoCommands} display="block" />
})

// storiesOf('Button', module)
//   .add('with text', () => <Button onClick={action('clicked')}>Hello Button</Button>)
//   .add('with some emoji', () => (
//     <Button onClick={action('clicked')}>
//       <span role="img" aria-label="so cool">
//         😀 😎 👍 💯
//       </span>
//     </Button>
//   ));
