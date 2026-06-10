import { useAtomValue } from "jotai"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import { selectedColorAtom, selectedFoodAtom } from "../atoms"
import { foodIconByKey } from "../constants"

import "./Display.scss"

export function Display() {
    const color = useAtomValue(selectedColorAtom)
    const food = useAtomValue(selectedFoodAtom)

    const icon = foodIconByKey[food]

    return (
        <div className="icon-box" style={{ borderColor: color }}>
            <FontAwesomeIcon icon={icon} color={color} />
        </div>
    )
}
