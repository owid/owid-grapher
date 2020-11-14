import { ValueType, OptionsType, StylesConfig } from "react-select"

export function isMultiValue<T>(value: ValueType<T>): value is OptionsType<T> {
    return Array.isArray(value)
}

export function asArray<T>(value: ValueType<T>): T[] {
    if (value == null) return []
    else if (isMultiValue(value)) return Array.from(value)
    else return [value]
}

export function getStylesForTargetHeight(
    targetHeight: number,
    props: any = {}
): StylesConfig {
    // Taken from https://github.com/JedWatson/react-select/issues/1322#issuecomment-591189551
    const {
        control,
        valueContainer,
        singleValue,
        clearIndicator,
        container,
        dropdownIndicator,
        option,
        menu,
    } = props
    return {
        container: (base: React.CSSProperties) => ({
            ...base,
            ...container,
        }),
        control: (base: React.CSSProperties) => ({
            ...base,
            minHeight: "initial",
            ...control,
        }),
        valueContainer: (base: React.CSSProperties) => ({
            ...base,
            height: `${targetHeight - 1 - 1}px`,
            padding: "0 4px",
            flexWrap: "nowrap",
            ...valueContainer,
        }),
        singleValue: (base: React.CSSProperties) => ({
            ...base,
            ...singleValue,
        }),
        clearIndicator: (base: React.CSSProperties) => ({
            ...base,
            padding: `${(targetHeight - 20 - 1 - 1) / 2}px`,
            ...clearIndicator,
        }),
        dropdownIndicator: (base: React.CSSProperties) => ({
            ...base,
            padding: `${(targetHeight - 20 - 1 - 1) / 2}px`,
            ...dropdownIndicator,
        }),
        option: (base: React.CSSProperties) => ({
            ...base,
            paddingTop: "5px",
            paddingBottom: "5px",
            ...option,
        }),
        menu: (base: React.CSSProperties) => ({
            ...base,
            zIndex: 10000,
            ...menu,
        }),
    }
}
