import { OwidGdocPostInterface } from "@ourworldindata/utils"
import React from "react"

/**
 * We would like to handle Fragments better in the future
 * For now, we're just displaying them as JSON
 */
export function Fragment(props: OwidGdocPostInterface): JSX.Element {
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
