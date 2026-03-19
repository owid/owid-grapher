import { useAtom } from "jotai"
import { useCallback } from "react"
import cx from "classnames"

import { selectedColorAtom, selectedFoodAtom } from "../atoms"
import { Dropdown } from "@ourworldindata/grapher/src/controls/Dropdown"
import { COLOR_KEYS, FOOD_KEYS, FoodKey } from "../constants"

interface FoodOption {
    value: FoodKey
    label: string
}

const foodOptions: FoodOption[] = FOOD_KEYS.map((key) => ({
    value: key,
    label: key,
}))

export function Picker() {
    const [selectedColor, setSelectedColor] = useAtom(selectedColorAtom)
    const [selectedFood, setSelectedFood] = useAtom(selectedFoodAtom)

    const selectedOption =
        foodOptions.find((o) => o.value === selectedFood) ?? null

    const handleFoodChange = useCallback(
        (option: FoodOption | null) => {
            if (option) setSelectedFood(option.value)
        },
        [setSelectedFood]
    )

    return (
        <div className="picker">
            <p className="picker__description">
                This variant shares state with the Display variant via Jotai
                atoms.
            </p>
            <p className="picker__label">Select a food:</p>
            <Dropdown
                className="picker__dropdown"
                options={foodOptions}
                value={selectedOption}
                onChange={handleFoodChange}
                isSearchable
                placeholder="Select a food..."
                aria-label="Select a food"
            />
            <p className="picker__label">Pick a color:</p>
            <div className="picker__swatches">
                {COLOR_KEYS.map((hex) => (
                    <button
                        key={hex}
                        onClick={() => setSelectedColor(hex)}
                        className={cx("picker__swatch", {
                            "picker__swatch--selected": hex === selectedColor,
                        })}
                        style={{ backgroundColor: hex }}
                        title={hex}
                    />
                ))}
            </div>
        </div>
    )
}
