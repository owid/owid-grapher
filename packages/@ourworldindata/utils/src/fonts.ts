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

/**
 * The font's cap height as a fraction of the font size. Lining digits are
 * cap height tall, too. Taken from the font files' metrics
 * (Lato: 1433/2000 units, Playfair Display: 700/1000 units).
 */
export function fontCapHeight(fontFamily: FontFamily): number {
    return match(fontFamily)
        .with(FontFamily.Lato, () => 0.72)
        .with(FontFamily.PlayfairDisplay, () => 0.7)
        .exhaustive()
}
