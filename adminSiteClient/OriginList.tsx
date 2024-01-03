import React from "react"
import { observer } from "mobx-react"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { OwidOrigin } from "@ourworldindata/utils"
import { BindString, FieldsRow } from "./Forms.js"

@observer
export class OriginList extends React.Component<{
    origins: OwidOrigin[]
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { origins } = this.props
        const isDisabled = true

        return (
            <div>
                {origins.map((origin, index) => (
                    <div key={index}>
                        <h4>{origin.title}</h4>
                        <FieldsRow>
                            <BindString
                                label="Title"
                                field="title"
                                store={origin}
                                disabled={isDisabled}
                            />
                            <BindString
                                label="Title Snapshot"
                                field="titleSnapshot"
                                store={origin}
                                disabled={isDisabled}
                            />
                            <BindString
                                label="Attribution"
                                field="attribution"
                                store={origin}
                                disabled={isDisabled}
                            />
                            <BindString
                                label="Attribution Short"
                                field="attributionShort"
                                store={origin}
                                disabled={isDisabled}
                            />
                        </FieldsRow>
                        <FieldsRow>
                            <BindString
                                label="Description"
                                field="description"
                                store={origin}
                                disabled={isDisabled}
                                textarea
                            />
                            <BindString
                                label="Description Snapshot"
                                field="descriptionSnapshot"
                                store={origin}
                                disabled={isDisabled}
                                textarea
                            />
                            <BindString
                                label="Citation Full"
                                field="citationFull"
                                store={origin}
                                disabled={isDisabled}
                                textarea
                            />
                            <BindString
                                label="Producer"
                                field="producer"
                                store={origin}
                                disabled={isDisabled}
                            />
                        </FieldsRow>
                        <FieldsRow>
                            <BindString
                                label="URL Main"
                                field="urlMain"
                                store={origin}
                                disabled={isDisabled}
                            />
                            <BindString
                                label="URL Download"
                                field="urlDownload"
                                store={origin}
                                disabled={isDisabled}
                            />
                            <BindString
                                label="Date Accessed"
                                field="dateAccessed"
                                store={origin}
                                disabled={isDisabled}
                            />
                            <BindString
                                label="Date Published"
                                field="datePublished"
                                store={origin}
                                disabled={isDisabled}
                            />
                            {/* Missing origin license... is it worth adding it? */}
                        </FieldsRow>
                        <hr />
                    </div>
                ))}
            </div>
        )
    }
}
