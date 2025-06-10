import { expect, it, describe } from "vitest"
import { removeCountryNames } from "./extractSearchSuggestions.js"

describe("removeCountryNames", () => {
    describe("word boundary matching", () => {
        it("removes complete country names only", () => {
            // Should remove "Chad" but not affect "Chadwick"
            expect(
                removeCountryNames("Statistics on Chad vs Chadwick's theory")
            ).toEqual("Statistics on  vs Chadwick's theory")

            // Should remove "Austria" but not affect "Austrian"
            expect(removeCountryNames("Austrian economics in Austria")).toEqual(
                "Austrian economics in "
            )
        })

        it("removes country names at different positions", () => {
            expect(removeCountryNames("France GDP growth")).toEqual(
                " GDP growth"
            )
            expect(removeCountryNames("GDP growth in France")).toEqual(
                "GDP growth in "
            )
            expect(removeCountryNames("GDP France growth")).toEqual(
                "GDP  growth"
            )
        })
    })

    describe("case insensitive matching", () => {
        it("removes country names regardless of case", () => {
            expect(removeCountryNames("france GDP")).toEqual(" GDP")
            expect(removeCountryNames("FRANCE GDP")).toEqual(" GDP")
            expect(removeCountryNames("France GDP")).toEqual(" GDP")
            expect(removeCountryNames("FrAnCe GDP")).toEqual(" GDP")
        })
    })

    describe("special character escaping", () => {
        it("handles countries with apostrophes", () => {
            // Should remove "Cote d'Ivoire" correctly
            expect(removeCountryNames("GDP in Cote d'Ivoire")).toEqual(
                "GDP in "
            )

            // Should not match "Côte d'Ivoire" when looking for "Cote d'Ivoire"
            expect(removeCountryNames("GDP in Côte d'Ivoire")).toEqual(
                "GDP in Côte d'Ivoire"
            )
        })

        it("handles countries with other special regex characters", () => {
            // Test that regex metacharacters are properly escaped
            const titleWithSpecialChars = "Data from France+Germany"
            expect(removeCountryNames(titleWithSpecialChars)).toEqual(
                "Data from +"
            )
        })
    })

    describe("multiple country removal", () => {
        it("removes multiple different countries from the same title", () => {
            expect(removeCountryNames("France vs Germany trade")).toEqual(
                " vs  trade"
            )
            expect(removeCountryNames("United States and Canada GDP")).toEqual(
                " and  GDP"
            )
        })

        it("removes repeated occurrences of the same country", () => {
            expect(removeCountryNames("France exports to France")).toEqual(
                " exports to "
            )
        })
    })

    describe("edge cases", () => {
        it("handles empty strings", () => {
            expect(removeCountryNames("")).toEqual("")
        })

        it("handles strings with only country names", () => {
            expect(removeCountryNames("France")).toEqual("")
            expect(removeCountryNames("United States")).toEqual("")
        })

        it("handles strings with no country names", () => {
            const title = "Global CO2 emissions over time"
            expect(removeCountryNames(title)).toEqual(title)
        })

        it("preserves whitespace structure", () => {
            expect(removeCountryNames("  France   GDP  ")).toEqual("     GDP  ")
        })

        it("handles countries that are substrings of other words correctly", () => {
            // "mali" might be in "malignant" - should not remove partial matches
            expect(
                removeCountryNames(
                    "Incidence of malignant neoplasms by country"
                )
            ).toEqual("Incidence of malignant neoplasms by country")
        })

        it("handles overlapping country names correctly", () => {
            // "French Polynesia" should be removed completely, not just "Polynesia"
            expect(
                removeCountryNames("Tourism in French Polynesia and Polynesia")
            ).toEqual("Tourism in  and ")
        })
    })

    describe("real-world scenarios", () => {
        it("cleans typical chart titles", () => {
            expect(
                removeCountryNames(
                    "Women who moved from French Guiana to another country"
                )
            ).toEqual("Women who moved from  to another country")

            expect(
                removeCountryNames(
                    "Life expectancy vs GDP per capita in France"
                )
            ).toEqual("Life expectancy vs GDP per capita in ")

            expect(
                removeCountryNames("Annual population growth: China and India")
            ).toEqual("Annual population growth:  and ")
        })

        it("handles complex titles with multiple elements", () => {
            expect(
                removeCountryNames(
                    "Renewable energy share in Germany, France, and Spain (2000-2020)"
                )
            ).toEqual("Renewable energy share in , , and  (2000-2020)")
        })
    })
})
