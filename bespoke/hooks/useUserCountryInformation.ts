import { useQuery } from "@tanstack/react-query"
import { fetchJson, UserCountryInformation } from "@ourworldindata/utils"

export function useUserCountryInformation(): {
    data?: UserCountryInformation
} {
    return useQuery({
        queryKey: ["bespoke", "user-country-information"],
        queryFn: async () => {
            const response = await fetchJson<{
                country: UserCountryInformation
            }>("https://ourworldindata.org/api/detect-country")
            return response.country
        },
    })
}
