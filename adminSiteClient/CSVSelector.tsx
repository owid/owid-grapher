import React from "react"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import Papa from "papaparse"

export interface CSVSelectorProps {
    onCSV: (csv: CSV) => void
    uploadLabel?: string
    noteText?: string
}

@observer
export class CSVSelector extends React.Component<CSVSelectorProps> {
    fileInput?: HTMLInputElement
    @observable errors: string[] = []

    @action.bound onChooseCSV({ target }: { target: HTMLInputElement }) {
        const file = target.files && target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const csv = e?.target?.result
            if (csv && typeof csv === "string") {
                const res = Papa.parse<string[]>(csv, {
                    delimiter: ",",
                    skipEmptyLines: true,
                })

                if (res.errors.length) {
                    this.errors = res.errors.map(
                        (e) => `Row ${e.row}: ${e.message}`
                    )
                } else if (res.data.length === 0) {
                    this.errors = ["The CSV file contained no rows"]
                } else {
                    const csvObj: CSV = new CSV({
                        filename: file.name,
                        rows: res.data,
                    } as any)
                    this.props.onCSV(csvObj)
                }
            } else {
                this.errors = ["Could not read CSV file as text"]
            }
        }
        this.errors = []
        reader.readAsText(file)
    }

    render() {
        const { errors } = this
        const label = this.props.uploadLabel || "Upload CSV"
        const note =
            this.props.noteText ||
            "See README for example CSV. Maximum file size: 10MB."
        return (
            <div>
                <label htmlFor="file">{label}</label>
                <br />
                <input
                    id="file"
                    type="file"
                    onChange={this.onChooseCSV}
                    ref={(e) => (this.fileInput = e as HTMLInputElement)}
                />
                {errors ? (
                    <div className="text-danger">
                        <ul>
                            {errors.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}
                <div
                    className="text-muted small"
                    style={{ marginTop: "0.25rem" }}
                >
                    {note}
                </div>
            </div>
        )
    }

    componentDidMount() {
        if (this.fileInput) this.fileInput.value = ""
    }
}

export class CSV {
    filename: string
    rows: string[][]

    constructor({ filename = "", rows = [] }) {
        this.filename = filename
        this.rows = rows
    }
}
