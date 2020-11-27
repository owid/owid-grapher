import React from "react"
import Select, {
    components,
    OptionProps,
    GroupedOptionsType,
    ValueType,
} from "react-select"
import classNames from "classnames"
import { observer } from "mobx-react"
import { computed, action } from "mobx"
import { groupBy, first } from "clientUtils/Util"
import { asArray, getStylesForTargetHeight } from "utils/client/react-select"

// Transformation matrices taken from https://github.com/hail2u/color-blindness-emulation/blob/master/filters.svg?short_path=5708e81
// "Affected" numbers from https://en.wikipedia.org/wiki/Color_blindness#Epidemiology

export interface VisionDeficiency {
    id: string
    name: string
    group: string
    alternativeName: string
    affected: string
    transformationMatrix: string
}

const visionDeficiencies: VisionDeficiency[] = [
    // Color blindnesses first
    {
        id: "protanopia",
        name: "Protanopia",
        group: "Color blindness",
        alternativeName: "red-blind",
        affected: "1.3% male, 0.02% female",
        transformationMatrix: `
                0.567, 0.433, 0,     0, 0
                0.558, 0.442, 0,     0, 0
                0,     0.242, 0.758, 0, 0
                0,     0,     0,     1, 0
                `,
    },

    {
        id: "deuteranopia",
        name: "Deuteranopia",
        group: "Color blindness",
        alternativeName: "green-blind",
        affected: "1.2% male, 0.01% female",
        transformationMatrix: `
                0.625, 0.375, 0,   0, 0
                0.7,   0.3,   0,   0, 0
                0,     0.3,   0.7, 0, 0
                0,     0,     0,   1, 0
                `,
    },
    {
        id: "tritanopia",
        name: "Tritanopia",
        group: "Color blindness",
        alternativeName: "blue-blind",
        affected: "0.001% male, 0.03% female",
        transformationMatrix: `
                0.95, 0.05,  0,     0, 0
                0,    0.433, 0.567, 0, 0
                0,    0.475, 0.525, 0, 0
                0,    0,     0,     1, 0
                `,
    },
    {
        id: "achromatopsia",
        name: "Achromatopsia",
        group: "Color blindness",
        alternativeName: "total color blindness",
        affected: "0.003%",
        transformationMatrix: `
                0.299, 0.587, 0.114, 0, 0
                0.299, 0.587, 0.114, 0, 0
                0.299, 0.587, 0.114, 0, 0
                0,     0,     0,     1, 0
                `,
    },
    // Then weaknesses
    {
        id: "protanomaly",
        name: "Protanomaly",
        group: "Reduced vision",
        alternativeName: "red-weak",
        affected: "1.3% male, 0.02% female",
        transformationMatrix: `
                0.817, 0.183, 0,     0, 0
                0.333, 0.667, 0,     0, 0
                0,     0.125, 0.875, 0, 0
                0,     0,     0,     1, 0
                `,
    },
    {
        id: "deuteranomaly",
        name: "Deuteranomaly",
        group: "Reduced vision",
        alternativeName: "green-weak",
        affected: "5.0% male, 0.35% female",
        transformationMatrix: `
                0.8,   0.2,   0,     0, 0
                0.258, 0.742, 0,     0, 0
                0,     0.142, 0.858, 0, 0
                0,     0,     0,     1, 0
                `,
    },
    {
        id: "tritanomaly",
        name: "Tritanomaly",
        group: "Reduced vision",
        alternativeName: "blue-weak",
        affected: "0.0001% male, 0.0001% female",
        transformationMatrix: `
                0.967, 0.033, 0,     0, 0
                0,     0.733, 0.267, 0, 0
                0,     0.183, 0.817, 0, 0
                0,     0,     0,     1, 0
                `,
    },
    {
        id: "achromatomaly",
        name: "Achromatomaly",
        group: "Reduced vision",
        alternativeName: "weak color visibility",
        affected: "",
        transformationMatrix: `
                0.618, 0.320, 0.062, 0, 0
                0.163, 0.775, 0.062, 0, 0
                0.163, 0.320, 0.516, 0, 0
                0,     0,     0,     1, 0
                `,
    },
]

export const VisionDeficiencySvgFilters = () => (
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1" height="0">
        <defs>
            {visionDeficiencies.map((deficiency) => (
                <filter id={deficiency.id} key={deficiency.id}>
                    <feColorMatrix
                        in="SourceGraphic"
                        type="matrix"
                        values={deficiency.transformationMatrix}
                    />
                </filter>
            ))}
        </defs>
    </svg>
)

interface VisionDeficiencyDropdownProps {
    value?: string
    onChange: (selected: VisionDeficiencyEntity) => void
}

export interface VisionDeficiencyEntity {
    label: string
    value: string
    deficiency?: VisionDeficiency
}

const VisionDeficiencyOption = (props: OptionProps<VisionDeficiencyEntity>) => (
    <div style={{ fontSize: ".9em", lineHeight: 1 }}>
        <components.Option {...props}>
            <label>{props.label}</label>
            {props.data.deficiency?.affected && (
                <div
                    className={classNames({ "text-muted": !props.isSelected })}
                >
                    <small>Affected: {props.data.deficiency.affected}</small>
                </div>
            )}
        </components.Option>
    </div>
)

@observer
export class VisionDeficiencyDropdown extends React.Component<
    VisionDeficiencyDropdownProps
> {
    noDeficiencyOption = {
        label: "No deficiencies",
        value: "none",
    }

    @computed get options(): GroupedOptionsType<VisionDeficiencyEntity> {
        const options = visionDeficiencies.map((deficiency) => ({
            label: `${deficiency.name} (${deficiency.alternativeName})`,
            value: deficiency.id,
            deficiency,
        }))
        const grouped = groupBy(options, (option) => option.deficiency.group)
        const selectGroups = Object.entries(
            grouped
        ).map(([label, options]) => ({ label, options }))

        return [
            {
                label: "No deficiencies",
                options: [this.noDeficiencyOption],
            },
            ...selectGroups,
        ]
    }

    @action.bound onChange(selected: ValueType<VisionDeficiencyEntity>) {
        const value = first(asArray(selected))
        if (value) this.props.onChange(value)
    }

    render() {
        return (
            <Select
                options={this.options}
                onChange={this.onChange}
                defaultValue={this.noDeficiencyOption}
                menuPlacement="top"
                components={{
                    Option: VisionDeficiencyOption,
                }}
                styles={getStylesForTargetHeight(30)}
            />
        )
    }
}
