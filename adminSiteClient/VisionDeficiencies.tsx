import { Component } from "react"
import Select, { GroupBase, components, OptionProps } from "react-select"
import classNames from "classnames"
import { observer } from "mobx-react"
import { computed, action } from "mobx"
import { groupBy, getStylesForTargetHeight } from "@ourworldindata/utils"

// Transformation matrices taken from Chromium source: https://github.com/chromium/chromium/blob/a08db9fd8a986495c18226f9fb2f1e836bb87e62/third_party/blink/renderer/core/css/vision_deficiency.cc#L41-L82
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
                 0.152,  1.053, -0.205,  0.000,  0.000
                 0.115,  0.786,  0.099,  0.000,  0.000
                -0.004, -0.048,  1.052,  0.000,  0.000
                 0.000,  0.000,  0.000,  1.000,  0.000
                `,
    },

    {
        id: "deuteranopia",
        name: "Deuteranopia",
        group: "Color blindness",
        alternativeName: "green-blind",
        affected: "1.2% male, 0.01% female",
        transformationMatrix: `
                 0.367,  0.861, -0.228,  0.000,  0.000
                 0.280,  0.673,  0.047,  0.000,  0.000
                -0.012,  0.043,  0.969,  0.000,  0.000
                 0.000,  0.000,  0.000,  1.000,  0.000
                `,
    },
    {
        id: "tritanopia",
        name: "Tritanopia",
        group: "Color blindness",
        alternativeName: "blue-blind",
        affected: "0.001% male, 0.03% female",
        transformationMatrix: `
                 1.256, -0.077, -0.179,  0.000,  0.000
                -0.078,  0.931,  0.148,  0.000,  0.000
                 0.005,  0.691,  0.304,  0.000,  0.000
                 0.000,  0.000,  0.000,  1.000,  0.000
                `,
    },
    {
        id: "achromatopsia",
        name: "Achromatopsia",
        group: "Color blindness",
        alternativeName: "total color blindness",
        affected: "0.003%",
        transformationMatrix: `
                 0.213,  0.715,  0.072,  0.000,  0.000
                 0.213,  0.715,  0.072,  0.000,  0.000
                 0.213,  0.715,  0.072,  0.000,  0.000
                 0.000,  0.000,  0.000,  1.000,  0.000
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

const VisionDeficiencyOption = (
    props: OptionProps<VisionDeficiencyEntity, false, any>
) => (
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
export class VisionDeficiencyDropdown extends Component<VisionDeficiencyDropdownProps> {
    noDeficiencyOption = {
        label: "No deficiencies",
        value: "none",
    }

    @computed get options(): GroupBase<VisionDeficiencyEntity>[] {
        const options = visionDeficiencies.map((deficiency) => ({
            label: `${deficiency.name} (${deficiency.alternativeName})`,
            value: deficiency.id,
            deficiency,
        }))
        const grouped = groupBy(options, (option) => option.deficiency.group)
        const selectGroups = Object.entries(grouped).map(
            ([label, options]) => ({ label, options })
        )

        return [
            {
                label: "No deficiencies",
                options: [this.noDeficiencyOption],
            },
            ...selectGroups,
        ]
    }

    @action.bound onChange(selected: VisionDeficiencyEntity | null) {
        if (selected) this.props.onChange(selected)
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
