import { OwidGdocPostInterface } from "@ourworldindata/utils"
import React from "react"

/**
 * We would like to handle Fragments better in the future
 * For now, we're just displaying them as JSON
 * When we get around to that, we should render them via the admin, because style bleed isn't so important and we don't
 * want to add extra JS/CSS to the common bundle
 */
export function Fragment(props: OwidGdocPostInterface): React.ReactElement {
    return (
        <div className="grid grid-cols-12-full-width">
            <h5 className="h5-black-caps span-cols-12 col-start-2">Fragment</h5>
            <h2
                className="display-1-semibold span-cols-12 col-start-2"
                style={{ marginTop: 0 }}
            >
                {props.content.title}{" "}
            </h2>
            <pre className="fragment-json span-cols-12 col-start-2">
                {JSON.stringify(props.content, null, 2)}
            </pre>
        </div>
    )
}
