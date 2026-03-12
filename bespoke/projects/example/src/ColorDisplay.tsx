import { useAtomValue } from "jotai"
import { selectedColorAtom } from "./atoms"
import "./ColorDisplay.css"

export function ColorDisplay() {
    const color = useAtomValue(selectedColorAtom)

    return (
        <div className="color-display">
            <div
                className="color-display__preview"
                style={{ backgroundColor: color }}
            />
            <span>
                Selected: <code>{color}</code>
            </span>
        </div>
    )
}
