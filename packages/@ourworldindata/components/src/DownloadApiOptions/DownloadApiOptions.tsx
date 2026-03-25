import { RadioButton } from "../RadioButton.js"
import { OwidColumnDef } from "@ourworldindata/types"

export function DownloadApiOptions({
    onlyVisible,
    onOnlyVisibleChange,
    shortColNames,
    onShortColNamesChange,
    firstYColDef,
}: {
    onlyVisible: boolean
    onOnlyVisibleChange: (onlyVisible: boolean) => void
    shortColNames: boolean
    onShortColNamesChange: (shortColNames: boolean) => void
    firstYColDef?: OwidColumnDef
}) {
    const exLongName = firstYColDef?.name
    const exShortName = firstYColDef?.shortName
    const shortNamesAvailable = !!exShortName

    return (
        <>
            <section className="download-api-options__config-list">
                <RadioButton
                    label="Download full data, including all entities and time points"
                    group="onlyVisible"
                    checked={!onlyVisible}
                    onChange={() => onOnlyVisibleChange(false)}
                />
                <RadioButton
                    label="Download only the currently selected data visible in the chart"
                    group="onlyVisible"
                    checked={onlyVisible}
                    onChange={() => onOnlyVisibleChange(true)}
                />
            </section>
            {shortNamesAvailable && (
                <section className="download-api-options__config-list">
                    <div>
                        <RadioButton
                            label="Long column names"
                            group="shortColNames"
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
                            group="shortColNames"
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
