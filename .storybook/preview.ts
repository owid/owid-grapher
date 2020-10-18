import { addParameters } from "@storybook/client-api"
import { INITIAL_VIEWPORTS } from "@storybook/addon-viewport"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
// import "handsontable/dist/handsontable.full.css" .. This currently breaks with postcss/autoprefixer. Uncomment this and then remove the autoprefixer line in postcss to enable.

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
