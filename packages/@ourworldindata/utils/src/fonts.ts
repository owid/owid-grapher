import { match } from "ts-pattern"

export enum FontFamily {
    Lato = "Lato",
    PlayfairDisplay = "PlayfairDisplay",
}

/** Maps a FontFamily enum value to a CSS font stack */
export function cssFontFamily(fontFamily: FontFamily): string {
    return match(fontFamily)
        .with(
            FontFamily.Lato,
            () =>
                "Lato, 'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif"
        )
        .with(
            FontFamily.PlayfairDisplay,
            () =>
                "'Playfair Display', Georgia, 'Times New Roman', 'Liberation Serif', serif"
        )
        .exhaustive()
}
