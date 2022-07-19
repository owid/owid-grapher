import { MigrationInterface, QueryRunner } from "typeorm"

const Mappable = <T>(value: T) => ({
    map: (f: (x: T) => T) => Mappable(f(value)),
    fold: (): T => value,
})

const replaceUnicodeLessThanSign = (input?: string): string | undefined => {
    if (typeof input === "undefined") return undefined
    return input.replaceAll("&#60;", "<")
}

const replaceSubscriptTags = (input?: string): string | undefined => {
    if (typeof input === "undefined") return undefined
    const subscriptRegEx = /<sub>(\d)<\/sub>/g

    const subscriptMap = {
        "0": "₀",
        "1": "₁",
        "2": "₂",
        "3": "₃",
        "4": "₄",
        "5": "₅",
        "6": "₆",
        "7": "₇",
        "8": "₈",
        "9": "₉",
    }

    return input.replaceAll(
        subscriptRegEx,
        (_, digit: keyof typeof subscriptMap) => subscriptMap[digit]
    )
}

const replaceItalics = (input?: string): string | undefined => {
    if (typeof input === "undefined") return undefined
    return input.replaceAll(/(<i>)|(<\/i>)/g, "_")
}

const replaceAnchorTag = (input?: string): string | undefined => {
    if (typeof input === "undefined") return undefined
    const anchorRegEx = /<a href="([^"]+)">([^<]+)<\/a>/g
    return input.replaceAll(
        anchorRegEx,
        (_, href, contents) => `[${contents}](${href})`
    )
}

const makeMarkdownSafe = (input?: string): string | undefined =>
    Mappable(input)
        .map(replaceUnicodeLessThanSign)
        .map(replaceSubscriptTags)
        .map(replaceItalics)
        .map(replaceAnchorTag)
        .fold()

export class markdownSafety1658188348638 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const configs: { id: number; config: string }[] =
            await queryRunner.query(`select id, config from charts`)

        const updatedConfigs: { id: number; config: string }[] = []

        configs.forEach(
            ({ id, config: json }: { id: number; config: string }) => {
                try {
                    const config = JSON.parse(json)
                    if (!config.note && !config.subtitle) return

                    const updatedSubtitle = makeMarkdownSafe(config.subtitle)
                    const updatedNote = makeMarkdownSafe(config.note)

                    if (
                        updatedNote !== config.note ||
                        updatedSubtitle !== config.subtitle
                    ) {
                        const updatedJSON = JSON.stringify({
                            ...config,
                            subtitle: updatedSubtitle,
                            note: updatedNote,
                        })
                        updatedConfigs.push({ id, config: updatedJSON })
                    }
                } catch (e) {
                    console.error(
                        "Something went wrong when markdown-ifying your Grapher configs",
                        e
                    )
                }
            }
        )

        // No batching because there are fewer than 10 charts on prod
        // that are affected as of this commit
        updatedConfigs.forEach(async ({ id, config }) => {
            await queryRunner.query(
                `UPDATE charts SET config = ? WHERE id = ?`,
                [config, id]
            )
        })
    }

    // Not worth it to write a reversion script
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
