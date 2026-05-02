import { EntityName } from "@ourworldindata/types"

// ISO 3166-1 numeric country codes used by the OWID population cartogram layout.
// Values are OWID entity names from regions.data.ts.
export const CARTOGRAM_COUNTRY_CODE_TO_ENTITY_NAME: Record<string, EntityName> =
    {
        "004": "Afghanistan", // AFG
        "008": "Albania", // ALB
        "012": "Algeria", // DZA
        "024": "Angola", // AGO
        "031": "Azerbaijan", // AZE
        "032": "Argentina", // ARG
        "036": "Australia", // AUS
        "040": "Austria", // AUT
        "044": "Bahamas", // BHS
        "048": "Bahrain", // BHR
        "050": "Bangladesh", // BGD
        "051": "Armenia", // ARM
        "052": "Barbados", // BRB
        "056": "Belgium", // BEL
        "064": "Bhutan", // BTN
        "068": "Bolivia", // BOL
        "070": "Bosnia and Herzegovina", // BIH
        "072": "Botswana", // BWA
        "076": "Brazil", // BRA
        "084": "Belize", // BLZ
        "090": "Solomon Islands", // SLB
        "096": "Brunei", // BRN
        "100": "Bulgaria", // BGR
        "104": "Myanmar", // MMR
        "108": "Burundi", // BDI
        "112": "Belarus", // BLR
        "116": "Cambodia", // KHM
        "120": "Cameroon", // CMR
        "124": "Canada", // CAN
        "132": "Cape Verde", // CPV
        "140": "Central African Republic", // CAF
        "144": "Sri Lanka", // LKA
        "148": "Chad", // TCD
        "152": "Chile", // CHL
        "156": "China", // CHN
        "158": "Taiwan", // TWN
        "170": "Colombia", // COL
        "174": "Comoros", // COM
        "175": "Mayotte", // MYT
        "178": "Congo", // COG
        "180": "Democratic Republic of Congo", // COD
        "188": "Costa Rica", // CRI
        "191": "Croatia", // HRV
        "192": "Cuba", // CUB
        "196": "Cyprus", // CYP
        "203": "Czechia", // CZE
        "204": "Benin", // BEN
        "208": "Denmark", // DNK
        "214": "Dominican Republic", // DOM
        "218": "Ecuador", // ECU
        "222": "El Salvador", // SLV
        "226": "Equatorial Guinea", // GNQ
        "231": "Ethiopia", // ETH
        "232": "Eritrea", // ERI
        "233": "Estonia", // EST
        "242": "Fiji", // FJI
        "246": "Finland", // FIN
        "250": "France", // FRA
        "254": "French Guiana", // GUF
        "258": "French Polynesia", // PYF
        "262": "Djibouti", // DJI
        "266": "Gabon", // GAB
        "268": "Georgia", // GEO
        "270": "Gambia", // GMB
        "275": "Palestine", // PSE
        "276": "Germany", // DEU
        "288": "Ghana", // GHA
        "300": "Greece", // GRC
        "312": "Guadeloupe", // GLP
        "320": "Guatemala", // GTM
        "324": "Guinea", // GIN
        "328": "Guyana", // GUY
        "332": "Haiti", // HTI
        "340": "Honduras", // HND
        "344": "Hong Kong", // HKG
        "348": "Hungary", // HUN
        "352": "Iceland", // ISL
        "356": "India", // IND
        "360": "Indonesia", // IDN
        "364": "Iran", // IRN
        "368": "Iraq", // IRQ
        "372": "Ireland", // IRL
        "376": "Israel", // ISR
        "380": "Italy", // ITA
        "384": "Cote d'Ivoire", // CIV
        "388": "Jamaica", // JAM
        "392": "Japan", // JPN
        "398": "Kazakhstan", // KAZ
        "400": "Jordan", // JOR
        "404": "Kenya", // KEN
        "408": "North Korea", // PRK
        "410": "South Korea", // KOR
        "414": "Kuwait", // KWT
        "417": "Kyrgyzstan", // KGZ
        "418": "Laos", // LAO
        "422": "Lebanon", // LBN
        "426": "Lesotho", // LSO
        "428": "Latvia", // LVA
        "430": "Liberia", // LBR
        "434": "Libya", // LBY
        "440": "Lithuania", // LTU
        "442": "Luxembourg", // LUX
        "446": "Macao", // MAC
        "450": "Madagascar", // MDG
        "454": "Malawi", // MWI
        "458": "Malaysia", // MYS
        "462": "Maldives", // MDV
        "466": "Mali", // MLI
        "470": "Malta", // MLT
        "474": "Martinique", // MTQ
        "478": "Mauritania", // MRT
        "480": "Mauritius", // MUS
        "484": "Mexico", // MEX
        "496": "Mongolia", // MNG
        "498": "Moldova", // MDA
        "499": "Montenegro", // MNE
        "504": "Morocco", // MAR
        "508": "Mozambique", // MOZ
        "512": "Oman", // OMN
        "516": "Namibia", // NAM
        "524": "Nepal", // NPL
        "528": "Netherlands", // NLD
        "540": "New Caledonia", // NCL
        "548": "Vanuatu", // VUT
        "554": "New Zealand", // NZL
        "558": "Nicaragua", // NIC
        "562": "Niger", // NER
        "566": "Nigeria", // NGA
        "578": "Norway", // NOR
        "586": "Pakistan", // PAK
        "591": "Panama", // PAN
        "598": "Papua New Guinea", // PNG
        "600": "Paraguay", // PRY
        "604": "Peru", // PER
        "608": "Philippines", // PHL
        "616": "Poland", // POL
        "620": "Portugal", // PRT
        "624": "Guinea-Bissau", // GNB
        "626": "East Timor", // TLS
        "630": "Puerto Rico", // PRI
        "634": "Qatar", // QAT
        "638": "Reunion", // REU
        "642": "Romania", // ROU
        "643": "Russia", // RUS
        "646": "Rwanda", // RWA
        "682": "Saudi Arabia", // SAU
        "686": "Senegal", // SEN
        "688": "Serbia", // SRB
        "694": "Sierra Leone", // SLE
        "702": "Singapore", // SGP
        "703": "Slovakia", // SVK
        "704": "Vietnam", // VNM
        "705": "Slovenia", // SVN
        "706": "Somalia", // SOM
        "710": "South Africa", // ZAF
        "716": "Zimbabwe", // ZWE
        "724": "Spain", // ESP
        "728": "South Sudan", // SSD
        "729": "Sudan", // SDN
        "732": "Western Sahara", // ESH
        "740": "Suriname", // SUR
        "748": "Eswatini", // SWZ
        "752": "Sweden", // SWE
        "756": "Switzerland", // CHE
        "760": "Syria", // SYR
        "762": "Tajikistan", // TJK
        "764": "Thailand", // THA
        "768": "Togo", // TGO
        "780": "Trinidad and Tobago", // TTO
        "784": "United Arab Emirates", // ARE
        "788": "Tunisia", // TUN
        "792": "Turkey", // TUR
        "795": "Turkmenistan", // TKM
        "800": "Uganda", // UGA
        "804": "Ukraine", // UKR
        "807": "North Macedonia", // MKD
        "818": "Egypt", // EGY
        "826": "United Kingdom", // GBR
        "834": "Tanzania", // TZA
        "840": "United States", // USA
        "854": "Burkina Faso", // BFA
        "858": "Uruguay", // URY
        "860": "Uzbekistan", // UZB
        "862": "Venezuela", // VEN
        "887": "Yemen", // YEM
        "894": "Zambia", // ZMB
    }

export const CARTOGRAM_DATA_ENTITY_OVERRIDES: Record<EntityName, EntityName> = {
    "Hong Kong": "China",
    Macao: "China",
    Guadeloupe: "France",
    Martinique: "France",
    Mayotte: "France",
    "French Polynesia": "France",
    Reunion: "France",
}
