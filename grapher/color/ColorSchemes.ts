import { ColorSchemeName } from "./ColorConstants.js"
import { CustomColorSchemes } from "./CustomSchemes.js"
import { ColorBrewerSchemes } from "./ColorBrewerSchemes.js"
import { ColorScheme } from "./ColorScheme.js"

const initAllSchemes = (): { [key in ColorSchemeName]: ColorScheme } => {
    const schemes = [...ColorBrewerSchemes, ...CustomColorSchemes]

    // NB: Temporarily switch to any typing to build the ColorScheme map. Ideally it would just be an enum, but in TS in enums you can only have primitive values.
    // There is another way to do it with static classes, but that's also not great. If you are adding a color scheme, just make sure to add it's name to the ColorSchemeName enum.
    const colorSchemes: any = {}
    schemes.forEach((scheme) => {
        colorSchemes[scheme.name] = new ColorScheme(
            scheme.displayName ?? scheme.name,
            scheme.colorSets,
            scheme.singleColorScale,
            scheme.isDistinct
        )
    })
    return colorSchemes as { [key in ColorSchemeName]: ColorScheme }
}

export const ColorSchemes = initAllSchemes()
