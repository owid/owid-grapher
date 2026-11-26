import type { IncomeDistributionYear, WelfareType } from "./types.js"

/**
 * What a country's household surveys measure, for the reader: the phrase a
 * sentence uses for it (`term`), and the details-on-demand card behind that
 * phrase and behind the picker's label (`title`, `description`)
 */
export const WELFARE_TYPE_DETAILS: Record<
    WelfareType,
    { term: string; title: string; description: string[] }
> = {
    income: {
        term: "income after taxes and benefits",
        title: "Income data",
        description: [
            "The World Bank relies on household surveys that measure either income or consumption, depending on the country.",
            "For the countries where it measures income, the data is based on disposable household income: wages, self-employment and other earnings, after taxes and benefits.",
            "Income and consumption data are not perfectly comparable; because high earners save a larger share of their money and low earners can have temporary drops in earnings, income data tends to show more inequality.",
        ],
    },
    consumption: {
        term: "consumption",
        title: "Consumption data",
        description: [
            "The World Bank relies on household surveys that measure either income or consumption, depending on the country.",
            "For the countries where it measures consumption, the data is based on household consumption: the value of goods and services households actually consume (whether purchased or home-produced), which leaves out savings.",
            "Income and consumption data are not perfectly comparable; because households often dip into savings or borrow during tough times to keep their daily living standards steady, consumption data tends to be more evenly spread and show less inequality.",
        ],
    },
}

/** A country's welfare type by name, for the picker's labels and the note's sentence */
export function welfareTypeLookup(
    yearData: IncomeDistributionYear
): (name: string) => WelfareType {
    // Every name offered comes from the same year's data
    return (name) => yearData.byName.get(name)!.welfareType
}
