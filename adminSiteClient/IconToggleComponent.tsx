import type { IconDefinition } from "@fortawesome/fontawesome-common-types"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Button } from "antd"

export interface IconToggleProps {
    isOn: boolean
    onIcon: IconDefinition
    offIcon: IconDefinition
    onClick: (newState: boolean) => void
}

export const IconToggleComponent = (props: IconToggleProps) => (
    <Button
        size="small"
        icon={
            <FontAwesomeIcon icon={props.isOn ? props.onIcon : props.offIcon} />
        }
        onClick={() => props.onClick(!props.isOn)}
    />
)
