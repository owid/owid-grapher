import { useAtom } from "jotai"
import { selectedColorAtom } from "./atoms"

const COLORS = ["#3182bd", "#e6550d", "#31a354", "#756bb1", "#636363"]

export function ColorPicker() {
    const [selectedColor, setSelectedColor] = useAtom(selectedColorAtom)

    return (
        <div className="color-picker">
            <p className="color-picker__label">Pick a color:</p>
            <div className="color-picker__swatches">
                {COLORS.map((color) => (
                    <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`color-picker__swatch${color === selectedColor ? " color-picker__swatch--selected" : ""}`}
                        style={{ backgroundColor: color }}
                    />
                ))}
            </div>
        </div>
    )
}
