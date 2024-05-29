import { DimensionProperty } from "@ourworldindata/utils"
import { GrapherProgrammaticInterface } from "../core/Grapher"
import { GrapherTabOption } from "@ourworldindata/types"

export const legacyMapGrapher: GrapherProgrammaticInterface = {
    hasMapTab: true,
    tab: GrapherTabOption.map,
    map: {
        timeTolerance: 5,
    },
    dimensions: [
        {
            variableId: 3512,
            property: DimensionProperty.y,
            display: {
                name: "",
                unit: "% of children under 5",
                tolerance: 5,
                isProjection: false,
            },
        },
    ],
    owidDataset: new Map([
        [
            3512,
            {
                data: {
                    years: [
                        ...Array(300)
                            .fill(1)
                            .map((x, i) => 2000),
                    ],
                    entities: Array(300)
                        .fill(1)
                        .map((x, i) => i),
                    values: Array(300)
                        .fill(1)
                        .map((x, i) => Math.random() * 30),
                },
                metadata: {
                    id: 3512,
                    display: { shortUnit: "%" },
                    dimensions: {
                        entities: {
                            values: [
                                { name: "Afghanistan", id: 1, code: "AFG" },
                                { name: "Iceland", id: 207, code: "ISL" },
                                { name: "Albania", id: 2, code: "ALB" },
                                { name: "Algeria", id: 3, code: "DZA" },
                                { name: "Andorra", id: 4, code: "AND" },
                                { name: "Angola", id: 5, code: "AGO" },
                                {
                                    name: "Antigua and Barbuda",
                                    id: 6,
                                    code: "ATG",
                                },
                                { name: "Brunei", id: 38, code: "BRN" },
                                { name: "Bulgaria", id: 39, code: "BGR" },
                                { name: "Burkina Faso", id: 40, code: "BFA" },
                                { name: "Burundi", id: 41, code: "BDI" },
                                { name: "Cabo Verde", id: 42, code: "CPV" },
                                { name: "Cambodia", id: 43, code: "KHM" },
                                { name: "Cameroon", id: 44, code: "CMR" },
                                { name: "Canada", id: 45, code: "CAN" },
                                { name: "Cayman Islands", id: 46, code: "CYM" },
                                {
                                    name: "Central African Republic",
                                    id: 47,
                                    code: "CAF",
                                },
                                { name: "Chad", id: 48, code: "TCD" },
                                { name: "Chile", id: 49, code: "CHL" },
                                { name: "China", id: 50, code: "CHN" },
                                { name: "Colombia", id: 51, code: "COL" },
                                { name: "Comoros", id: 52, code: "COM" },
                                { name: "Congo", id: 53, code: "COG" },
                                { name: "Costa Rica", id: 54, code: "CRI" },
                                { name: "Côte d'Ivoire", id: 55, code: "CIV" },
                                { name: "Croatia", id: 56, code: "HRV" },
                                { name: "Cuba", id: 57, code: "CUB" },
                                { name: "Curaçao", id: 58, code: "CUW" },
                                { name: "Cyprus", id: 59, code: "CYP" },
                                { name: "Czechia", id: 60, code: "CZE" },
                                { name: "Zimbabwe", id: 243, code: "ZWE" },
                                { name: "Åland Islands", id: 244, code: "ALA" },
                                {
                                    name: "Saint Barthélemy",
                                    id: 245,
                                    code: "BLM",
                                },
                                { name: "Armenia", id: 18, code: "ARM" },
                                { name: "Aruba", id: 19, code: "ABW" },
                                { name: "Australia", id: 20, code: "AUS" },
                                { name: "Austria", id: 21, code: "AUT" },
                                { name: "Azerbaijan", id: 22, code: "AZE" },
                                { name: "Bahamas", id: 23, code: "BHS" },
                                { name: "Bahrain", id: 24, code: "BHR" },
                                { name: "Bangladesh", id: 25, code: "BGD" },
                                { name: "Barbados", id: 26, code: "BRB" },
                                { name: "Belarus", id: 27, code: "BLR" },
                                { name: "Belgium", id: 28, code: "BEL" },
                                { name: "Belize", id: 29, code: "BLZ" },
                                { name: "Benin", id: 30, code: "BEN" },
                                { name: "Bermuda", id: 31, code: "BMU" },
                                { name: "Bhutan", id: 32, code: "BTN" },
                                { name: "Bolivia", id: 33, code: "BOL" },
                                { name: "Bonaire", id: 34, code: "BES" },
                                {
                                    name: "Bosnia and Herzegovina",
                                    id: 35,
                                    code: "BIH",
                                },
                                { name: "Botswana", id: 36, code: "BWA" },
                                { name: "Brazil", id: 37, code: "BRA" },
                                { name: "Yemen", id: 179, code: "YEM" },
                                { name: "Zambia", id: 180, code: "ZMB" },
                                { name: "Aland Islands", id: 246, code: "ALA" },
                                { name: "Saint Helena", id: 247, code: "SHN" },
                                { name: "Seychelles", id: 248, code: "SYC" },
                                {
                                    name: "Solomon Islands",
                                    id: 249,
                                    code: "SLB",
                                },
                                { name: "Turkmenistan", id: 250, code: "TKM" },
                                { name: "Russia", id: 61, code: "RUS" },
                                { name: "Canada", id: 45, code: "CAN" },
                                { name: "United States", id: 193, code: "USA" },
                                { name: "China", id: 50, code: "CHN" },
                                { name: "Brazil", id: 37, code: "BRA" },
                                { name: "Australia", id: 20, code: "AUS" },
                                { name: "India", id: 62, code: "IND" },
                                { name: "Argentina", id: 63, code: "ARG" },
                                { name: "Kazakhstan", id: 64, code: "KAZ" },
                                { name: "Algeria", id: 3, code: "DZA" },
                            ],
                        },
                        years: {
                            values: [
                                {
                                    id: 2000,
                                },
                                {
                                    id: 2010,
                                },
                            ],
                        },
                    },
                },
            },
        ],
    ]),
    queryStr: "?time=2002",
}
