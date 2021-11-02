import { CSSObjectWithLabel, StylesConfig } from "react-select"

export const getStylesForTargetHeight = (
    targetHeight: number
): StylesConfig<any, any, any> => {
    // Taken from https://github.com/JedWatson/react-select/issues/1322#issuecomment-591189551
    return {
        control: (provided: CSSObjectWithLabel): any => ({
            ...provided,
            minHeight: "initial",
        }),
        valueContainer: (provided: CSSObjectWithLabel): any => ({
            ...provided,
            height: `${targetHeight - 1 - 1}px`,
            padding: "0 4px",
            flexWrap: "nowrap",
        }),
        clearIndicator: (provided: CSSObjectWithLabel): any => ({
            ...provided,
            padding: `${(targetHeight - 20 - 1 - 1) / 2}px`,
        }),
        dropdownIndicator: (provided: CSSObjectWithLabel): any => ({
            ...provided,
            padding: `${(targetHeight - 20 - 1 - 1) / 2}px`,
        }),
        option: (provided: CSSObjectWithLabel): any => ({
            ...provided,
            paddingTop: "5px",
            paddingBottom: "5px",
        }),
        menu: (provided: CSSObjectWithLabel): any => ({
            ...provided,
            zIndex: 10000,
        }),
    }
}
