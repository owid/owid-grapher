export interface Country {
    name: string
    code: string
    slug: string
    iso3166?: string
    variantNames?: string[]
}

interface FilterableCountry extends Country {
    filter?: true
}

const allCountries: FilterableCountry[] = [
    {
        name: "Aruba",
        code: "ABW",
        slug: "aruba",
        iso3166: "AW"
    },
    {
        name: "Afghanistan",
        code: "AFG",
        slug: "afghanistan",
        iso3166: "AF"
    },
    {
        name: "Angola",
        code: "AGO",
        slug: "angola",
        iso3166: "AO"
    },
    {
        name: "Anguilla",
        code: "AIA",
        slug: "anguilla",
        iso3166: "AI"
    },
    {
        name: "Åland Islands",
        code: "ALA",
        slug: "aland-islands",
        filter: true
    },
    {
        name: "Albania",
        code: "ALB",
        slug: "albania",
        iso3166: "AL"
    },
    {
        name: "Andorra",
        code: "AND",
        slug: "andorra",
        iso3166: "AD"
    },
    {
        name: "Netherlands Antilles",
        code: "ANT",
        slug: "netherlands-antilles",
        filter: true
    },
    {
        name: "United Arab Emirates",
        code: "ARE",
        slug: "united-arab-emirates",
        iso3166: "AE"
    },
    {
        name: "Argentina",
        code: "ARG",
        slug: "argentina",
        iso3166: "AR"
    },
    {
        name: "Armenia",
        code: "ARM",
        slug: "armenia",
        iso3166: "AM"
    },
    {
        name: "American Samoa",
        code: "ASM",
        slug: "american-samoa",
        iso3166: "AS"
    },
    {
        name: "Antarctica",
        code: "ATA",
        slug: "antarctica",
        filter: true,
        iso3166: "AQ"
    },
    {
        name: "French Southern Territories",
        code: "ATF",
        slug: "french-southern-territories",
        filter: true,
        iso3166: "TF"
    },
    {
        name: "Antigua and Barbuda",
        code: "ATG",
        slug: "antigua-and-barbuda",
        iso3166: "AG"
    },
    {
        name: "Australia",
        code: "AUS",
        slug: "australia",
        iso3166: "AU"
    },
    {
        name: "Austria",
        code: "AUT",
        slug: "austria",
        iso3166: "AT"
    },
    {
        name: "Azerbaijan",
        code: "AZE",
        slug: "azerbaijan",
        iso3166: "AZ"
    },
    {
        name: "Burundi",
        code: "BDI",
        slug: "burundi",
        iso3166: "BI"
    },
    {
        name: "Belgium",
        code: "BEL",
        slug: "belgium",
        iso3166: "BE"
    },
    {
        name: "Benin",
        code: "BEN",
        slug: "benin",
        iso3166: "BJ"
    },
    {
        name: "Bonaire Sint Eustatius and Saba",
        code: "BES",
        slug: "bonaire-sint-eustatius-and-saba",
        filter: true
    },
    {
        name: "Burkina Faso",
        code: "BFA",
        slug: "burkina-faso",
        iso3166: "BF"
    },
    {
        name: "Bangladesh",
        code: "BGD",
        slug: "bangladesh",
        iso3166: "BD"
    },
    {
        name: "Bulgaria",
        code: "BGR",
        slug: "bulgaria",
        iso3166: "BG"
    },
    {
        name: "Bahrain",
        code: "BHR",
        slug: "bahrain",
        iso3166: "BH"
    },
    {
        name: "Bahamas",
        code: "BHS",
        slug: "bahamas",
        iso3166: "BS"
    },
    {
        name: "Bosnia and Herzegovina",
        code: "BIH",
        slug: "bosnia-and-herzegovina",
        iso3166: "BA"
    },
    {
        name: "Saint Barthélemy",
        code: "BLM",
        slug: "saint-barthelemy"
    },
    {
        name: "Belarus",
        code: "BLR",
        slug: "belarus",
        iso3166: "BY"
    },
    {
        name: "Belize",
        code: "BLZ",
        slug: "belize",
        iso3166: "BZ"
    },
    {
        name: "Bermuda",
        code: "BMU",
        slug: "bermuda",
        iso3166: "BM"
    },
    {
        name: "Bolivia",
        code: "BOL",
        slug: "bolivia",
        iso3166: "BO"
    },
    {
        name: "Brazil",
        code: "BRA",
        slug: "brazil",
        iso3166: "BR"
    },
    {
        name: "Barbados",
        code: "BRB",
        slug: "barbados",
        iso3166: "BB"
    },
    {
        name: "Brunei",
        code: "BRN",
        slug: "brunei"
    },
    {
        name: "Bhutan",
        code: "BTN",
        slug: "bhutan",
        iso3166: "BT"
    },
    {
        name: "Bouvet Island",
        code: "BVT",
        slug: "bouvet-island",
        filter: true,
        iso3166: "BV"
    },
    {
        name: "Botswana",
        code: "BWA",
        slug: "botswana",
        iso3166: "BW"
    },
    {
        name: "Central African Republic",
        code: "CAF",
        slug: "central-african-republic",
        iso3166: "CF"
    },
    {
        name: "Canada",
        code: "CAN",
        slug: "canada",
        iso3166: "CA"
    },
    {
        name: "Cocos Islands",
        code: "CCK",
        slug: "cocos-islands",
        filter: true
    },
    {
        name: "Switzerland",
        code: "CHE",
        slug: "switzerland",
        iso3166: "CH"
    },
    {
        name: "Chile",
        code: "CHL",
        slug: "chile",
        iso3166: "CL"
    },
    {
        name: "China",
        code: "CHN",
        slug: "china",
        iso3166: "CN"
    },
    {
        name: "Cote d'Ivoire",
        code: "CIV",
        slug: "cote-divoire",
        iso3166: "CI"
    },
    {
        name: "Cameroon",
        code: "CMR",
        slug: "cameroon",
        iso3166: "CM"
    },
    {
        name: "Democratic Republic of Congo",
        code: "COD",
        slug: "democratic-republic-of-congo"
    },
    {
        name: "Congo",
        code: "COG",
        slug: "congo",
        iso3166: "CG"
    },
    {
        name: "Cook Islands",
        code: "COK",
        slug: "cook-islands",
        filter: true,
        iso3166: "CK"
    },
    {
        name: "Colombia",
        code: "COL",
        slug: "colombia",
        iso3166: "CO"
    },
    {
        name: "Comoros",
        code: "COM",
        slug: "comoros",
        iso3166: "KM"
    },
    {
        name: "Cape Verde",
        code: "CPV",
        slug: "cape-verde",
        iso3166: "CV"
    },
    {
        name: "Costa Rica",
        code: "CRI",
        slug: "costa-rica",
        iso3166: "CR"
    },
    {
        name: "Cuba",
        code: "CUB",
        slug: "cuba",
        iso3166: "CU"
    },
    {
        name: "Curacao",
        code: "CUW",
        slug: "curacao",
        filter: true,
        iso3166: "CW"
    },
    {
        name: "Christmas Island",
        code: "CXR",
        slug: "christmas-island",
        iso3166: "CX"
    },
    {
        name: "Cayman Islands",
        code: "CYM",
        slug: "cayman-islands",
        iso3166: "KY"
    },
    {
        name: "Cyprus",
        code: "CYP",
        slug: "cyprus",
        iso3166: "CY"
    },
    {
        name: "Czech Republic",
        code: "CZE",
        slug: "czech-republic",
        iso3166: "CZ"
    },
    {
        name: "Germany",
        code: "DEU",
        slug: "germany",
        iso3166: "DE"
    },
    {
        name: "Djibouti",
        code: "DJI",
        slug: "djibouti",
        iso3166: "DJ"
    },
    {
        name: "Dominica",
        code: "DMA",
        slug: "dominica",
        iso3166: "DM"
    },
    {
        name: "Denmark",
        code: "DNK",
        slug: "denmark",
        iso3166: "DK"
    },
    {
        name: "Dominican Republic",
        code: "DOM",
        slug: "dominican-republic",
        iso3166: "DO"
    },
    {
        name: "Algeria",
        code: "DZA",
        slug: "algeria",
        iso3166: "DZ"
    },
    {
        name: "Ecuador",
        code: "ECU",
        slug: "ecuador",
        iso3166: "EC"
    },
    {
        name: "Egypt",
        code: "EGY",
        slug: "egypt",
        iso3166: "EG"
    },
    {
        name: "Eritrea",
        code: "ERI",
        slug: "eritrea",
        iso3166: "ER"
    },
    {
        name: "Western Sahara",
        code: "ESH",
        slug: "western-sahara",
        filter: true,
        iso3166: "EH"
    },
    {
        name: "Spain",
        code: "ESP",
        slug: "spain",
        iso3166: "ES"
    },
    {
        name: "Estonia",
        code: "EST",
        slug: "estonia",
        iso3166: "EE"
    },
    {
        name: "Ethiopia",
        code: "ETH",
        slug: "ethiopia",
        iso3166: "ET"
    },
    {
        name: "Finland",
        code: "FIN",
        slug: "finland",
        iso3166: "FI"
    },
    {
        name: "Fiji",
        code: "FJI",
        slug: "fiji",
        iso3166: "FJ"
    },
    {
        name: "Falkland Islands",
        code: "FLK",
        slug: "falkland-islands"
    },
    {
        name: "France",
        code: "FRA",
        slug: "france",
        iso3166: "FR"
    },
    {
        name: "Faeroe Islands",
        code: "FRO",
        slug: "faeroe-islands"
    },
    {
        name: "Micronesia (country)",
        code: "FSM",
        slug: "micronesia-country"
    },
    {
        name: "Gabon",
        code: "GAB",
        slug: "gabon",
        iso3166: "GA"
    },
    {
        name: "United Kingdom",
        code: "GBR",
        slug: "united-kingdom",
        variantNames: ["UK"],
        iso3166: "GB"
    },
    {
        name: "Georgia",
        code: "GEO",
        slug: "georgia",
        iso3166: "GE"
    },
    {
        name: "Guernsey",
        code: "GGY",
        slug: "guernsey",
        filter: true,
        iso3166: "GG"
    },
    {
        name: "Ghana",
        code: "GHA",
        slug: "ghana",
        iso3166: "GH"
    },
    {
        name: "Gibraltar",
        code: "GIB",
        slug: "gibraltar",
        iso3166: "GI"
    },
    {
        name: "Guinea",
        code: "GIN",
        slug: "guinea",
        iso3166: "GN"
    },
    {
        name: "Guadeloupe",
        code: "GLP",
        slug: "guadeloupe",
        filter: true,
        iso3166: "GP"
    },
    {
        name: "Gambia",
        code: "GMB",
        slug: "gambia",
        iso3166: "GM"
    },
    {
        name: "Guinea-Bissau",
        code: "GNB",
        slug: "guinea-bissau",
        iso3166: "GW"
    },
    {
        name: "Equatorial Guinea",
        code: "GNQ",
        slug: "equatorial-guinea",
        iso3166: "GQ"
    },
    {
        name: "Greece",
        code: "GRC",
        slug: "greece",
        iso3166: "GR"
    },
    {
        name: "Grenada",
        code: "GRD",
        slug: "grenada",
        iso3166: "GD"
    },
    {
        name: "Greenland",
        code: "GRL",
        slug: "greenland",
        iso3166: "GL"
    },
    {
        name: "Guatemala",
        code: "GTM",
        slug: "guatemala",
        iso3166: "GT"
    },
    {
        name: "French Guiana",
        code: "GUF",
        slug: "french-guiana",
        iso3166: "GF"
    },
    {
        name: "Guam",
        code: "GUM",
        slug: "guam",
        iso3166: "GU"
    },
    {
        name: "Guyana",
        code: "GUY",
        slug: "guyana",
        iso3166: "GY"
    },
    {
        name: "Hong Kong",
        code: "HKG",
        slug: "hong-kong",
        iso3166: "HK"
    },
    {
        name: "Heard Island and McDonald Islands",
        code: "HMD",
        slug: "heard-island-and-mcdonald-islands",
        filter: true,
        iso3166: "HM"
    },
    {
        name: "Honduras",
        code: "HND",
        slug: "honduras",
        iso3166: "HN"
    },
    {
        name: "Croatia",
        code: "HRV",
        slug: "croatia",
        iso3166: "HR"
    },
    {
        name: "Haiti",
        code: "HTI",
        slug: "haiti",
        iso3166: "HT"
    },
    {
        name: "Hungary",
        code: "HUN",
        slug: "hungary",
        iso3166: "HU"
    },
    {
        name: "Indonesia",
        code: "IDN",
        slug: "indonesia",
        iso3166: "ID"
    },
    {
        name: "Isle of Man",
        code: "IMN",
        slug: "isle-of-man",
        iso3166: "IM"
    },
    {
        name: "India",
        code: "IND",
        slug: "india",
        iso3166: "IN"
    },
    {
        name: "British Indian Ocean Territory",
        code: "IOT",
        slug: "british-indian-ocean-territory",
        filter: true,
        iso3166: "IO"
    },
    {
        name: "Ireland",
        code: "IRL",
        slug: "ireland",
        iso3166: "IE"
    },
    {
        name: "Iran",
        code: "IRN",
        slug: "iran"
    },
    {
        name: "Iraq",
        code: "IRQ",
        slug: "iraq",
        iso3166: "IQ"
    },
    {
        name: "Iceland",
        code: "ISL",
        slug: "iceland",
        iso3166: "IS"
    },
    {
        name: "Israel",
        code: "ISR",
        slug: "israel",
        iso3166: "IL"
    },
    {
        name: "Italy",
        code: "ITA",
        slug: "italy",
        iso3166: "IT"
    },
    {
        name: "Jamaica",
        code: "JAM",
        slug: "jamaica",
        iso3166: "JM"
    },
    {
        name: "Jersey",
        code: "JEY",
        slug: "jersey",
        iso3166: "JE"
    },
    {
        name: "Jordan",
        code: "JOR",
        slug: "jordan",
        iso3166: "JO"
    },
    {
        name: "Japan",
        code: "JPN",
        slug: "japan",
        iso3166: "JP"
    },
    {
        name: "Kazakhstan",
        code: "KAZ",
        slug: "kazakhstan",
        iso3166: "KZ"
    },
    {
        name: "Kenya",
        code: "KEN",
        slug: "kenya",
        iso3166: "KE"
    },
    {
        name: "Kyrgyzstan",
        code: "KGZ",
        slug: "kyrgyzstan",
        iso3166: "KG"
    },
    {
        name: "Cambodia",
        code: "KHM",
        slug: "cambodia",
        iso3166: "KH"
    },
    {
        name: "Kiribati",
        code: "KIR",
        slug: "kiribati",
        iso3166: "KI"
    },
    {
        name: "Saint Kitts and Nevis",
        code: "KNA",
        slug: "saint-kitts-and-nevis",
        iso3166: "KN"
    },
    {
        name: "South Korea",
        code: "KOR",
        slug: "south-korea"
    },
    {
        name: "Kuwait",
        code: "KWT",
        slug: "kuwait",
        iso3166: "KW"
    },
    {
        name: "Laos",
        code: "LAO",
        slug: "laos"
    },
    {
        name: "Lebanon",
        code: "LBN",
        slug: "lebanon",
        iso3166: "LB"
    },
    {
        name: "Liberia",
        code: "LBR",
        slug: "liberia",
        iso3166: "LR"
    },
    {
        name: "Libya",
        code: "LBY",
        slug: "libya"
    },
    {
        name: "Saint Lucia",
        code: "LCA",
        slug: "saint-lucia",
        iso3166: "LC"
    },
    {
        name: "Liechtenstein",
        code: "LIE",
        slug: "liechtenstein",
        iso3166: "LI"
    },
    {
        name: "Sri Lanka",
        code: "LKA",
        slug: "sri-lanka",
        iso3166: "LK"
    },
    {
        name: "Lesotho",
        code: "LSO",
        slug: "lesotho",
        iso3166: "LS"
    },
    {
        name: "Lithuania",
        code: "LTU",
        slug: "lithuania",
        iso3166: "LT"
    },
    {
        name: "Luxembourg",
        code: "LUX",
        slug: "luxembourg",
        iso3166: "LU"
    },
    {
        name: "Latvia",
        code: "LVA",
        slug: "latvia",
        iso3166: "LV"
    },
    {
        name: "Macao",
        code: "MAC",
        slug: "macao",
        iso3166: "MO"
    },
    {
        name: "Saint Martin (French part)",
        code: "MAF",
        slug: "saint-martin-french-part",
        filter: true
    },
    {
        name: "Morocco",
        code: "MAR",
        slug: "morocco",
        iso3166: "MA"
    },
    {
        name: "Monaco",
        code: "MCO",
        slug: "monaco",
        iso3166: "MC"
    },
    {
        name: "Moldova",
        code: "MDA",
        slug: "moldova"
    },
    {
        name: "Madagascar",
        code: "MDG",
        slug: "madagascar",
        iso3166: "MG"
    },
    {
        name: "Maldives",
        code: "MDV",
        slug: "maldives",
        iso3166: "MV"
    },
    {
        name: "Mexico",
        code: "MEX",
        slug: "mexico",
        iso3166: "MX"
    },
    {
        name: "Marshall Islands",
        code: "MHL",
        slug: "marshall-islands",
        iso3166: "MH"
    },
    {
        name: "Macedonia",
        code: "MKD",
        slug: "macedonia",
        iso3166: "MK"
    },
    {
        name: "Mali",
        code: "MLI",
        slug: "mali",
        iso3166: "ML"
    },
    {
        name: "Malta",
        code: "MLT",
        slug: "malta",
        iso3166: "MT"
    },
    {
        name: "Myanmar",
        code: "MMR",
        slug: "myanmar",
        iso3166: "MM"
    },
    {
        name: "Montenegro",
        code: "MNE",
        slug: "montenegro",
        iso3166: "ME"
    },
    {
        name: "Mongolia",
        code: "MNG",
        slug: "mongolia",
        iso3166: "MN"
    },
    {
        name: "Northern Mariana Islands",
        code: "MNP",
        slug: "northern-mariana-islands",
        iso3166: "MP"
    },
    {
        name: "Mozambique",
        code: "MOZ",
        slug: "mozambique",
        iso3166: "MZ"
    },
    {
        name: "Mauritania",
        code: "MRT",
        slug: "mauritania",
        iso3166: "MR"
    },
    {
        name: "Montserrat",
        code: "MSR",
        slug: "montserrat",
        filter: true,
        iso3166: "MS"
    },
    {
        name: "Martinique",
        code: "MTQ",
        slug: "martinique",
        iso3166: "MQ"
    },
    {
        name: "Mauritius",
        code: "MUS",
        slug: "mauritius",
        iso3166: "MU"
    },
    {
        name: "Malawi",
        code: "MWI",
        slug: "malawi",
        iso3166: "MW"
    },
    {
        name: "Malaysia",
        code: "MYS",
        slug: "malaysia",
        iso3166: "MY"
    },
    {
        name: "Mayotte",
        code: "MYT",
        slug: "mayotte",
        iso3166: "YT"
    },
    {
        name: "Namibia",
        code: "NAM",
        slug: "namibia",
        iso3166: "NA"
    },
    {
        name: "New Caledonia",
        code: "NCL",
        slug: "new-caledonia",
        iso3166: "NC"
    },
    {
        name: "Niger",
        code: "NER",
        slug: "niger",
        iso3166: "NE"
    },
    {
        name: "Norfolk Island",
        code: "NFK",
        slug: "norfolk-island",
        iso3166: "NF"
    },
    {
        name: "Nigeria",
        code: "NGA",
        slug: "nigeria",
        iso3166: "NG"
    },
    {
        name: "Nicaragua",
        code: "NIC",
        slug: "nicaragua",
        iso3166: "NI"
    },
    {
        name: "Niue",
        code: "NIU",
        slug: "niue",
        iso3166: "NU"
    },
    {
        name: "Netherlands",
        code: "NLD",
        slug: "netherlands",
        iso3166: "NL"
    },
    {
        name: "Norway",
        code: "NOR",
        slug: "norway",
        iso3166: "NO"
    },
    {
        name: "Nepal",
        code: "NPL",
        slug: "nepal",
        iso3166: "NP"
    },
    {
        name: "Nauru",
        code: "NRU",
        slug: "nauru",
        iso3166: "NR"
    },
    {
        name: "New Zealand",
        code: "NZL",
        slug: "new-zealand",
        iso3166: "NZ"
    },
    {
        name: "Oman",
        code: "OMN",
        slug: "oman",
        iso3166: "OM"
    },
    {
        name: "Pakistan",
        code: "PAK",
        slug: "pakistan",
        iso3166: "PK"
    },
    {
        name: "Panama",
        code: "PAN",
        slug: "panama",
        iso3166: "PA"
    },
    {
        name: "Pitcairn",
        code: "PCN",
        slug: "pitcairn",
        iso3166: "PN"
    },
    {
        name: "Peru",
        code: "PER",
        slug: "peru",
        iso3166: "PE"
    },
    {
        name: "Philippines",
        code: "PHL",
        slug: "philippines",
        iso3166: "PH"
    },
    {
        name: "Palau",
        code: "PLW",
        slug: "palau",
        iso3166: "PW"
    },
    {
        name: "Papua New Guinea",
        code: "PNG",
        slug: "papua-new-guinea",
        iso3166: "PG"
    },
    {
        name: "Poland",
        code: "POL",
        slug: "poland",
        iso3166: "PL"
    },
    {
        name: "Puerto Rico",
        code: "PRI",
        slug: "puerto-rico",
        iso3166: "PR"
    },
    {
        name: "North Korea",
        code: "PRK",
        slug: "north-korea"
    },
    {
        name: "Portugal",
        code: "PRT",
        slug: "portugal",
        iso3166: "PT"
    },
    {
        name: "Paraguay",
        code: "PRY",
        slug: "paraguay",
        iso3166: "PY"
    },
    {
        name: "Palestine",
        code: "PSE",
        slug: "palestine"
    },
    {
        name: "French Polynesia",
        code: "PYF",
        slug: "french-polynesia",
        iso3166: "PF"
    },
    {
        name: "Qatar",
        code: "QAT",
        slug: "qatar",
        iso3166: "QA"
    },
    {
        name: "Reunion",
        code: "REU",
        slug: "reunion",
        iso3166: "RE"
    },
    {
        name: "Romania",
        code: "ROU",
        slug: "romania",
        iso3166: "RO"
    },
    {
        name: "Russia",
        code: "RUS",
        slug: "russia"
    },
    {
        name: "Rwanda",
        code: "RWA",
        slug: "rwanda",
        iso3166: "RW"
    },
    {
        name: "Saudi Arabia",
        code: "SAU",
        slug: "saudi-arabia",
        iso3166: "SA"
    },
    {
        name: "Sudan",
        code: "SDN",
        slug: "sudan",
        iso3166: "SD"
    },
    {
        name: "Senegal",
        code: "SEN",
        slug: "senegal",
        iso3166: "SN"
    },
    {
        name: "Singapore",
        code: "SGP",
        slug: "singapore",
        iso3166: "SG"
    },
    {
        name: "South Georgia and the South Sandwich Islands",
        code: "SGS",
        slug: "south-georgia-and-the-south-sandwich-islands",
        filter: true,
        iso3166: "GS"
    },
    {
        name: "Saint Helena",
        code: "SHN",
        slug: "saint-helena",
        filter: true,
        iso3166: "SH"
    },
    {
        name: "Svalbard and Jan Mayen",
        code: "SJM",
        slug: "svalbard-and-jan-mayen",
        filter: true,
        iso3166: "SJ"
    },
    {
        name: "Solomon Islands",
        code: "SLB",
        slug: "solomon-islands",
        iso3166: "SB"
    },
    {
        name: "Sierra Leone",
        code: "SLE",
        slug: "sierra-leone",
        iso3166: "SL"
    },
    {
        name: "El Salvador",
        code: "SLV",
        slug: "el-salvador",
        iso3166: "SV"
    },
    {
        name: "San Marino",
        code: "SMR",
        slug: "san-marino",
        iso3166: "SM"
    },
    {
        name: "Somalia",
        code: "SOM",
        slug: "somalia",
        iso3166: "SO"
    },
    {
        name: "Saint Pierre and Miquelon",
        code: "SPM",
        slug: "saint-pierre-and-miquelon",
        iso3166: "PM"
    },
    {
        name: "Serbia",
        code: "SRB",
        slug: "serbia",
        iso3166: "RS"
    },
    {
        name: "South Sudan",
        code: "SSD",
        slug: "south-sudan",
        iso3166: "SS"
    },
    {
        name: "Sao Tome and Principe",
        code: "STP",
        slug: "sao-tome-and-principe",
        iso3166: "ST"
    },
    {
        name: "Suriname",
        code: "SUR",
        slug: "suriname",
        iso3166: "SR"
    },
    {
        name: "Slovakia",
        code: "SVK",
        slug: "slovakia",
        iso3166: "SK"
    },
    {
        name: "Slovenia",
        code: "SVN",
        slug: "slovenia",
        iso3166: "SI"
    },
    {
        name: "Sweden",
        code: "SWE",
        slug: "sweden",
        iso3166: "SE"
    },
    {
        name: "Swaziland",
        code: "SWZ",
        slug: "swaziland",
        iso3166: "SZ"
    },
    {
        name: "Seychelles",
        code: "SYC",
        slug: "seychelles",
        iso3166: "SC"
    },
    {
        name: "Syria",
        code: "SYR",
        slug: "syria"
    },
    {
        name: "Turks and Caicos Islands",
        code: "TCA",
        slug: "turks-and-caicos-islands",
        iso3166: "TC"
    },
    {
        name: "Chad",
        code: "TCD",
        slug: "chad",
        iso3166: "TD"
    },
    {
        name: "Togo",
        code: "TGO",
        slug: "togo",
        iso3166: "TG"
    },
    {
        name: "Thailand",
        code: "THA",
        slug: "thailand",
        iso3166: "TH"
    },
    {
        name: "Tajikistan",
        code: "TJK",
        slug: "tajikistan",
        iso3166: "TJ"
    },
    {
        name: "Tokelau",
        code: "TKL",
        slug: "tokelau",
        iso3166: "TK"
    },
    {
        name: "Turkmenistan",
        code: "TKM",
        slug: "turkmenistan",
        iso3166: "TM"
    },
    {
        name: "Timor",
        code: "TLS",
        slug: "timor"
    },
    {
        name: "Tonga",
        code: "TON",
        slug: "tonga",
        iso3166: "TO"
    },
    {
        name: "Trinidad and Tobago",
        code: "TTO",
        slug: "trinidad-and-tobago",
        iso3166: "TT"
    },
    {
        name: "Tunisia",
        code: "TUN",
        slug: "tunisia",
        iso3166: "TN"
    },
    {
        name: "Turkey",
        code: "TUR",
        slug: "turkey",
        iso3166: "TR"
    },
    {
        name: "Tuvalu",
        code: "TUV",
        slug: "tuvalu",
        iso3166: "TV"
    },
    {
        name: "Taiwan",
        code: "TWN",
        slug: "taiwan",
        iso3166: "TW"
    },
    {
        name: "Tanzania",
        code: "TZA",
        slug: "tanzania"
    },
    {
        name: "Uganda",
        code: "UGA",
        slug: "uganda",
        iso3166: "UG"
    },
    {
        name: "Ukraine",
        code: "UKR",
        slug: "ukraine",
        iso3166: "UA"
    },
    {
        name: "United States Minor Outlying Islands",
        code: "UMI",
        slug: "united-states-minor-outlying-islands",
        filter: true,
        iso3166: "UM"
    },
    {
        name: "Uruguay",
        code: "URY",
        slug: "uruguay",
        iso3166: "UY"
    },
    {
        name: "United States",
        code: "USA",
        slug: "united-states",
        variantNames: ["US", "USA"],
        iso3166: "US"
    },
    {
        name: "Uzbekistan",
        code: "UZB",
        slug: "uzbekistan",
        iso3166: "UZ"
    },
    {
        name: "Vatican",
        code: "VAT",
        slug: "vatican"
    },
    {
        name: "Saint Vincent and the Grenadines",
        code: "VCT",
        slug: "saint-vincent-and-the-grenadines",
        iso3166: "VC"
    },
    {
        name: "Venezuela",
        code: "VEN",
        slug: "venezuela",
        iso3166: "VE"
    },
    {
        name: "British Virgin Islands",
        code: "VGB",
        slug: "british-virgin-islands"
    },
    {
        name: "United States Virgin Islands",
        code: "VIR",
        slug: "united-states-virgin-islands"
    },
    {
        name: "Vietnam",
        code: "VNM",
        slug: "vietnam",
        iso3166: "VN"
    },
    {
        name: "Vanuatu",
        code: "VUT",
        slug: "vanuatu",
        iso3166: "VU"
    },
    {
        name: "Wallis and Futuna",
        code: "WLF",
        slug: "wallis-and-futuna",
        filter: true,
        iso3166: "WF"
    },
    {
        name: "Samoa",
        code: "WSM",
        slug: "samoa",
        iso3166: "WS"
    },
    {
        name: "Yemen",
        code: "YEM",
        slug: "yemen",
        iso3166: "YE"
    },
    {
        name: "South Africa",
        code: "ZAF",
        slug: "south-africa",
        iso3166: "ZA"
    },
    {
        name: "Zambia",
        code: "ZMB",
        slug: "zambia",
        iso3166: "ZM"
    },
    {
        name: "Zimbabwe",
        code: "ZWE",
        slug: "zimbabwe",
        iso3166: "ZW"
    }
]

export const countries: Country[] = allCountries.filter(
    country => !country.filter
)

export const getCountry = (slug: string): Country | undefined => {
    return countries.find(c => c.slug === slug)
}
