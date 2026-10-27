import * as React from "react"
import { Button, Popover } from "antd"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons"
import type { SearchFieldHelp } from "../adminShared/variableSearch.js"
import "./SearchHelp.scss"

export function SearchHelp({
    intro,
    fields,
}: {
    intro: React.ReactNode
    fields: readonly SearchFieldHelp[]
}): React.ReactElement {
    return (
        <Popover
            title="Search syntax"
            placement="bottomLeft"
            content={
                <div className="search-help">
                    <p>{intro}</p>
                    <table>
                        <tbody>
                            {fields.map((field) => (
                                <tr key={field.name}>
                                    <td>
                                        <code>{field.name}:</code>
                                    </td>
                                    <td>{field.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        >
            <Button
                type="text"
                aria-label="Search syntax"
                icon={<FontAwesomeIcon icon={faCircleQuestion} />}
            />
        </Popover>
    )
}
