import * as R from "remeda"

import { MAX_SELECTED_COUNTRIES, USER_LOCATION_SENTINEL } from "./constants.js"
import type { IncomeDistributionYear } from "./types.js"

/**
 * The countries the compare view draws, from the selection as stored (the
 * config's or the URL's): the "userLocation" sentinel becomes the reader's
 * country (or nothing while that's unknown), names the data doesn't have
 * are dropped, duplicates collapse, and the first MAX_SELECTED_COUNTRIES
 * stay. The stored selection keeps the rest, so a shared link survives a
 * data update.
 */
export function resolveSelectedCountries(
    countries: string[],
    userCountryName: string | undefined,
    yearData: IncomeDistributionYear
): string[] {
    return R.pipe(
        countries,
        R.flatMap((name) =>
            name === USER_LOCATION_SENTINEL
                ? userCountryName
                    ? [userCountryName]
                    : []
                : [name]
        ),
        R.filter((name) => yearData.byName.has(name)),
        R.unique(),
        R.take(MAX_SELECTED_COUNTRIES)
    )
}
