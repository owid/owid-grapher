import { addParameters } from "@storybook/client-api"
import { INITIAL_VIEWPORTS } from "@storybook/addon-viewport"
import "site/owid.scss"
import "@ourworldindata/grapher/dist/index.css"
import "handsontable/dist/handsontable.full.css"

addParameters({
    viewport: {
        viewports: INITIAL_VIEWPORTS,
    },
    options: {
        storySort: {
            method: "alphabetical",
        },
    },
})
