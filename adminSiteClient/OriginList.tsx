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
                                disabled
                            />
                            <BindString
                                label="Title Snapshot"
                                field="titleSnapshot"
                                store={origin}
                                disabled
                            />
                            <BindString
                                label="Attribution"
                                field="attribution"
                                store={origin}
                                disabled
                            />
                            <BindString
                                label="Attribution Short"
                                field="attributionShort"
                                store={origin}
                                disabled
                            />
                        </FieldsRow>
                        <FieldsRow>
                            <BindString
                                label="Description"
                                field="description"
                                store={origin}
                                disabled
                                textarea
                            />
                            <BindString
                                label="Description Snapshot"
                                field="descriptionSnapshot"
                                store={origin}
                                disabled
                                textarea
                            />
                            <BindString
                                label="Citation Full"
                                field="citationFull"
                                store={origin}
                                disabled
                                textarea
                            />
                            <BindString
                                label="Producer"
                                field="producer"
                                store={origin}
                                disabled
                            />
                        </FieldsRow>
                        <FieldsRow>
                            <BindString
                                label="URL Main"
                                field="urlMain"
                                store={origin}
                                disabled
                            />
                            <BindString
                                label="URL Download"
                                field="urlDownload"
                                store={origin}
                                disabled
                            />
                            <BindString
                                label="Date Accessed"
                                field="dateAccessed"
                                store={origin}
                                disabled
                            />
                            <BindString
                                label="Date Published"
                                field="datePublished"
                                store={origin}
                                disabled
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
