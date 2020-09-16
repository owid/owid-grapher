import { range } from "grapher/utils/Util"

const psuedoRandom = (index: number) => index * (index % 3) + index

export const synthOwidTableCsv = (
    countries = ["Iceland", "France"],
    numericColumnSlugs = ["Population", "GDP"],
    startYear = 1950,
    endYear = 2020
) => {
    const colSlugs = ["entityName", "entityCode", "entityId", "year"].concat(
        numericColumnSlugs
    )
    const rows = countries.map((country, index) =>
        range(startYear, endYear)
            .map((year) =>
                [
                    country,
                    country.substr(3).toUpperCase(),
                    index,
                    year,
                    ...numericColumnSlugs.map((slug) => psuedoRandom(index)),
                ].join(",")
            )
            .join("\n")
    )
    return `${colSlugs.join(",")}\n${rows.join("\n")}`
}
