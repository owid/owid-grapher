import React from "react"
import { observer } from "mobx-react"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { OwidSource } from "@ourworldindata/utils"
import { BindString } from "./Forms.js"

@observer
export class SourceList extends React.Component<{
    sources: OwidSource[]
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { sources } = this.props
        const isDisabled = true

        return (
            <div>
                {sources.map((source, index) => (
                    <div key={index}>
                        <div className="row">
                            <div className="col">
                                <BindString
                                    field="name"
                                    store={source}
                                    label="Source name"
                                    secondaryLabel="DB field: sources.description ->> '$.name'"
                                    disabled={isDisabled}
                                    // helpText={`Short citation of the main sources, to be displayed on the charts. Additional sources (e.g. population denominator) should not be included. Use semi-colons to separate multiple sources e.g. "UN (2022); World Bank (2022)". For institutional datasets or reports, use "Institution, Project (year or vintage)" e.g. "IHME, Global Burden of Disease (2019)". For data we have modified extensively, use "Our World in Data based on X (year)" e.g. "Our World in Data based on Pew Research Center (2022)". For academic papers, use "Authors (year)" e.g. "Arroyo-Abad and Lindert (2016)".`}
                                />
                                <BindString
                                    field="dataPublishedBy"
                                    store={source}
                                    label="Data published by"
                                    secondaryLabel="DB field: sources.description ->> '$.dataPublishedBy'"
                                    disabled={isDisabled}
                                    // helpText={`Full citation of main and additional sources. For academic papers, institutional datasets, and reports, use the complete citation recommended by the publisher. For data we have modified extensively, use "Our World in Data based on X (year) and Y (year)" e.g. "Our World in Data based on Pew Research Center (2022) and UN (2022)".`}
                                />
                                <BindString
                                    field="dataPublisherSource"
                                    store={source}
                                    label="Data publisher's source"
                                    secondaryLabel="DB field: sources.description ->> '$.dataPublisherSource'"
                                    disabled={isDisabled}
                                    // helpText={`Optional field. Basic indication of how the publisher collected this data e.g. "Survey data". Anything longer than a line should go in the dataset description.`}
                                />
                                <BindString
                                    field="link"
                                    store={source}
                                    label="Link"
                                    secondaryLabel="DB field: sources.description ->> '$.link'"
                                    disabled={isDisabled}
                                    // helpText="Link to the publication from which we retrieved this data"
                                />
                                <BindString
                                    field="retrievedDate"
                                    store={source}
                                    label="Retrieved"
                                    secondaryLabel="DB field: sources.description ->> '$.retrievedDate'"
                                    disabled={isDisabled}
                                    // helpText="Date when this data was obtained by us. Date format should always be YYYY-MM-DD."
                                />
                            </div>

                            <div className="col">
                                <BindString
                                    field="additionalInfo"
                                    store={source}
                                    label="Additional info"
                                    secondaryLabel="DB field: sources.description ->> '$.additionalInfo'"
                                    textarea
                                    disabled={isDisabled}
                                    // helpText="Describe the dataset and the methodology used in its construction. This can be as long and detailed as you like."
                                    rows={15}
                                />
                            </div>
                        </div>
                        <hr />
                    </div>
                ))}
            </div>
        )
    }
}
