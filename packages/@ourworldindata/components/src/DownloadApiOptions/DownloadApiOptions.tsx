import { useId } from "react"
import { RadioButton } from "../RadioButton.js"
import { OwidColumnDef } from "@ourworldindata/types"

export function DownloadApiOptions({
    onlyVisible,
    onOnlyVisibleChange,
    shortColNames,
    onShortColNamesChange,
    firstYColDef,
    completeDataset,
}: {
    onlyVisible: boolean
    onOnlyVisibleChange: (onlyVisible: boolean) => void
    shortColNames: boolean
    onShortColNamesChange: (shortColNames: boolean) => void
    firstYColDef?: OwidColumnDef
    /**
     * Offers the pre-built complete-dataset files as a third scope, on the
     * pages that have them. Those files are published as-is, so the
     * column-name options don't apply while this scope is selected and are
     * hidden rather than shown as no-ops.
     */
    completeDataset?: {
        checked: boolean
        onChange: (checked: boolean) => void
    }
}) {
    const groupPrefix = useId()
    const exLongName = firstYColDef?.name
    const exShortName = firstYColDef?.shortName
    const completeDatasetChecked = completeDataset?.checked ?? false
    const shortNamesAvailable = !!exShortName && !completeDatasetChecked

    const selectChartScope = (nextOnlyVisible: boolean): void => {
        completeDataset?.onChange(false)
        onOnlyVisibleChange(nextOnlyVisible)
    }

    return (
        <>
            <section className="download-api-options__config-list">
                <RadioButton
                    label="Download full data, including all entities and time points"
                    group={`${groupPrefix}-onlyVisible`}
                    checked={!onlyVisible && !completeDatasetChecked}
                    onChange={() => selectChartScope(false)}
                />
                <RadioButton
                    label="Download only the currently selected data visible in the chart"
                    group={`${groupPrefix}-onlyVisible`}
                    checked={onlyVisible && !completeDatasetChecked}
                    onChange={() => selectChartScope(true)}
                />
                {completeDataset && (
                    <div>
                        <RadioButton
                            label="Download the complete dataset, including related indicators"
                            group={`${groupPrefix}-onlyVisible`}
                            checked={completeDatasetChecked}
                            onChange={() => completeDataset.onChange(true)}
                        />
                        <p>
                            A single wide table in Parquet format, covering
                            every dimension combination. It's built when the
                            data is published, so it always contains all
                            indicators, entities and time points.
                        </p>
                    </div>
                )}
            </section>
            {shortNamesAvailable && (
                <section className="download-api-options__config-list">
                    <div>
                        <RadioButton
                            label="Long column names"
                            group={`${groupPrefix}-shortColNames`}
                            checked={!shortColNames}
                            onChange={() => onShortColNamesChange(false)}
                        />
                        <p>
                            e.g. <code>{exLongName}</code>
                        </p>
                    </div>
                    <div>
                        <RadioButton
                            label="Shortened column names"
                            group={`${groupPrefix}-shortColNames`}
                            checked={shortColNames}
                            onChange={() => onShortColNamesChange(true)}
                        />
                        <p>
                            e.g.{" "}
                            <code style={{ wordBreak: "break-all" }}>
                                {exShortName}
                            </code>
                        </p>
                    </div>
                </section>
            )}
        </>
    )
}
