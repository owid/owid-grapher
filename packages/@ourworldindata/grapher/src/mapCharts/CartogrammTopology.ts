// This is a copy of the topo-json that has been created
// in https://github.com/mattdzugan/World-Population-Cartogram by
// @mattdzugan. I converted Max' manually created 2018 population
// cartogramm into a csv and then created a topo json out of it.
// I (Daniel) did some light postprocessing:
//   - at objects.countries.geometries I took the .properties.id
// .   numeric iso code and added an .id field one level up that
// .   uses our country names. This is how our normal map is
// .   structured and makes it easier to use this one as a drop-in
export const CartogrammTopology = {
    "type": "Topology",
    "bbox": [5.684341886080802e-14, 61.267605633802816, 1000, 438.7323943661972],
    "transform": {
        "scale": [0.000001000000001, 3.7746478910985917e-7],
        "translate": [5.684341886080802e-14, 61.267605633802816]
    },
    "objects": {
        "countries": {
            "type": "GeometryCollection",
            "geometries": [{
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [0, 1, 2, 3, 4, 5, 6]
                    ],
                    [
                        [7, 8, 9]
                    ]
                ],
                "properties": {
                    "id": "792"
                },
                "id": "Turkey"
            }, {
                "type": "Polygon",
                "arcs": [
                    [10]
                ],
                "properties": {
                    "id": "196"
                },
                "id": "Cyprus"
            }, {
                "type": "Polygon",
                "arcs": [
                    [11, 12, 13]
                ],
                "properties": {
                    "id": "422"
                },
                "id": "Lebanon"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [14, 15, 16]
                    ],
                    [
                        [17, 18, 19]
                    ],
                    [
                        [20, 21]
                    ]
                ],
                "properties": {
                    "id": "275"
                },
                "id": "Palestine"
            }, {
                "type": "Polygon",
                "arcs": [
                    [22, 23, -19, -22, 24, -14, 25, 26, -16, 27]
                ],
                "properties": {
                    "id": "376"
                },
                "id": "Israel"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-13, 28, -7, 29, 30, -26]
                ],
                "properties": {
                    "id": "760"
                },
                "id": "Syria"
            }, {
                "type": "Polygon",
                "arcs": [
                    [31, -17, -27, -31, 32, 33]
                ],
                "properties": {
                    "id": "400"
                },
                "id": "Jordan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [34, 35, 36, 37, -2]
                ],
                "properties": {
                    "id": "268"
                },
                "id": "Georgia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-34, 38, 39, 40, 41, 42, 43, 44]
                ],
                "properties": {
                    "id": "682"
                },
                "id": "Saudi Arabia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-38, 45, -3]
                ],
                "properties": {
                    "id": "51"
                },
                "id": "Armenia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-33, -30, -6, 46, 47, 48, -39]
                ],
                "properties": {
                    "id": "368"
                },
                "id": "Iraq"
            }, {
                "type": "Polygon",
                "arcs": [
                    [49, -36, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59]
                ],
                "properties": {
                    "id": "643"
                },
                "id": "Russia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-4, -46, -37, -50, 60, 61]
                ],
                "properties": {
                    "id": "31"
                },
                "id": "Azerbaijan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [62, -47, -5, -62, 63, 64, 65, 66, 67, 68]
                ],
                "properties": {
                    "id": "364"
                },
                "id": "Iran"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-44, 69, 70]
                ],
                "properties": {
                    "id": "887"
                },
                "id": "Yemen"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-40, -49, 71]
                ],
                "properties": {
                    "id": "414"
                },
                "id": "Kuwait"
            }, {
                "type": "Polygon",
                "arcs": [
                    [72, 73, 74, 75, 76, -66]
                ],
                "properties": {
                    "id": "860"
                },
                "id": "Uzbekistan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-42, 77, 78, 79, 80]
                ],
                "properties": {
                    "id": "784"
                },
                "id": "United Arab Emirates"
            }, {
                "type": "Polygon",
                "arcs": [
                    [81]
                ],
                "properties": {
                    "id": "48"
                },
                "id": "Bahrain"
            }, {
                "type": "Polygon",
                "arcs": [
                    [82, -79]
                ],
                "properties": {
                    "id": "634"
                },
                "id": "Qatar"
            }, {
                "type": "Polygon",
                "arcs": [
                    [83, -73, -65]
                ],
                "properties": {
                    "id": "795"
                },
                "id": "Turkmenistan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-43, -81, 84, -70]
                ],
                "properties": {
                    "id": "512"
                },
                "id": "Oman"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-75, 85, 86]
                ],
                "properties": {
                    "id": "398"
                },
                "id": "Kazakhstan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-77, 87, 88, 89, -67]
                ],
                "properties": {
                    "id": "762"
                },
                "id": "Tajikistan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [90, -69, 91, 92, 93]
                ],
                "properties": {
                    "id": "586"
                },
                "id": "Pakistan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-68, -90, 94, -92]
                ],
                "properties": {
                    "id": "4"
                },
                "id": "Afghanistan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-76, -87, 95, -88]
                ],
                "properties": {
                    "id": "417"
                },
                "id": "Kyrgyzstan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-94, 96, 97, 98, 99, 100, 101, 102, 103, 104]
                ],
                "properties": {
                    "id": "356"
                },
                "id": "India"
            }, {
                "type": "Polygon",
                "arcs": [
                    [105]
                ],
                "properties": {
                    "id": "462"
                },
                "id": "Maldives"
            }, {
                "type": "Polygon",
                "arcs": [
                    [106]
                ],
                "properties": {
                    "id": "144"
                },
                "id": "Sri Lanka"
            }, {
                "type": "Polygon",
                "arcs": [
                    [107, -99]
                ],
                "properties": {
                    "id": "524"
                },
                "id": "Nepal"
            }, {
                "type": "Polygon",
                "arcs": [
                    [108, -102, 109, -100, -108, -98, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119]
                ],
                "properties": {
                    "id": "156"
                },
                "id": "China"
            }, {
                "type": "Polygon",
                "arcs": [
                    [120, -104, 121]
                ],
                "properties": {
                    "id": "50"
                },
                "id": "Bangladesh"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-110, -101]
                ],
                "properties": {
                    "id": "64"
                },
                "id": "Bhutan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [122, -122, -103, -109, 123, 124]
                ],
                "properties": {
                    "id": "104"
                },
                "id": "Myanmar"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [125]
                    ],
                    [
                        [126]
                    ],
                    [
                        [127, 128, 129]
                    ],
                    [
                        [130]
                    ],
                    [
                        [131]
                    ],
                    [
                        [132]
                    ],
                    [
                        [133]
                    ],
                    [
                        [134]
                    ],
                    [
                        [135]
                    ],
                    [
                        [136, 137]
                    ],
                    [
                        [138]
                    ],
                    [
                        [139, 140]
                    ],
                    [
                        [141]
                    ],
                    [
                        [142]
                    ],
                    [
                        [143]
                    ],
                    [
                        [144, 145]
                    ],
                    [
                        [146]
                    ],
                    [
                        [147]
                    ],
                    [
                        [148]
                    ],
                    [
                        [149]
                    ],
                    [
                        [150]
                    ],
                    [
                        [151]
                    ],
                    [
                        [152]
                    ],
                    [
                        [153, 154]
                    ],
                    [
                        [155]
                    ]
                ],
                "properties": {
                    "id": "360"
                },
                "id": "Indonesia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [156, -112]
                ],
                "properties": {
                    "id": "496"
                },
                "id": "Mongolia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [157, -125, 158, 159, 160, 161, 162, 163]
                ],
                "properties": {
                    "id": "764"
                },
                "id": "Thailand"
            }, {
                "type": "Polygon",
                "arcs": [
                    [164, -161, 165, -159, -124, -120, 166]
                ],
                "properties": {
                    "id": "704"
                },
                "id": "Vietnam"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-166, -160]
                ],
                "properties": {
                    "id": "418"
                },
                "id": "Laos"
            }, {
                "type": "Polygon",
                "arcs": [
                    [167, -162, -165]
                ],
                "properties": {
                    "id": "116"
                },
                "id": "Cambodia"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [168, -164, 169, 170]
                    ],
                    [
                        [171, 172, 173, -140]
                    ]
                ],
                "properties": {
                    "id": "458"
                },
                "id": "Malaysia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-171, 174]
                ],
                "properties": {
                    "id": "702"
                },
                "id": "Singapore"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-118, 175]
                ],
                "properties": {
                    "id": "446"
                },
                "id": "Macao"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [-116, 176, 177]
                    ],
                    [
                        [178]
                    ]
                ],
                "properties": {
                    "id": "344"
                },
                "id": "Hong Kong"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [179, 180, 181, 182],
                        [183]
                    ],
                    [
                        [184, 185, 186, 187, 188, 189, 190, 191, 192],
                        [193]
                    ],
                    [
                        [194]
                    ],
                    [
                        [195, 196]
                    ],
                    [
                        [197]
                    ],
                    [
                        [198, 199]
                    ],
                    [
                        [200, 201]
                    ],
                    [
                        [202]
                    ],
                    [
                        [203, 204]
                    ],
                    [
                        [205, 206, 207, 208, 209, 210, 211, 212]
                    ],
                    [
                        [213, 214]
                    ],
                    [
                        [215, 216, 217]
                    ],
                    [
                        [218, 219]
                    ],
                    [
                        [220, 221, 222, 223]
                    ],
                    [
                        [224, 225]
                    ],
                    [
                        [226]
                    ],
                    [
                        [227, 228, 229, 230, 231]
                    ],
                    [
                        [232, 233, 234]
                    ],
                    [
                        [235, 236, 237]
                    ],
                    [
                        [238]
                    ],
                    [
                        [239, 240]
                    ],
                    [
                        [241, 242, 243]
                    ],
                    [
                        [244, 245, 246]
                    ],
                    [
                        [247]
                    ],
                    [
                        [248]
                    ],
                    [
                        [249, 250]
                    ]
                ],
                "properties": {
                    "id": "608"
                },
                "id": "Philippines"
            }, {
                "type": "Polygon",
                "arcs": [
                    [251, -173]
                ],
                "properties": {
                    "id": "96"
                },
                "id": "Brunei"
            }, {
                "type": "Polygon",
                "arcs": [
                    [252]
                ],
                "properties": {
                    "id": "158"
                },
                "id": "Taiwan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [253, -114, 254, 255]
                ],
                "properties": {
                    "id": "408"
                },
                "id": "North Korea"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [256]
                    ],
                    [
                        [257, 258, 259, 260]
                    ],
                    [
                        [261, 262]
                    ],
                    [
                        [263]
                    ],
                    [
                        [264, 265]
                    ],
                    [
                        [266, 267, 268, 269]
                    ],
                    [
                        [270]
                    ],
                    [
                        [271, 272]
                    ],
                    [
                        [273]
                    ]
                ],
                "properties": {
                    "id": "392"
                },
                "id": "Japan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-256, 274]
                ],
                "properties": {
                    "id": "410"
                },
                "id": "South Korea"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-129, 275]
                ],
                "properties": {
                    "id": "626"
                },
                "id": "East Timor"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-138, 276]
                ],
                "properties": {
                    "id": "598"
                },
                "id": "Papua New Guinea"
            }, {
                "type": "Polygon",
                "arcs": [
                    [277]
                ],
                "properties": {
                    "id": "585"
                },
                "id": "Palau"
            }, {
                "type": "Polygon",
                "arcs": [
                    [278]
                ],
                "properties": {
                    "id": "36"
                },
                "id": "Australia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [279]
                ],
                "properties": {
                    "id": "316"
                },
                "id": "Guam"
            }, {
                "type": "Polygon",
                "arcs": [
                    [280]
                ],
                "properties": {
                    "id": "583"
                },
                "id": "Micronesia (country)"
            }, {
                "type": "Polygon",
                "arcs": [
                    [281]
                ],
                "properties": {
                    "id": "90"
                },
                "id": "Solomon Islands"
            }, {
                "type": "Polygon",
                "arcs": [
                    [282]
                ],
                "properties": {
                    "id": "584"
                },
                "id": "Marshall Islands"
            }, {
                "type": "Polygon",
                "arcs": [
                    [283]
                ],
                "properties": {
                    "id": "548"
                },
                "id": "Vanuatu"
            }, {
                "type": "Polygon",
                "arcs": [
                    [284]
                ],
                "properties": {
                    "id": "540"
                },
                "id": "New Caledonia"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [285]
                    ],
                    [
                        [286]
                    ]
                ],
                "properties": {
                    "id": "554"
                },
                "id": "New Zealand"
            }, {
                "type": "Polygon",
                "arcs": [
                    [287]
                ],
                "properties": {
                    "id": "798"
                },
                "id": "Tuvalu"
            }, {
                "type": "Polygon",
                "arcs": [
                    [288]
                ],
                "properties": {
                    "id": "242"
                },
                "id": "Fiji"
            }, {
                "type": "Polygon",
                "arcs": [
                    [289]
                ],
                "properties": {
                    "id": "882"
                },
                "id": "Samoa"
            }, {
                "type": "Polygon",
                "arcs": [
                    [290]
                ],
                "properties": {
                    "id": "296"
                },
                "id": "Kiribati"
            }, {
                "type": "Polygon",
                "arcs": [
                    [291]
                ],
                "properties": {
                    "id": "776"
                },
                "id": "Tonga"
            }, {
                "type": "Polygon",
                "arcs": [
                    [292]
                ],
                "properties": {
                    "id": "570"
                },
                "id": "Niue"
            }, {
                "type": "Polygon",
                "arcs": [
                    [293]
                ],
                "properties": {
                    "id": "258"
                },
                "id": "French Polynesia"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305],
                        [306]
                    ],
                    [
                        [307]
                    ],
                    [
                        [308]
                    ],
                    [
                        [309]
                    ]
                ],
                "properties": {
                    "id": "840"
                },
                "id": "United States"
            }, {
                "type": "Polygon",
                "arcs": [
                    [310, -301, 311, -299, 312, -297, 313, 314, -305, 315]
                ],
                "properties": {
                    "id": "124"
                },
                "id": "Canada"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [316, 317, -295, 318, 319, 320]
                    ],
                    [
                        [321]
                    ]
                ],
                "properties": {
                    "id": "484"
                },
                "id": "Mexico"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-321, 322, 323, 324, 325, 326]
                ],
                "properties": {
                    "id": "320"
                },
                "id": "Guatemala"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-326, 327, 328]
                ],
                "properties": {
                    "id": "222"
                },
                "id": "El Salvador"
            }, {
                "type": "Polygon",
                "arcs": [
                    [329]
                ],
                "properties": {
                    "id": "192"
                },
                "id": "Cuba"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-320, 330, -323]
                ],
                "properties": {
                    "id": "84"
                },
                "id": "Belize"
            }, {
                "type": "Polygon",
                "arcs": [
                    [331, -328, -325, 332, 333]
                ],
                "properties": {
                    "id": "340"
                },
                "id": "Honduras"
            }, {
                "type": "Polygon",
                "arcs": [
                    [334]
                ],
                "properties": {
                    "id": "388"
                },
                "id": "Jamaica"
            }, {
                "type": "Polygon",
                "arcs": [
                    [335]
                ],
                "properties": {
                    "id": "44"
                },
                "id": "Bahamas"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-334, 336, 337, 338]
                ],
                "properties": {
                    "id": "558"
                },
                "id": "Nicaragua"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-338, 339, 340, 341]
                ],
                "properties": {
                    "id": "188"
                },
                "id": "Costa Rica"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-341, 342, 343]
                ],
                "properties": {
                    "id": "591"
                },
                "id": "Panama"
            }, {
                "type": "Polygon",
                "arcs": [
                    [344, 345]
                ],
                "properties": {
                    "id": "332"
                },
                "id": "Haiti"
            }, {
                "type": "Polygon",
                "arcs": [
                    [346, 347, 348, 349, 350, 351]
                ],
                "properties": {
                    "id": "170"
                },
                "id": "Colombia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [352, -348, 353]
                ],
                "properties": {
                    "id": "218"
                },
                "id": "Ecuador"
            }, {
                "type": "Polygon",
                "arcs": [
                    [354, 355, -354, -347, 356, 357]
                ],
                "properties": {
                    "id": "604"
                },
                "id": "Peru"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-345, 358]
                ],
                "properties": {
                    "id": "214"
                },
                "id": "Dominican Republic"
            }, {
                "type": "Polygon",
                "arcs": [
                    [359]
                ],
                "properties": {
                    "id": "533"
                },
                "id": "Aruba"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [360, 361, 362]
                    ],
                    [
                        [363, 364, -357, -352, 365, 366, 367, 368, 369, 370]
                    ]
                ],
                "properties": {
                    "id": "76"
                },
                "id": "Brazil"
            }, {
                "type": "Polygon",
                "arcs": [
                    [371]
                ],
                "properties": {
                    "id": "531"
                },
                "id": "Curacao"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-351, 372, 373, -366]
                ],
                "properties": {
                    "id": "862"
                },
                "id": "Venezuela"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-355, 374, 375, 376]
                ],
                "properties": {
                    "id": "152"
                },
                "id": "Chile"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-376, 377, 378, 379, 380]
                ],
                "properties": {
                    "id": "32"
                },
                "id": "Argentina"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-375, -358, -365, 381, -378]
                ],
                "properties": {
                    "id": "68"
                },
                "id": "Bolivia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [382]
                ],
                "properties": {
                    "id": "630"
                },
                "id": "Puerto Rico"
            }, {
                "type": "Polygon",
                "arcs": [
                    [383, -379, -382, -364, -363]
                ],
                "properties": {
                    "id": "600"
                },
                "id": "Paraguay"
            }, {
                "type": "Polygon",
                "arcs": [
                    [384]
                ],
                "properties": {
                    "id": "659"
                },
                "id": "Saint Kitts and Nevis"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [385]
                    ],
                    [
                        [386]
                    ]
                ],
                "properties": {
                    "id": "780"
                },
                "id": "Trinidad and Tobago"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-380, -384, -362, 387]
                ],
                "properties": {
                    "id": "858"
                },
                "id": "Uruguay"
            }, {
                "type": "Polygon",
                "arcs": [
                    [388]
                ],
                "properties": {
                    "id": "28"
                },
                "id": "Antigua and Barbuda"
            }, {
                "type": "Polygon",
                "arcs": [
                    [389]
                ],
                "properties": {
                    "id": "670"
                },
                "id": "Saint Vincent and the Grenadines"
            }, {
                "type": "Polygon",
                "arcs": [
                    [390, -367, -374, 391]
                ],
                "properties": {
                    "id": "328"
                },
                "id": "Guyana"
            }, {
                "type": "Polygon",
                "arcs": [
                    [392]
                ],
                "properties": {
                    "id": "312"
                },
                "id": "Guadeloupe"
            }, {
                "type": "Polygon",
                "arcs": [
                    [393]
                ],
                "properties": {
                    "id": "212"
                },
                "id": "Dominica"
            }, {
                "type": "Polygon",
                "arcs": [
                    [394]
                ],
                "properties": {
                    "id": "474"
                },
                "id": "Martinique"
            }, {
                "type": "Polygon",
                "arcs": [
                    [395]
                ],
                "properties": {
                    "id": "662"
                },
                "id": "Saint Lucia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [396]
                ],
                "properties": {
                    "id": "308"
                },
                "id": "Grenada"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-391, 397, -368]
                ],
                "properties": {
                    "id": "740"
                },
                "id": "Suriname"
            }, {
                "type": "Polygon",
                "arcs": [
                    [398]
                ],
                "properties": {
                    "id": "52"
                },
                "id": "Barbados"
            }, {
                "type": "Polygon",
                "arcs": [
                    [399, -370]
                ],
                "properties": {
                    "id": "254"
                },
                "id": "French Guiana"
            }, {
                "type": "Polygon",
                "arcs": [
                    [400]
                ],
                "properties": {
                    "id": "304"
                },
                "id": "Greenland"
            }, {
                "type": "Polygon",
                "arcs": [
                    [401]
                ],
                "properties": {
                    "id": "352"
                },
                "id": "Iceland"
            }, {
                "type": "Polygon",
                "arcs": [
                    [402, 403]
                ],
                "properties": {
                    "id": "372"
                },
                "id": "Ireland"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [404]
                    ],
                    [
                        [405]
                    ],
                    [
                        [406]
                    ],
                    [
                        [407, 408, 409, 410, 411]
                    ],
                    [
                        [412]
                    ]
                ],
                "properties": {
                    "id": "724"
                },
                "id": "Spain"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [413]
                    ],
                    [
                        [414]
                    ],
                    [
                        [415, -403]
                    ]
                ],
                "properties": {
                    "id": "826"
                },
                "id": "United Kingdom"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-408, 416]
                ],
                "properties": {
                    "id": "620"
                },
                "id": "Portugal"
            }, {
                "type": "Polygon",
                "arcs": [
                    [417]
                ],
                "properties": {
                    "id": "234"
                },
                "id": "Faroe Islands"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [418]
                    ],
                    [
                        [-411, 419, 420, 421, 422, 423, 424, 425, 426, 427]
                    ]
                ],
                "properties": {
                    "id": "250"
                },
                "id": "France"
            }, {
                "type": "Polygon",
                "arcs": [
                    [428, -420, -410]
                ],
                "properties": {
                    "id": "20"
                },
                "id": "Andorra"
            }, {
                "type": "Polygon",
                "arcs": [
                    [429, 430, 431]
                ],
                "properties": {
                    "id": "528"
                },
                "id": "Netherlands"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-422, 432, -432, 433, 434]
                ],
                "properties": {
                    "id": "56"
                },
                "id": "Belgium"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [435, 436, -426, 437, 438, 439, 440, 441, 442, 443, 444, 445]
                    ],
                    [
                        [446]
                    ],
                    [
                        [447]
                    ]
                ],
                "properties": {
                    "id": "380"
                },
                "id": "Italy"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-427, 448]
                ],
                "properties": {
                    "id": "492"
                },
                "id": "Monaco"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-425, 449, -439, -438]
                ],
                "properties": {
                    "id": "756"
                },
                "id": "Switzerland"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-435, 450, -423]
                ],
                "properties": {
                    "id": "442"
                },
                "id": "Luxembourg"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-450, -424, -451, -434, -431, 451, 452, 453, 454, 455, 456, -440]
                ],
                "properties": {
                    "id": "276"
                },
                "id": "Germany"
            }, {
                "type": "Polygon",
                "arcs": [
                    [457, -453]
                ],
                "properties": {
                    "id": "208"
                },
                "id": "Denmark"
            }, {
                "type": "Polygon",
                "arcs": [
                    [438, 439, 440, 458]
                ],
                "properties": {
                    "id": "438"
                },
                "id": "Liechtenstein"
            }, {
                "type": "Polygon",
                "arcs": [
                    [459, 460, 461, -442, -441, -457]
                ],
                "properties": {
                    "id": "40"
                },
                "id": "Austria"
            }, {
                "type": "Polygon",
                "arcs": [
                    [462]
                ],
                "properties": {
                    "id": "674"
                },
                "id": "San Marino"
            }, {
                "type": "Polygon",
                "arcs": [
                    [463, 435]
                ],
                "properties": {
                    "id": "336"
                },
                "id": "Vatican"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-456, 464, 465, 466, -460]
                ],
                "properties": {
                    "id": "203"
                },
                "id": "Czechia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [467, 468]
                ],
                "properties": {
                    "id": "578"
                },
                "id": "Norway"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-455, 469, 470, 471, 472, 473, 474, -465]
                ],
                "properties": {
                    "id": "616"
                },
                "id": "Poland"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-469, 475, -59, 476, 477, 478]
                ],
                "properties": {
                    "id": "752"
                },
                "id": "Sweden"
            }, {
                "type": "Polygon",
                "arcs": [
                    [479, -444, 480, 481]
                ],
                "properties": {
                    "id": "705"
                },
                "id": "Slovenia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-482, 482, 483, 484, 485]
                ],
                "properties": {
                    "id": "191"
                },
                "id": "Croatia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-461, -467, 486, 487]
                ],
                "properties": {
                    "id": "703"
                },
                "id": "Slovakia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-483, -481, -443, -462, -488, 488, 489, 490]
                ],
                "properties": {
                    "id": "348"
                },
                "id": "Hungary"
            }, {
                "type": "Polygon",
                "arcs": [
                    [491, -485, 492, 493]
                ],
                "properties": {
                    "id": "70"
                },
                "id": "Bosnia and Herzegovina"
            }, {
                "type": "Polygon",
                "arcs": [
                    [494, -493, -484, -491, 495, 496]
                ],
                "properties": {
                    "id": "688"
                },
                "id": "Serbia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-492, 497, 498]
                ],
                "properties": {
                    "id": "499"
                },
                "id": "Montenegro"
            }, {
                "type": "Polygon",
                "arcs": [
                    [499, -477, -58, 500]
                ],
                "properties": {
                    "id": "246"
                },
                "id": "Finland"
            }, {
                "type": "Polygon",
                "arcs": [
                    [501, -498, -494, -495, 502, 503]
                ],
                "properties": {
                    "id": "8"
                },
                "id": "Albania"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-487, -466, -475, 504, -52, 505, 506, 507, -489]
                ],
                "properties": {
                    "id": "804"
                },
                "id": "Ukraine"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [508]
                    ],
                    [
                        [509]
                    ],
                    [
                        [510, -504, 511, 512, -8, 513]
                    ]
                ],
                "properties": {
                    "id": "300"
                },
                "id": "Greece"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-496, -490, -508, 514, 515, 516]
                ],
                "properties": {
                    "id": "642"
                },
                "id": "Romania"
            }, {
                "type": "Polygon",
                "arcs": [
                    [517]
                ],
                "properties": {
                    "id": "470"
                },
                "id": "Malta"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-473, 518, -54, 519]
                ],
                "properties": {
                    "id": "440"
                },
                "id": "Lithuania"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-474, -520, -53, -505]
                ],
                "properties": {
                    "id": "112"
                },
                "id": "Belarus"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-513, 520, -497, -517, 521, -9]
                ],
                "properties": {
                    "id": "100"
                },
                "id": "Bulgaria"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-503, -521, -512]
                ],
                "properties": {
                    "id": "807"
                },
                "id": "North Macedonia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-471, 522, -56, 523]
                ],
                "properties": {
                    "id": "233"
                },
                "id": "Estonia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-472, -524, -55, -519]
                ],
                "properties": {
                    "id": "428"
                },
                "id": "Latvia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-515, -507, 524]
                ],
                "properties": {
                    "id": "498"
                },
                "id": "Moldova"
            }, {
                "type": "Polygon",
                "arcs": [
                    [525]
                ],
                "properties": {
                    "id": "132"
                },
                "id": "Cape Verde"
            }, {
                "type": "Polygon",
                "arcs": [
                    [526, 527, 528, 529, 530]
                ],
                "properties": {
                    "id": "324"
                },
                "id": "Guinea"
            }, {
                "type": "Polygon",
                "arcs": [
                    [531, -528, 532]
                ],
                "properties": {
                    "id": "694"
                },
                "id": "Sierra Leone"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-533, -527, 533, 534]
                ],
                "properties": {
                    "id": "430"
                },
                "id": "Liberia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [535, 536, 537, 538, 539, 540, 541, 542, 543]
                ],
                "properties": {
                    "id": "686"
                },
                "id": "Senegal"
            }, {
                "type": "Polygon",
                "arcs": [
                    [544, -540]
                ],
                "properties": {
                    "id": "270"
                },
                "id": "Gambia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [545, -538, 546, -530]
                ],
                "properties": {
                    "id": "624"
                },
                "id": "Guinea-Bissau"
            }, {
                "type": "Polygon",
                "arcs": [
                    [547, 548, 549, 550, -542]
                ],
                "properties": {
                    "id": "478"
                },
                "id": "Mauritania"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-534, -531, -547, -537, 551, 552]
                ],
                "properties": {
                    "id": "384"
                },
                "id": "Cote d'Ivoire"
            }, {
                "type": "Polygon",
                "arcs": [
                    [553, 554, -549]
                ],
                "properties": {
                    "id": "732"
                },
                "id": "Western Sahara"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-550, -555, 555, 556, 557, 558]
                ],
                "properties": {
                    "id": "504"
                },
                "id": "Morocco"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-552, -536, 559, 560, 561]
                ],
                "properties": {
                    "id": "288"
                },
                "id": "Ghana"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-543, -551, -559, 562, 563]
                ],
                "properties": {
                    "id": "854"
                },
                "id": "Burkina Faso"
            }, {
                "type": "Polygon",
                "arcs": [
                    [564, 565, 566, -560, -544, -564, 567, 568, 569, 570, 571, 572]
                ],
                "properties": {
                    "id": "566"
                },
                "id": "Nigeria"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-563, -558, 573, -568]
                ],
                "properties": {
                    "id": "466"
                },
                "id": "Mali"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-561, -567, 574, 575]
                ],
                "properties": {
                    "id": "768"
                },
                "id": "Togo"
            }, {
                "type": "Polygon",
                "arcs": [
                    [576, -575, -566]
                ],
                "properties": {
                    "id": "204"
                },
                "id": "Benin"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-569, -574, -557, 577, 578, 579]
                ],
                "properties": {
                    "id": "12"
                },
                "id": "Algeria"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-580, 580, 581, 582, 583, -570]
                ],
                "properties": {
                    "id": "562"
                },
                "id": "Niger"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-573, 584, 585, 586, 587, 588, 589]
                ],
                "properties": {
                    "id": "120"
                },
                "id": "Cameroon"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-579, 590, 591, -581]
                ],
                "properties": {
                    "id": "788"
                },
                "id": "Tunisia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [592, -589, 593, 594]
                ],
                "properties": {
                    "id": "226"
                },
                "id": "Equatorial Guinea"
            }, {
                "type": "Polygon",
                "arcs": [
                    [595, -595, 596]
                ],
                "properties": {
                    "id": "266"
                },
                "id": "Gabon"
            }, {
                "type": "Polygon",
                "arcs": [
                    [597, -597, -594, -588, 598]
                ],
                "properties": {
                    "id": "178"
                },
                "id": "Congo"
            }, {
                "type": "Polygon",
                "arcs": [
                    [599, 600, 601, 602, 603]
                ],
                "properties": {
                    "id": "24"
                },
                "id": "Angola"
            }, {
                "type": "Polygon",
                "arcs": [
                    [604, 605, -604, 606, 607]
                ],
                "properties": {
                    "id": "516"
                },
                "id": "Namibia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-601, 608, -599, -587, 609, 610, 611, 612, 613, 614]
                ],
                "properties": {
                    "id": "180"
                },
                "id": "Democratic Republic of Congo"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-605, 615, 616, 617, 618, 619, 620],
                    [621]
                ],
                "properties": {
                    "id": "710"
                },
                "id": "South Africa"
            }, {
                "type": "Polygon",
                "arcs": [
                    [622, -585, -572, 623, 624, 625]
                ],
                "properties": {
                    "id": "148"
                },
                "id": "Chad"
            }, {
                "type": "Polygon",
                "arcs": [
                    [626, -607, -603, 627, 628, -617]
                ],
                "properties": {
                    "id": "716"
                },
                "id": "Zimbabwe"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-608, -627, -616]
                ],
                "properties": {
                    "id": "72"
                },
                "id": "Botswana"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-582, -592, 629, 630]
                ],
                "properties": {
                    "id": "434"
                },
                "id": "Libya"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-624, -571, -584, 631, 632, 633]
                ],
                "properties": {
                    "id": "729"
                },
                "id": "Sudan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-586, -623, 634, 635, -610]
                ],
                "properties": {
                    "id": "140"
                },
                "id": "Central African Republic"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-625, -634, 636, 637]
                ],
                "properties": {
                    "id": "728"
                },
                "id": "South Sudan"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-635, -626, -638, 638, 639, 640]
                ],
                "properties": {
                    "id": "800"
                },
                "id": "Uganda"
            }, {
                "type": "MultiPolygon",
                "arcs": [
                    [
                        [-632, -583, -631, 641, 642, 643, 644, 645, 646, 647]
                    ],
                    [
                        [648]
                    ]
                ],
                "properties": {
                    "id": "818"
                },
                "id": "Egypt"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-628, -602, -615, 649, 650]
                ],
                "properties": {
                    "id": "894"
                },
                "id": "Zambia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [651, -611, -636, -641, 652]
                ],
                "properties": {
                    "id": "646"
                },
                "id": "Rwanda"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-622]
                ],
                "properties": {
                    "id": "426"
                },
                "id": "Lesotho"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-612, -652, 653, 654]
                ],
                "properties": {
                    "id": "108"
                },
                "id": "Burundi"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-620, 655, -618, -629, -651, 656, 657, 658]
                ],
                "properties": {
                    "id": "508"
                },
                "id": "Mozambique"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-658, 659, -613, -655, 660, 661]
                ],
                "properties": {
                    "id": "834"
                },
                "id": "Tanzania"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-650, -614, -660, -657]
                ],
                "properties": {
                    "id": "454"
                },
                "id": "Malawi"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-656, -619]
                ],
                "properties": {
                    "id": "748"
                },
                "id": "Eswatini"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-639, -637, -633, -648, 662, 663, 664, 665]
                ],
                "properties": {
                    "id": "231"
                },
                "id": "Ethiopia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-661, -654, -653, -640, -666, 666, 667]
                ],
                "properties": {
                    "id": "404"
                },
                "id": "Kenya"
            }, {
                "type": "Polygon",
                "arcs": [
                    [668]
                ],
                "properties": {
                    "id": "450"
                },
                "id": "Madagascar"
            }, {
                "type": "Polygon",
                "arcs": [
                    [669]
                ],
                "properties": {
                    "id": "174"
                },
                "id": "Comoros"
            }, {
                "type": "Polygon",
                "arcs": [
                    [670]
                ],
                "properties": {
                    "id": "175"
                },
                "id": "Mayotte"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-647, 671, 672, -663]
                ],
                "properties": {
                    "id": "232"
                },
                "id": "Eritrea"
            }, {
                "type": "Polygon",
                "arcs": [
                    [673]
                ],
                "properties": {
                    "id": "690"
                },
                "id": "Seychelles"
            }, {
                "type": "Polygon",
                "arcs": [
                    [674]
                ],
                "properties": {
                    "id": "638"
                },
                "id": "Reunion"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-667, -665, 675, 676]
                ],
                "properties": {
                    "id": "706"
                },
                "id": "Somalia"
            }, {
                "type": "Polygon",
                "arcs": [
                    [-676, -664, -673, 677]
                ],
                "properties": {
                    "id": "262"
                },
                "id": "Djibouti"
            }, {
                "type": "Polygon",
                "arcs": [
                    [678]
                ],
                "properties": {
                    "id": "480"
                },
                "id": "Mauritius"
            }, {
                "type": "Polygon",
                "arcs": [
                    [679]
                ],
                "properties": {
                    "id": "678"
                },
                "id": "Sao Tome and Principe"
            }, {
                "type": "Polygon",
                "arcs": [
                    [680]
                ],
                "properties": {
                    "id": "184"
                },
                "id": "Cook Islands"
            }]
        }
    },
    "arcs": [
        [
            [453521126, 373134328],
            [-5633803, 0],
            [0, -7462687],
            [-8450704, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462687],
            [8450704, 0],
            [0, 7462687],
            [11267606, 0]
        ],
        [
            [461971831, 305970149],
            [5633802, 0]
        ],
        [
            [467605633, 305970149],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [473239436, 313432836],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [481690140, 328358209],
            [0, 37313432]
        ],
        [
            [481690140, 365671641],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [478873239, 373134328],
            [-19718310, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [422535211, 320895522],
            [0, -14925373]
        ],
        [
            [422535211, 305970149],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [430985915, 283582089],
            [11267606, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-8450704, 0]
        ],
        [
            [442253521, 388059701],
            [-2816902, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [447887323, 425373134],
            [0, -22388060],
            [-2816901, 0],
            [0, -7462686],
            [5633803, 0]
        ],
        [
            [450704225, 395522388],
            [5633803, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [456338028, 417910447],
            [0, 7462687],
            [-8450705, 0]
        ],
        [
            [461971831, 462686567],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0]
        ],
        [
            [456338028, 455223880],
            [0, -22388060],
            [2816901, 0]
        ],
        [
            [459154929, 432835820],
            [2816902, 0],
            [0, 29850747]
        ],
        [
            [445070422, 455223880],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [447887323, 447761194],
            [0, 7462686]
        ],
        [
            [447887323, 455223880],
            [-2816901, 0]
        ],
        [
            [447887323, 447761194],
            [0, -14925374]
        ],
        [
            [447887323, 432835820],
            [2816902, 0],
            [0, 14925374],
            [-2816902, 0]
        ],
        [
            [450704225, 470149253],
            [0, -7462686],
            [-2816902, 0]
        ],
        [
            [447887323, 462686567],
            [0, -7462687]
        ],
        [
            [447887323, 432835820],
            [0, -7462686]
        ],
        [
            [456338028, 417910447],
            [2816901, 0]
        ],
        [
            [459154929, 417910447],
            [0, 14925373]
        ],
        [
            [456338028, 455223880],
            [0, 14925373],
            [-5633803, 0]
        ],
        [
            [450704225, 395522388],
            [0, -14925373],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [478873239, 373134328],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [467605633, 402985074],
            [-5633802, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [467605633, 462686567],
            [-5633802, 0]
        ],
        [
            [467605633, 402985074],
            [0, 7462687],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [467605633, 432835820],
            [-2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 22388060]
        ],
        [
            [461971831, 305970149],
            [0, -22388060],
            [8450704, 0]
        ],
        [
            [470422535, 283582089],
            [2816901, 0]
        ],
        [
            [473239436, 283582089],
            [0, 7462687]
        ],
        [
            [473239436, 291044776],
            [-5633803, 0],
            [0, 14925373]
        ],
        [
            [467605633, 432835820],
            [5633803, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [490140845, 462686567],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [495774647, 470149253],
            [0, 7462687],
            [2816902, 0]
        ],
        [
            [498591549, 477611940],
            [2816901, 0],
            [0, 7462686],
            [8450704, 0],
            [0, 7462687]
        ],
        [
            [509859154, 492537313],
            [0, 7462687],
            [-5633802, 0]
        ],
        [
            [504225352, 500000000],
            [-19718310, 0],
            [0, 7462686]
        ],
        [
            [484507042, 507462686],
            [-2816902, 0],
            [0, -7462686],
            [-5633802, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -29850746],
            [-5633803, 0]
        ],
        [
            [473239436, 291044776],
            [0, 22388060]
        ],
        [
            [481690140, 365671641],
            [5633803, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [492957746, 388059701],
            [-2816901, 0],
            [0, 22388060],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925373]
        ],
        [
            [495774647, 432835820],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [478873239, 283582089],
            [-5633803, 0]
        ],
        [
            [470422535, 283582089],
            [0, -14925373],
            [-5633803, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-8450704, 0],
            [0, -7462687],
            [-2816902, 0]
        ],
        [
            [447887323, 231343283],
            [0, -52238806],
            [-5633802, 0],
            [0, -14925373],
            [-11267606, 0]
        ],
        [
            [430985915, 164179104],
            [-2816901, 0],
            [0, -14925373],
            [-5633803, 0]
        ],
        [
            [422535211, 149253731],
            [0, -14925373]
        ],
        [
            [422535211, 134328358],
            [0, -14925373]
        ],
        [
            [422535211, 119402985],
            [0, -14925373]
        ],
        [
            [422535211, 104477612],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462687],
            [-5633802, 0],
            [0, -7462686],
            [-2816902, 0]
        ],
        [
            [411267605, 74626866],
            [0, -37313433]
        ],
        [
            [411267605, 37313433],
            [0, -7462687]
        ],
        [
            [411267605, 29850746],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [16901408, 0],
            [0, 29850746],
            [14084508, 0],
            [0, 29850747],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [8450705, 0],
            [0, 111940298],
            [2816901, 0],
            [0, 14925373]
        ],
        [
            [478873239, 283582089],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 22388060]
        ],
        [
            [484507042, 313432836],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [529577464, 410447761],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-22535211, 0],
            [0, -7462687],
            [-5633803, 0]
        ],
        [
            [484507042, 313432836],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [14084507, 0]
        ],
        [
            [504225352, 328358209],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [515492957, 320895522],
            [11267606, 0]
        ],
        [
            [526760563, 320895522],
            [8450704, 0]
        ],
        [
            [535211267, 320895522],
            [0, 22388060],
            [-2816901, 0],
            [0, 29850746],
            [2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [532394366, 395522388],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687]
        ],
        [
            [504225352, 500000000],
            [0, 7462686],
            [11267605, 0]
        ],
        [
            [515492957, 507462686],
            [0, 22388060],
            [-2816901, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, 7462687],
            [-11267606, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -29850746]
        ],
        [
            [495774647, 432835820],
            [2816902, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 14925373]
        ],
        [
            [515492957, 320895522],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687]
        ],
        [
            [512676056, 305970149],
            [2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-8450704, 0],
            [0, -14925373],
            [22535211, 0]
        ],
        [
            [521126760, 261194030],
            [11267606, 0],
            [0, 14925373],
            [2816901, 0]
        ],
        [
            [535211267, 276119403],
            [0, 7462686]
        ],
        [
            [535211267, 283582089],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925374],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [498591549, 477611940],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [501408450, 470149253],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [507042253, 455223880],
            [8450704, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [518309859, 477611940],
            [-5633803, 0],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [504225352, 432835820],
            [-2816902, 0],
            [0, -14925373],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [501408450, 470149253],
            [0, -22388059],
            [5633803, 0],
            [0, 7462686]
        ],
        [
            [504225352, 328358209],
            [0, -14925373],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0]
        ],
        [
            [518309859, 477611940],
            [0, 14925373],
            [-2816902, 0],
            [0, 14925373]
        ],
        [
            [521126760, 261194030],
            [0, -22388060],
            [11267606, 0],
            [0, -7462687],
            [5633802, 0],
            [0, 7462687],
            [8450705, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [549295774, 261194030],
            [0, 7462686],
            [-14084507, 0],
            [0, 7462687]
        ],
        [
            [535211267, 283582089],
            [8450704, 0]
        ],
        [
            [543661971, 283582089],
            [0, 22388060]
        ],
        [
            [543661971, 305970149],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [552112676, 514925373],
            [0, -14925373],
            [-5633803, 0],
            [0, -22388060],
            [-2816902, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -14925373],
            [-5633802, 0],
            [0, -29850746],
            [-2816902, 0],
            [0, -14925373]
        ],
        [
            [532394366, 395522388],
            [8450704, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -14925373],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -22388059],
            [5633803, 0],
            [0, -14925373]
        ],
        [
            [560563380, 313432836],
            [0, -14925374],
            [2816901, 0],
            [0, -29850746],
            [16901409, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [585915492, 298507462],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-8450705, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388059],
            [5633803, 0],
            [0, 22388060],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [-5633802, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [-8450704, 0]
        ],
        [
            [543661971, 305970149],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, 14925374],
            [2816902, 0]
        ],
        [
            [549295774, 261194030],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [585915492, 298507462],
            [5633803, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [11267605, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [5633802, 0],
            [0, -7462686],
            [14084507, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [639436619, 305970149],
            [0, 29850746]
        ],
        [
            [639436619, 335820895],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [14084507, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [11267605, 0],
            [0, 14925373],
            [2816902, 0],
            [0, -14925373]
        ],
        [
            [684507042, 402985074],
            [2816901, 0],
            [0, 14925373],
            [2816901, 0]
        ],
        [
            [690140844, 417910447],
            [5633803, 0]
        ],
        [
            [695774647, 417910447],
            [16901409, 0],
            [0, 7462687],
            [14084507, 0],
            [0, -7462687],
            [5633802, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925374],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 14925373],
            [5633803, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687]
        ],
        [
            [752112675, 544776119],
            [-5633803, 0],
            [0, 7462686],
            [-5633802, 0],
            [0, 7462687],
            [-5633803, 0]
        ],
        [
            [735211267, 559701492],
            [0, -37313433],
            [-2816902, 0],
            [0, 7462687],
            [-5633802, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, -37313432],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -14925373],
            [-19718309, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-11267606, 0],
            [0, 22388060],
            [5633803, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 44776119],
            [2816902, 0],
            [0, 22388060],
            [5633802, 0],
            [0, 59701492]
        ],
        [
            [690140844, 604477611],
            [-5633802, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 29850746],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 52238806],
            [-2816901, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 29850746],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 37313433],
            [-5633803, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 29850747],
            [-2816902, 0],
            [0, 7462686],
            [-11267605, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -29850746],
            [-2816901, 0],
            [0, -29850746],
            [-2816901, 0],
            [0, -22388060],
            [-2816902, 0],
            [0, -29850746],
            [-2816901, 0],
            [0, -37313433],
            [-2816902, 0],
            [0, -22388059],
            [-2816901, 0],
            [0, -37313433],
            [-2816901, 0],
            [0, -89552239],
            [2816901, 0],
            [0, -37313433],
            [-2816901, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925373],
            [8450704, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -37313433],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [560563380, 925373133],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [628169013, 992537312],
            [0, 7462687],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -22388060],
            [2816902, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462687],
            [8450704, 0],
            [0, 14925374],
            [2816902, 0],
            [0, 44776119],
            [-2816902, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [639436619, 335820895],
            [8450704, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [5633802, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [763380281, 582089552],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925374],
            [-2816902, 0],
            [0, -7462686]
        ],
        [
            [695774647, 417910447],
            [0, -7462686],
            [-5633803, 0],
            [0, 7462686]
        ],
        [
            [639436619, 305970149],
            [2816901, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -14925373],
            [8450704, 0],
            [0, -14925373],
            [5633803, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -14925374],
            [2816902, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -22388059],
            [2816902, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [5633802, 0],
            [0, -7462686],
            [22535212, 0],
            [0, 7462686],
            [5633802, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925374],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [8450704, 0],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [752112675, 223880597],
            [0, 7462686],
            [8450705, 0],
            [0, -7462686]
        ],
        [
            [760563380, 223880597],
            [14084507, 0],
            [0, -7462687],
            [11267605, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687],
            [11267606, 0],
            [0, -7462686],
            [5633802, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [8450704, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -7462686],
            [5633802, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [5633802, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -14925374],
            [2816901, 0],
            [0, -14925373],
            [5633803, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -14925373],
            [11267605, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 22388059],
            [2816901, 0],
            [0, 14925374],
            [2816902, 0],
            [0, 7462686],
            [8450704, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [11267606, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 29850746],
            [-2816901, 0]
        ],
        [
            [895774647, 156716418],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686]
        ],
        [
            [870422534, 216417910],
            [-5633802, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, -14925373],
            [-8450705, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, -7462687],
            [5633803, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 29850747],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 59701493],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 14925374]
        ],
        [
            [836619717, 447761194],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [828169013, 470149253],
            [-5633803, 0],
            [0, 7462687]
        ],
        [
            [822535210, 477611940],
            [-2816901, 0]
        ],
        [
            [819718309, 477611940],
            [-2816901, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 22388059],
            [-5633803, 0],
            [0, 7462687]
        ],
        [
            [805633802, 544776119],
            [-2816901, 0],
            [0, -7462687],
            [-14084507, 0],
            [0, -7462686],
            [-16901409, 0],
            [0, 22388059],
            [-2816901, 0],
            [0, 14925374],
            [-5633803, 0],
            [0, 14925373]
        ],
        [
            [738028168, 626865671],
            [0, 7462687],
            [-2816901, 0],
            [0, -7462687],
            [-8450704, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-14084507, 0],
            [0, -7462687],
            [-19718310, 0]
        ],
        [
            [735211267, 559701492],
            [0, 52238806],
            [2816901, 0],
            [0, 14925373]
        ],
        [
            [760563380, 701492537],
            [-2816902, 0],
            [0, -22388060],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0]
        ],
        [
            [763380281, 582089552],
            [0, 7462686]
        ],
        [
            [763380281, 589552238],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 29850746],
            [2816902, 0],
            [0, 44776120]
        ],
        [
            [873239436, 977611939],
            [0, 7462687],
            [-8450704, 0],
            [0, -7462687],
            [-16901409, 0],
            [0, -7462686],
            [-14084507, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, -7462687],
            [-16901408, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687],
            [8450704, 0],
            [0, 7462687],
            [14084507, 0],
            [0, -7462687],
            [5633803, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [14084507, 0],
            [0, -14925373],
            [25352112, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, 7462687],
            [8450704, 0],
            [0, 7462686],
            [8450704, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 22388060],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [-14084507, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [895774647, 925373133],
            [0, 14925374],
            [-8450704, 0],
            [0, -14925374],
            [8450704, 0]
        ],
        [
            [895774647, 925373133],
            [0, -14925373],
            [8450704, 0]
        ],
        [
            [904225351, 910447760],
            [0, 7462687]
        ],
        [
            [904225351, 917910447],
            [0, 14925373],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [794366196, 865671641],
            [0, 7462686],
            [2816902, 0],
            [0, 14925374],
            [-2816902, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -14925373],
            [2816902, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0]
        ],
        [
            [884507041, 888059701],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [901408450, 873134327],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [763380281, 873134327],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [794366196, 865671641],
            [0, -14925373],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [884507041, 865671641],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, -37313432],
            [2816901, 0],
            [0, -29850747],
            [2816902, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687],
            [5633803, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687],
            [-11267605, 0],
            [0, 14925373],
            [8450704, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [915492957, 865671641],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [915492957, 820895522],
            [0, 44776119]
        ],
        [
            [805633802, 865671641],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [816901408, 813432835],
            [0, 7462687],
            [16901408, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -14925373],
            [16901409, 0]
        ],
        [
            [859154929, 783582089],
            [0, 22388059],
            [2816901, 0],
            [0, 7462687],
            [-11267605, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [-8450705, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -14925373],
            [2816902, 0]
        ],
        [
            [757746478, 850746268],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, -7462686]
        ],
        [
            [895774647, 843283581],
            [5633803, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687]
        ],
        [
            [757746478, 850746268],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [895774647, 835820895],
            [0, 7462686]
        ],
        [
            [895774647, 843283581],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [749295774, 828358208],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, -7462687]
        ],
        [
            [895774647, 835820895],
            [0, -7462687],
            [5633803, 0],
            [0, 7462687],
            [-5633803, 0]
        ],
        [
            [887323943, 828358208],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [749295774, 828358208],
            [-2816902, 0],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [898591548, 805970148],
            [0, 14925374],
            [-2816901, 0],
            [0, -14925374],
            [2816901, 0]
        ],
        [
            [904225351, 813432835],
            [0, -14925373],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [887323943, 813432835],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [898591548, 805970148],
            [0, -14925373],
            [2816902, 0]
        ],
        [
            [901408450, 791044775],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [901408450, 791044775],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [752112675, 223880597],
            [0, -7462687],
            [8450705, 0],
            [0, 7462687]
        ],
        [
            [777464788, 791044775],
            [-2816901, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -22388060],
            [-2816901, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -37313432]
        ],
        [
            [763380281, 589552238],
            [5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0]
        ],
        [
            [777464788, 611940298],
            [0, 7462686],
            [5633803, 0],
            [0, 22388060],
            [5633803, 0]
        ],
        [
            [788732394, 641791044],
            [2816901, 0],
            [0, 22388060]
        ],
        [
            [791549295, 664179104],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925374]
        ],
        [
            [777464788, 701492537],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 22388059],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925373],
            [2816901, 0]
        ],
        [
            [780281689, 776119402],
            [0, 14925373],
            [-2816901, 0]
        ],
        [
            [788732394, 716417910],
            [0, -7462687],
            [5633802, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -29850747],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0]
        ],
        [
            [788732394, 641791044],
            [0, -37313433],
            [-11267606, 0],
            [0, 7462687]
        ],
        [
            [805633802, 544776119],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925374],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 29850746],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -22388059],
            [-2816901, 0]
        ],
        [
            [788732394, 716417910],
            [-2816902, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0]
        ],
        [
            [785915492, 820895522],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687]
        ],
        [
            [780281689, 776119402],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 14925373]
        ],
        [
            [791549295, 805970148],
            [0, 14925374],
            [-5633803, 0]
        ],
        [
            [816901408, 813432835],
            [5633802, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462686],
            [5633802, 0],
            [0, -14925373],
            [2816902, 0]
        ],
        [
            [839436619, 768656716],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [842253520, 761194029],
            [2816902, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 14925373]
        ],
        [
            [791549295, 805970148],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, -7462686],
            [-5633802, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686]
        ],
        [
            [822535210, 477611940],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [836619717, 447761194],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686]
        ],
        [
            [836619717, 470149253],
            [-2816901, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [-2816902, 0]
        ],
        [
            [836619717, 470149253],
            [5633803, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, -14925373]
        ],
        [
            [890140844, 731343283],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, 7462687],
            [-5633802, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925374],
            [-2816901, 0]
        ],
        [
            [873239436, 753731343],
            [0, -22388060],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -14925373],
            [5633803, 0]
        ],
        [
            [887323943, 708955223],
            [0, 7462687],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [890140844, 708955223],
            [2816902, 0],
            [0, -7462686],
            [5633802, 0],
            [0, -22388060],
            [5633803, 0],
            [0, 37313433],
            [2816902, 0],
            [0, 29850746],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, -22388060],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925374],
            [2816901, 0],
            [0, -7462686]
        ],
        [
            [890140844, 731343283],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, 7462687]
        ],
        [
            [892957746, 679104477],
            [0, -14925373],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [887323943, 671641790],
            [0, -14925373],
            [5633803, 0],
            [0, -7462686],
            [-11267606, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925374]
        ],
        [
            [864788732, 619402984],
            [2816901, 0],
            [0, -7462686],
            [-2816901, 0]
        ],
        [
            [864788732, 611940298],
            [0, -7462687]
        ],
        [
            [864788732, 604477611],
            [-2816902, 0]
        ],
        [
            [861971830, 604477611],
            [0, -22388059],
            [-2816901, 0],
            [0, -14925373]
        ],
        [
            [859154929, 567164179],
            [2816901, 0],
            [0, -29850747],
            [2816902, 0],
            [0, -7462686],
            [8450704, 0]
        ],
        [
            [873239436, 529850746],
            [0, 7462686],
            [2816901, 0],
            [0, -7462686]
        ],
        [
            [876056337, 529850746],
            [2816902, 0],
            [0, 29850746],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388059],
            [5633803, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 14925373],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, 7462687],
            [5633803, 0],
            [0, -14925373],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, -7462686],
            [5633802, 0],
            [0, 29850746],
            [-2816901, 0],
            [0, 14925373],
            [-2816901, 0]
        ],
        [
            [864788732, 604477611],
            [2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [867605633, 768656716],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [867605633, 768656716],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [873239436, 753731343],
            [0, 14925373],
            [-5633803, 0]
        ],
        [
            [842253520, 716417910],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [842253520, 716417910],
            [0, -7462687],
            [2816902, 0]
        ],
        [
            [845070422, 708955223],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [847887323, 701492537],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [845070422, 708955223],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [873239436, 701492537],
            [0, 7462686],
            [-2816902, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [887323943, 708955223],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [890140844, 708955223],
            [-2816901, 0]
        ],
        [
            [873239436, 701492537],
            [0, -7462687]
        ],
        [
            [873239436, 694029850],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [876056337, 686567163],
            [2816902, 0],
            [0, -14925373]
        ],
        [
            [878873239, 671641790],
            [2816901, 0],
            [0, -7462686]
        ],
        [
            [881690140, 664179104],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [887323943, 671641790],
            [0, 7462687]
        ],
        [
            [887323943, 679104477],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [884507041, 686567163],
            [-2816901, 0],
            [0, 14925374],
            [-8450704, 0]
        ],
        [
            [847887323, 701492537],
            [0, -7462687],
            [2816902, 0]
        ],
        [
            [850704225, 694029850],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [884507041, 686567163],
            [2816902, 0],
            [0, -7462686]
        ],
        [
            [887323943, 679104477],
            [5633803, 0]
        ],
        [
            [892957746, 679104477],
            [0, 14925373],
            [-8450705, 0],
            [0, -7462687]
        ],
        [
            [850704225, 694029850],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [853521126, 686567163],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [873239436, 694029850],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -14925373]
        ],
        [
            [870422534, 664179104],
            [2816902, 0]
        ],
        [
            [873239436, 664179104],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [876056337, 686567163],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [853521126, 686567163],
            [0, -7462686],
            [2816901, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [861971830, 656716417],
            [0, 14925373],
            [-2816901, 0],
            [0, 14925373],
            [-5633803, 0]
        ],
        [
            [867605633, 664179104],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [878873239, 671641790],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0]
        ],
        [
            [873239436, 664179104],
            [0, -7462687]
        ],
        [
            [873239436, 656716417],
            [2816901, 0],
            [0, -7462686]
        ],
        [
            [876056337, 649253731],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [881690140, 664179104],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [867605633, 664179104],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [870422534, 656716417],
            [0, 7462687]
        ],
        [
            [870422534, 664179104],
            [-2816901, 0]
        ],
        [
            [870422534, 656716417],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [873239436, 649253731],
            [0, 7462686]
        ],
        [
            [873239436, 656716417],
            [-2816902, 0]
        ],
        [
            [861971830, 656716417],
            [0, -14925373],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [876056337, 649253731],
            [-2816901, 0]
        ],
        [
            [873239436, 649253731],
            [0, -14925373],
            [5633803, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687]
        ],
        [
            [861971830, 611940298],
            [2816902, 0]
        ],
        [
            [864788732, 611940298],
            [0, 7462686]
        ],
        [
            [864788732, 619402984],
            [-2816902, 0],
            [0, -7462686]
        ],
        [
            [859154929, 604477611],
            [2816901, 0]
        ],
        [
            [861971830, 604477611],
            [0, 7462687]
        ],
        [
            [861971830, 611940298],
            [-2816901, 0],
            [0, -7462687]
        ],
        [
            [859154929, 604477611],
            [-2816902, 0],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [859154929, 567164179],
            [-2816902, 0],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [876056337, 529850746],
            [-2816901, 0]
        ],
        [
            [873239436, 529850746],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [839436619, 768656716],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [859154929, 529850746],
            [0, 7462686],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [11267605, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 29850746],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [884507041, 246268656],
            [-2816901, 0],
            [0, -7462686],
            [-8450704, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687]
        ],
        [
            [895774647, 156716418],
            [0, 29850746],
            [-2816901, 0],
            [0, 22388060],
            [2816901, 0]
        ],
        [
            [895774647, 208955224],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [895774647, 447761194],
            [0, 14925373],
            [-2816901, 0],
            [0, -14925373],
            [2816901, 0]
        ],
        [
            [895774647, 447761194],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, -14925373],
            [-2816902, 0]
        ],
        [
            [884507041, 410447761],
            [0, -14925373],
            [2816902, 0],
            [0, -7462687],
            [8450704, 0]
        ],
        [
            [895774647, 388059701],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [901408450, 410447761],
            [-2816902, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925374],
            [-2816901, 0]
        ],
        [
            [901408450, 410447761],
            [14084507, 0]
        ],
        [
            [915492957, 410447761],
            [0, 14925373],
            [-8450704, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [884507041, 410447761],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [915492957, 410447761],
            [0, -7462687]
        ],
        [
            [915492957, 402985074],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [915492957, 402985074],
            [-11267606, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0]
        ],
        [
            [895774647, 388059701],
            [0, -14925373],
            [11267606, 0],
            [0, -7462687],
            [5633802, 0],
            [0, -7462686],
            [14084507, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -29850746],
            [5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -14925373]
        ],
        [
            [946478872, 291044776],
            [2816902, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -22388060]
        ],
        [
            [952112675, 238805970],
            [8450704, 0],
            [0, 29850746],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 22388059],
            [-2816901, 0],
            [0, 67164179],
            [-2816901, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, 29850747],
            [-5633803, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, -22388059],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [943661971, 291044776],
            [0, 7462686],
            [-2816902, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [943661971, 291044776],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [946478872, 291044776],
            [-2816901, 0]
        ],
        [
            [952112675, 238805970],
            [-2816901, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [8450704, 0],
            [0, -44776119],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [8450704, 0],
            [0, 7462686],
            [8450704, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [-8450705, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687]
        ],
        [
            [895774647, 208955224],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-16901409, 0],
            [0, -22388060],
            [2816902, 0],
            [0, -52238806],
            [-2816902, 0]
        ],
        [
            [904225351, 910447760],
            [8450704, 0],
            [0, 7462687],
            [-8450704, 0]
        ],
        [
            [915492957, 820895522],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, 7462687],
            [-5633803, 0]
        ],
        [
            [918309858, 798507462],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [943661971, 940298507],
            [0, 14925373],
            [5633803, 0],
            [0, 29850746],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-5633802, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462686],
            [8450704, 0],
            [0, 7462686],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [923943661, 783582089],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [938028168, 828358208],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [940845069, 888059701],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [943661971, 828358208],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [943661971, 902985074],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [943661971, 940298507],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [957746478, 977611939],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [957746478, 977611939],
            [0, -22388059],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [957746478, 902985074],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [960563379, 932835820],
            [0, 7462687],
            [-2816901, 0],
            [0, -14925374],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [960563379, 917910447],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [974647886, 873134327],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [974647886, 970149253],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [980281689, 955223880],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [983098591, 932835820],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [61971831, 462686567],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-8450705, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-25352113, 0]
        ],
        [
            [16901408, 417910447],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -37313433],
            [2816901, 0],
            [0, -37313433],
            [2816902, 0],
            [0, -7462686]
        ],
        [
            [5633803, 291044776],
            [67605634, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [76056338, 298507462],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0]
        ],
        [
            [81690141, 313432836],
            [2816901, 0]
        ],
        [
            [84507042, 313432836],
            [0, 7462686],
            [-2816901, 0],
            [0, 22388060],
            [2816901, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -14925373]
        ],
        [
            [87323944, 313432836],
            [2816901, 0]
        ],
        [
            [90140845, 313432836],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [95774648, 335820895],
            [0, 7462687]
        ],
        [
            [95774648, 343283582],
            [5633803, 0],
            [0, -7462687]
        ],
        [
            [101408451, 335820895],
            [5633802, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -14925373],
            [8450704, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0]
        ],
        [
            [126760563, 298507462],
            [0, 14925374],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 22388059],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 37313433],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-19718310, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [95774648, 343283582],
            [-2816902, 0],
            [0, 7462686],
            [2816902, 0],
            [0, -7462686]
        ],
        [
            [2816901, 425373134],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, -14925373]
        ],
        [
            [2816901, 425373134],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [2816901, 283582089],
            [-2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [95774648, 335820895],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0]
        ],
        [
            [87323944, 313432836],
            [-2816902, 0]
        ],
        [
            [81690141, 313432836],
            [0, -7462687],
            [5633803, 0],
            [0, -7462687],
            [-11267606, 0]
        ],
        [
            [5633803, 291044776],
            [-2816902, 0],
            [0, -7462687]
        ],
        [
            [2816901, 283582089],
            [81690141, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [11267606, 0],
            [0, 7462687],
            [8450704, 0],
            [0, -7462687],
            [8450704, 0],
            [0, -7462686],
            [8450704, 0],
            [0, 7462686]
        ],
        [
            [101408451, 335820895],
            [-5633803, 0]
        ],
        [
            [84507042, 574626865],
            [-8450704, 0],
            [0, -7462686],
            [-16901408, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -22388060],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -14925373],
            [-2816901, 0]
        ],
        [
            [25352113, 440298507],
            [0, 22388060],
            [2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -22388060],
            [-2816902, 0],
            [0, -22388060]
        ],
        [
            [61971831, 462686567],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925374],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, -22388059],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [8450705, 0],
            [0, 14925373]
        ],
        [
            [101408451, 514925373],
            [0, 7462686]
        ],
        [
            [101408451, 522388059],
            [-2816902, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [-5633802, 0],
            [0, 22388060],
            [-2816902, 0]
        ],
        [
            [25352113, 440298507],
            [0, -14925373],
            [-2816902, 0],
            [0, 14925373],
            [2816902, 0]
        ],
        [
            [101408451, 522388059],
            [2816901, 0]
        ],
        [
            [104225352, 522388059],
            [0, 14925373],
            [5633803, 0]
        ],
        [
            [109859155, 537313432],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686]
        ],
        [
            [104225352, 552238805],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 14925373]
        ],
        [
            [95774648, 574626865],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, -14925373]
        ],
        [
            [104225352, 552238805],
            [0, 7462687],
            [8450704, 0],
            [0, 14925373]
        ],
        [
            [112676056, 574626865],
            [-16901408, 0]
        ],
        [
            [129577465, 455223880],
            [2816901, 0],
            [0, 7462687],
            [-14084507, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [-14084507, 0],
            [0, -7462687],
            [-5633802, 0],
            [0, -7462687],
            [22535211, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [101408451, 514925373],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [115492958, 574626865],
            [-2816902, 0]
        ],
        [
            [109859155, 537313432],
            [16901408, 0],
            [0, 7462687]
        ],
        [
            [126760563, 544776119],
            [-8450704, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [112676056, 500000000],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462687],
            [8450704, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0]
        ],
        [
            [112676056, 417910447],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [126760563, 544776119],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925374]
        ],
        [
            [126760563, 567164179],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [123943662, 574626865],
            [-8450704, 0]
        ],
        [
            [126760563, 567164179],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [135211267, 582089552],
            [0, 7462686]
        ],
        [
            [135211267, 589552238],
            [-8450704, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687]
        ],
        [
            [135211267, 582089552],
            [2816902, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [5633802, 0],
            [0, 7462686]
        ],
        [
            [149295774, 604477611],
            [-11267605, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -7462687]
        ],
        [
            [154929577, 432835820],
            [0, 37313433]
        ],
        [
            [154929577, 470149253],
            [-8450704, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, -14925373],
            [11267605, 0],
            [0, -7462687],
            [-5633802, 0],
            [0, -7462686],
            [5633802, 0],
            [0, -7462687],
            [-8450704, 0],
            [0, -7462687],
            [14084507, 0]
        ],
        [
            [169014084, 694029850],
            [0, -7462687],
            [-8450704, 0]
        ],
        [
            [160563380, 686567163],
            [0, -14925373],
            [-5633803, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-5633802, 0]
        ],
        [
            [143661972, 656716417],
            [0, -7462686],
            [2816901, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -22388060]
        ],
        [
            [149295774, 604477611],
            [5633803, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -7462686],
            [5633802, 0]
        ],
        [
            [169014084, 582089552],
            [0, 7462686],
            [-2816901, 0],
            [0, 29850746],
            [2816901, 0],
            [0, 7462687],
            [8450705, 0],
            [0, 37313433]
        ],
        [
            [177464789, 664179104],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 22388060],
            [-2816902, 0]
        ],
        [
            [146478873, 716417910],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -22388059],
            [-2816901, 0],
            [0, -7462687]
        ],
        [
            [160563380, 686567163],
            [0, 14925374],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, -7462686],
            [-2816901, 0]
        ],
        [
            [171830986, 791044775],
            [-5633803, 0]
        ],
        [
            [166197183, 791044775],
            [-2816901, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, -7462686],
            [-2816902, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686]
        ],
        [
            [169014084, 694029850],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 29850746],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [174647887, 753731343],
            [0, 7462686],
            [-2816901, 0],
            [0, 29850746]
        ],
        [
            [154929577, 432835820],
            [11267606, 0],
            [0, 14925374],
            [5633803, 0],
            [0, 14925373],
            [-11267606, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [160563380, 567164179],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [194366197, 820895522],
            [0, 7462686]
        ],
        [
            [194366197, 828358208],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [191549296, 820895522],
            [2816901, 0]
        ],
        [
            [194366197, 820895522],
            [0, -22388060],
            [-5633803, 0],
            [0, -14925373]
        ],
        [
            [188732394, 783582089],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, -7462686],
            [-5633803, 0]
        ],
        [
            [177464789, 664179104],
            [8450704, 0],
            [0, -29850746],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -14925373]
        ],
        [
            [194366197, 611940298],
            [2816901, 0]
        ],
        [
            [197183098, 611940298],
            [2816902, 0]
        ],
        [
            [200000000, 611940298],
            [2816901, 0]
        ],
        [
            [202816901, 611940298],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [205633803, 619402984],
            [2816901, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [8450704, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [166197183, 567164179],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [169014084, 582089552],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, -14925373],
            [5633803, 0],
            [0, 7462686],
            [11267606, 0],
            [0, 7462687],
            [2816901, 0]
        ],
        [
            [194366197, 597014925],
            [0, 14925373]
        ],
        [
            [171830986, 791044775],
            [0, 7462687]
        ],
        [
            [171830986, 798507462],
            [0, 52238806],
            [-2816902, 0],
            [0, 37313433],
            [2816902, 0],
            [0, 22388059],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0]
        ],
        [
            [180281690, 932835820],
            [0, 14925373],
            [-5633803, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -22388059],
            [-2816901, 0],
            [0, -111940299]
        ],
        [
            [171830986, 798507462],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0]
        ],
        [
            [180281690, 791044775],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 14925374]
        ],
        [
            [188732394, 820895522],
            [0, 22388059]
        ],
        [
            [188732394, 843283581],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 22388060],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388059],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [188732394, 783582089],
            [-8450704, 0],
            [0, 7462686]
        ],
        [
            [177464789, 462686567],
            [-2816902, 0],
            [0, -14925373],
            [11267606, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-5633802, 0]
        ],
        [
            [191549296, 820895522],
            [-2816902, 0]
        ],
        [
            [188732394, 455223880],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [191549296, 552238805],
            [0, 14925374],
            [-2816902, 0],
            [0, -14925374],
            [2816902, 0]
        ],
        [
            [191549296, 552238805],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [194366197, 828358208],
            [2816901, 0],
            [0, 14925373],
            [-8450704, 0]
        ],
        [
            [194366197, 462686567],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [194366197, 537313432],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [197183098, 604477611],
            [0, 7462687]
        ],
        [
            [194366197, 597014925],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [197183098, 477611940],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [197183098, 492537313],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [197183098, 507462686],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [197183098, 522388059],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [197183098, 552238805],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [197183098, 604477611],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [200000000, 537313432],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [202816901, 611940298],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [273239436, 7462687],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [281690141, 29850746],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [298591549, 97014925],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [304225352, 104477612],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925374],
            [-8450704, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -22388060],
            [2816901, 0]
        ],
        [
            [307042253, 380597015],
            [0, 7462686],
            [-2816901, 0],
            [0, -14925373],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [298591549, 388059701],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [292957746, 380597015],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [312676056, 350746268],
            [0, -44776119],
            [-8450704, 0]
        ],
        [
            [304225352, 305970149],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [16901409, 0],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [326760563, 283582089],
            [2816901, 0]
        ],
        [
            [329577464, 283582089],
            [8450705, 0],
            [0, 7462687],
            [2816901, 0]
        ],
        [
            [340845070, 291044776],
            [0, 14925373],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-5633802, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687]
        ],
        [
            [340845070, 335820895],
            [0, -14925373],
            [2816901, 0],
            [0, 14925373],
            [-2816901, 0]
        ],
        [
            [315492957, 201492537],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [304225352, 194029851],
            [-2816902, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -14925373],
            [-5633803, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -22388059],
            [8450704, 0],
            [0, -14925374],
            [-2816901, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -14925374],
            [2816902, 0],
            [0, -22388059],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 14925373],
            [5633803, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 22388060],
            [2816901, 0],
            [0, 22388060],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, -7462687],
            [-8450704, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0]
        ],
        [
            [298591549, 97014925],
            [0, -7462686],
            [5633803, 0],
            [0, 14925373]
        ],
        [
            [312676056, 350746268],
            [-2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -29850746]
        ],
        [
            [307042253, 14925373],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [357746479, 305970149],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [329577464, 283582089],
            [0, -7462686]
        ],
        [
            [329577464, 276119403],
            [0, -14925373],
            [2816902, 0],
            [0, -37313433],
            [-5633803, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [8450704, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [346478873, 171641791],
            [0, 7462686],
            [2816901, 0],
            [0, 14925374],
            [5633803, 0],
            [0, 7462686],
            [5633803, 0]
        ],
        [
            [360563380, 201492537],
            [2816901, 0]
        ],
        [
            [363380281, 201492537],
            [0, 22388060]
        ],
        [
            [363380281, 223880597],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373]
        ],
        [
            [357746479, 246268656],
            [-2816902, 0],
            [0, 14925374],
            [2816902, 0],
            [0, 14925373]
        ],
        [
            [357746479, 276119403],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [354929577, 283582089],
            [-8450704, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, 14925373]
        ],
        [
            [326760563, 283582089],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [349295774, 164179104],
            [-2816901, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0],
            [0, -22388060],
            [5633803, 0],
            [0, -7462687],
            [8450704, 0]
        ],
        [
            [366197183, 111940298],
            [0, 22388060],
            [-2816902, 0],
            [0, 29850746]
        ],
        [
            [363380281, 164179104],
            [-14084507, 0]
        ],
        [
            [346478873, 171641791],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [363380281, 164179104],
            [0, 29850747]
        ],
        [
            [363380281, 194029851],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [385915493, 328358209],
            [-2816902, 0],
            [0, -7462687]
        ],
        [
            [383098591, 320895522],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-8450704, 0]
        ],
        [
            [357746479, 246268656],
            [5633802, 0],
            [0, 7462687],
            [5633803, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0]
        ],
        [
            [374647887, 238805970],
            [0, -7462687]
        ],
        [
            [374647887, 231343283],
            [2816901, 0]
        ],
        [
            [377464788, 231343283],
            [0, 7462687]
        ],
        [
            [377464788, 238805970],
            [19718310, 0]
        ],
        [
            [397183098, 238805970],
            [0, 7462686]
        ],
        [
            [397183098, 246268656],
            [-2816901, 0]
        ],
        [
            [394366197, 246268656],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925373],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [385915493, 291044776],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925374],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462687],
            [-5633802, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -14925373],
            [-2816901, 0],
            [0, -14925373]
        ],
        [
            [380281690, 380597015],
            [0, -7462687],
            [-8450704, 0],
            [0, -7462687],
            [5633802, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 22388060],
            [-2816901, 0]
        ],
        [
            [363380281, 328358209],
            [0, 7462686],
            [-2816901, 0],
            [0, -22388059],
            [2816901, 0],
            [0, 14925373]
        ],
        [
            [357746479, 276119403],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [363380281, 223880597],
            [8450705, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [363380281, 194029851],
            [0, 7462686]
        ],
        [
            [366197183, 111940298],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [374647887, 97014925],
            [5633803, 0]
        ],
        [
            [380281690, 97014925],
            [0, 7462687],
            [8450704, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [391549295, 111940298],
            [0, 14925374],
            [2816902, 0],
            [0, 59701492]
        ],
        [
            [394366197, 186567164],
            [0, 7462687],
            [-5633803, 0],
            [0, 22388059]
        ],
        [
            [388732394, 216417910],
            [-5633803, 0],
            [0, 14925373],
            [-5633803, 0]
        ],
        [
            [374647887, 97014925],
            [0, -22388059],
            [2816901, 0],
            [0, -14925374],
            [2816902, 0],
            [0, 14925374],
            [5633803, 0],
            [0, 14925373],
            [-5633803, 0],
            [0, 7462686]
        ],
        [
            [377464788, 238805970],
            [-2816901, 0]
        ],
        [
            [388732394, 216417910],
            [8450704, 0]
        ],
        [
            [397183098, 216417910],
            [0, 14925373]
        ],
        [
            [397183098, 231343283],
            [0, 7462687]
        ],
        [
            [385915493, 291044776],
            [0, 7462686],
            [-2816902, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [383098591, 320895522],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [394366197, 186567164],
            [8450704, 0],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [408450704, 194029851],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [408450704, 208955224],
            [-11267606, 0],
            [0, 7462686]
        ],
        [
            [394366197, 67164179],
            [-2816902, 0],
            [0, -14925373],
            [5633803, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [405633802, 29850746],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [391549295, 111940298],
            [25352113, 0]
        ],
        [
            [416901408, 111940298],
            [0, 7462687]
        ],
        [
            [416901408, 119402985],
            [0, 14925373]
        ],
        [
            [416901408, 134328358],
            [-2816901, 0],
            [0, 14925373]
        ],
        [
            [414084507, 149253731],
            [0, 14925373],
            [2816901, 0],
            [0, 14925373]
        ],
        [
            [416901408, 179104477],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [405633802, 29850746],
            [5633803, 0]
        ],
        [
            [411267605, 37313433],
            [-2816901, 0],
            [0, 14925373]
        ],
        [
            [408450704, 52238806],
            [-2816902, 0],
            [0, 7462686]
        ],
        [
            [405633802, 59701492],
            [-2816901, 0],
            [0, 29850747],
            [-8450704, 0],
            [0, -22388060]
        ],
        [
            [394366197, 261194030],
            [0, -14925374]
        ],
        [
            [397183098, 246268656],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [400000000, 253731343],
            [0, 7462687],
            [-5633803, 0]
        ],
        [
            [400000000, 253731343],
            [2816901, 0]
        ],
        [
            [402816901, 253731343],
            [0, 14925373]
        ],
        [
            [402816901, 268656716],
            [-2816901, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [402816901, 291044776],
            [-5633803, 0],
            [0, -22388060],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [408450704, 208955224],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [411267605, 223880597],
            [-8450704, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [411267605, 223880597],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [416901408, 231343283],
            [0, 14925373],
            [-5633803, 0]
        ],
        [
            [411267605, 246268656],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [405633802, 291044776],
            [-2816901, 0]
        ],
        [
            [402816901, 268656716],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 14925373]
        ],
        [
            [408450704, 291044776],
            [-2816902, 0]
        ],
        [
            [414084507, 291044776],
            [-5633803, 0]
        ],
        [
            [411267605, 246268656],
            [0, 7462687],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [416901408, 276119403],
            [-2816901, 0],
            [0, 14925373]
        ],
        [
            [405633802, 291044776],
            [0, 7462686]
        ],
        [
            [405633802, 298507462],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [405633802, 59701492],
            [2816902, 0],
            [0, -7462686]
        ],
        [
            [411267605, 74626866],
            [0, 14925373],
            [-5633803, 0],
            [0, -29850747]
        ],
        [
            [408450704, 305970149],
            [-2816902, 0],
            [0, -7462687]
        ],
        [
            [414084507, 291044776],
            [0, 14925373]
        ],
        [
            [414084507, 305970149],
            [-5633803, 0]
        ],
        [
            [416901408, 179104477],
            [11267606, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [447887323, 231343283],
            [-2816901, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [436619718, 223880597],
            [-2816902, 0],
            [0, -7462687],
            [-8450704, 0],
            [0, 7462687]
        ],
        [
            [425352112, 223880597],
            [-8450704, 0],
            [0, 7462686]
        ],
        [
            [419718309, 365671641],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [416901408, 350746268],
            [0, 7462687],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [416901408, 350746268],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -22388060]
        ],
        [
            [414084507, 305970149],
            [5633802, 0]
        ],
        [
            [419718309, 305970149],
            [2816902, 0]
        ],
        [
            [422535211, 320895522],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [-5633803, 0]
        ],
        [
            [425352112, 223880597],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925373],
            [2816901, 0]
        ],
        [
            [433802816, 246268656],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388060]
        ],
        [
            [430985915, 276119403],
            [-14084507, 0]
        ],
        [
            [411267605, 380597015],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [416901408, 134328358],
            [5633803, 0]
        ],
        [
            [422535211, 149253731],
            [-8450704, 0]
        ],
        [
            [419718309, 305970149],
            [0, -14925373],
            [-5633802, 0]
        ],
        [
            [430985915, 276119403],
            [0, 7462686]
        ],
        [
            [416901408, 111940298],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [422535211, 119402985],
            [-5633803, 0]
        ],
        [
            [436619718, 223880597],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925373]
        ],
        [
            [273239436, 604477611],
            [0, -7462686],
            [2816902, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [295774648, 619402984],
            [0, -7462686]
        ],
        [
            [295774648, 611940298],
            [0, -22388060],
            [-2816902, 0],
            [0, -7462686],
            [-8450704, 0]
        ],
        [
            [284507042, 582089552],
            [0, -22388060],
            [8450704, 0]
        ],
        [
            [292957746, 559701492],
            [5633803, 0]
        ],
        [
            [298591549, 559701492],
            [0, 22388060],
            [2816901, 0],
            [0, 37313432],
            [-5633802, 0]
        ],
        [
            [287323943, 611940298],
            [-2816901, 0],
            [0, -29850746]
        ],
        [
            [295774648, 611940298],
            [-8450705, 0]
        ],
        [
            [295774648, 619402984],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [298591549, 634328358],
            [-11267606, 0],
            [0, -22388060]
        ],
        [
            [315492957, 544776119],
            [-2816901, 0]
        ],
        [
            [312676056, 544776119],
            [-14084507, 0]
        ],
        [
            [298591549, 544776119],
            [-5633803, 0]
        ],
        [
            [292957746, 544776119],
            [0, -7462687]
        ],
        [
            [292957746, 537313432],
            [11267606, 0],
            [0, -7462686],
            [-11267606, 0]
        ],
        [
            [292957746, 529850746],
            [-2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [2816902, 0]
        ],
        [
            [295774648, 514925373],
            [8450704, 0],
            [0, -7462687],
            [5633803, 0]
        ],
        [
            [309859155, 507462686],
            [5633802, 0],
            [0, 7462687]
        ],
        [
            [315492957, 514925373],
            [0, 29850746]
        ],
        [
            [292957746, 537313432],
            [0, -7462686]
        ],
        [
            [292957746, 559701492],
            [0, -14925373]
        ],
        [
            [298591549, 544776119],
            [0, 14925373]
        ],
        [
            [295774648, 514925373],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687]
        ],
        [
            [304225352, 492537313],
            [2816901, 0]
        ],
        [
            [307042253, 492537313],
            [2816902, 0]
        ],
        [
            [309859155, 492537313],
            [0, 14925373]
        ],
        [
            [312676056, 544776119],
            [0, 52238806],
            [-5633803, 0],
            [0, 44776119]
        ],
        [
            [307042253, 641791044],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, -14925373]
        ],
        [
            [304225352, 492537313],
            [0, -7462687],
            [2816901, 0]
        ],
        [
            [307042253, 485074626],
            [0, 7462687]
        ],
        [
            [307042253, 485074626],
            [2816902, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, -14925374],
            [2816901, 0],
            [0, -14925373],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [14084507, 0]
        ],
        [
            [349295774, 402985074],
            [0, 22388060],
            [-2816901, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [338028169, 447761194],
            [0, 22388059],
            [-2816902, 0],
            [0, 7462687],
            [-11267605, 0],
            [0, 7462686]
        ],
        [
            [323943662, 485074626],
            [-8450705, 0],
            [0, 7462687],
            [-5633802, 0]
        ],
        [
            [315492957, 544776119],
            [8450705, 0]
        ],
        [
            [323943662, 544776119],
            [0, 89552239]
        ],
        [
            [323943662, 634328358],
            [-14084507, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [323943662, 485074626],
            [2816901, 0],
            [0, 7462687],
            [11267606, 0],
            [0, 7462687],
            [8450704, 0]
        ],
        [
            [346478873, 500000000],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [-11267606, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, -7462686],
            [-11267606, 0]
        ],
        [
            [363380281, 686567163],
            [-19718310, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -29850746],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [332394366, 634328358],
            [0, -29850747],
            [2816901, 0],
            [0, -44776119],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [326760563, 559701492],
            [0, -14925373],
            [-2816901, 0]
        ],
        [
            [346478873, 500000000],
            [2816901, 0],
            [0, -14925374],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687]
        ],
        [
            [354929577, 470149253],
            [2816902, 0],
            [0, 7462687]
        ],
        [
            [357746479, 477611940],
            [0, 14925373],
            [22535211, 0]
        ],
        [
            [380281690, 492537313],
            [0, 37313433],
            [2816901, 0],
            [0, 14925373]
        ],
        [
            [383098591, 544776119],
            [0, 14925373],
            [-2816901, 0],
            [0, 22388060],
            [-5633803, 0],
            [0, 22388059],
            [2816901, 0]
        ],
        [
            [377464788, 604477611],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 29850747],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0],
            [0, 14925373]
        ],
        [
            [338028169, 447761194],
            [11267605, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 14925373]
        ],
        [
            [326760563, 559701492],
            [0, 44776119],
            [2816901, 0],
            [0, 29850747]
        ],
        [
            [329577464, 634328358],
            [-5633802, 0]
        ],
        [
            [332394366, 634328358],
            [-2816902, 0]
        ],
        [
            [349295774, 402985074],
            [5633803, 0],
            [0, -7462686],
            [11267606, 0]
        ],
        [
            [366197183, 395522388],
            [0, 14925373],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 29850747],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [377464788, 455223880],
            [0, 7462687],
            [-5633802, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-11267605, 0]
        ],
        [
            [377464788, 455223880],
            [0, -7462686],
            [2816902, 0],
            [0, -14925374]
        ],
        [
            [380281690, 432835820],
            [8450704, 0],
            [0, 7462687]
        ],
        [
            [388732394, 440298507],
            [0, 37313433]
        ],
        [
            [388732394, 477611940],
            [-2816901, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 7462687]
        ],
        [
            [377464788, 604477611],
            [2816902, 0],
            [0, 14925373],
            [2816901, 0],
            [0, 14925374]
        ],
        [
            [383098591, 634328358],
            [0, 14925373]
        ],
        [
            [383098591, 649253731],
            [0, 29850746],
            [-2816901, 0],
            [0, 7462686]
        ],
        [
            [380281690, 686567163],
            [-2816902, 0]
        ],
        [
            [377464788, 686567163],
            [-8450704, 0]
        ],
        [
            [369014084, 686567163],
            [-5633803, 0]
        ],
        [
            [366197183, 395522388],
            [5633803, 0],
            [0, 7462686],
            [5633802, 0],
            [0, 7462687],
            [2816902, 0]
        ],
        [
            [380281690, 410447761],
            [0, 22388059]
        ],
        [
            [369014084, 694029850],
            [0, -7462687]
        ],
        [
            [377464788, 686567163],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [374647887, 694029850],
            [-5633803, 0]
        ],
        [
            [369014084, 708955223],
            [0, -14925373]
        ],
        [
            [374647887, 694029850],
            [0, 14925373],
            [-5633803, 0]
        ],
        [
            [371830986, 731343283],
            [-2816902, 0],
            [0, -22388060]
        ],
        [
            [380281690, 686567163],
            [0, 22388060],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [369014084, 843283581],
            [0, -14925373],
            [2816902, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -29850746]
        ],
        [
            [371830986, 768656716],
            [8450704, 0],
            [0, 7462686],
            [5633803, 0],
            [0, 7462687],
            [8450704, 0],
            [0, 14925373]
        ],
        [
            [394366197, 798507462],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 14925373]
        ],
        [
            [388732394, 828358208],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-11267606, 0]
        ],
        [
            [374647887, 843283581],
            [-5633803, 0]
        ],
        [
            [374647887, 865671641],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [371830986, 873134327],
            [0, -22388059],
            [-2816902, 0],
            [0, -7462687]
        ],
        [
            [374647887, 843283581],
            [0, 7462687]
        ],
        [
            [374647887, 850746268],
            [0, 14925373]
        ],
        [
            [371830986, 768656716],
            [0, -7462687],
            [2816901, 0],
            [0, -22388060],
            [-2816901, 0],
            [0, -7462686]
        ],
        [
            [383098591, 649253731],
            [14084507, 0]
        ],
        [
            [397183098, 649253731],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [400000000, 656716417],
            [0, 22388060],
            [2816901, 0],
            [0, 7462686]
        ],
        [
            [402816901, 686567163],
            [0, 52238806]
        ],
        [
            [402816901, 738805969],
            [0, 29850747],
            [2816901, 0],
            [0, 22388059]
        ],
        [
            [405633802, 791044775],
            [-2816901, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, -14925373],
            [-5633803, 0]
        ],
        [
            [374647887, 865671641],
            [8450704, 0]
        ],
        [
            [383098591, 865671641],
            [0, 7462686],
            [11267606, 0],
            [0, -7462686],
            [8450704, 0],
            [0, -14925373]
        ],
        [
            [402816901, 850746268],
            [8450704, 0],
            [0, 29850746]
        ],
        [
            [411267605, 880597014],
            [-2816901, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, 14925374],
            [5633803, 0]
        ],
        [
            [411267605, 888059701],
            [2816902, 0]
        ],
        [
            [414084507, 888059701],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-14084507, 0],
            [0, 7462687],
            [-8450704, 0],
            [0, -7462687],
            [-2816902, 0],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -44776120]
        ],
        [
            [397183098, 902985074],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [8450704, 0],
            [0, -14925373],
            [-5633803, 0]
        ],
        [
            [391549295, 634328358],
            [-8450704, 0]
        ],
        [
            [383098591, 544776119],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [385915493, 552238805],
            [0, 7462687]
        ],
        [
            [385915493, 559701492],
            [0, 44776119],
            [2816901, 0],
            [0, 22388060],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [383098591, 865671641],
            [0, -7462687],
            [-2816901, 0],
            [0, -7462686],
            [-5633803, 0]
        ],
        [
            [388732394, 828358208],
            [2816901, 0],
            [0, 7462687],
            [8450705, 0]
        ],
        [
            [400000000, 835820895],
            [0, 14925373],
            [2816901, 0]
        ],
        [
            [380281690, 410447761],
            [11267605, 0]
        ],
        [
            [391549295, 410447761],
            [0, 29850746],
            [-2816901, 0]
        ],
        [
            [388732394, 477611940],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [16901408, 0],
            [0, 14925373]
        ],
        [
            [411267605, 507462686],
            [0, 37313433]
        ],
        [
            [411267605, 544776119],
            [-22535211, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [391549295, 634328358],
            [2816902, 0]
        ],
        [
            [394366197, 634328358],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [411267605, 544776119],
            [0, 7462686]
        ],
        [
            [411267605, 552238805],
            [-5633803, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462686],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0]
        ],
        [
            [411267605, 552238805],
            [0, 7462687],
            [5633803, 0],
            [0, 22388060],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 14925373]
        ],
        [
            [416901408, 604477611],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [414084507, 626865671],
            [-16901409, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [391549295, 410447761],
            [2816902, 0],
            [0, -7462687],
            [8450704, 0],
            [0, 7462687],
            [11267606, 0],
            [0, -7462687],
            [2816901, 0],
            [0, -7462686],
            [5633803, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 29850746],
            [5633803, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [5633803, 0]
        ],
        [
            [445070422, 455223880],
            [0, 7462687],
            [2816901, 0]
        ],
        [
            [447887323, 462686567],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [450704225, 470149253],
            [0, 14925373],
            [-2816902, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -7462687],
            [-2816901, 0]
        ],
        [
            [442253521, 470149253],
            [0, 14925373],
            [2816901, 0],
            [0, 7462687]
        ],
        [
            [445070422, 492537313],
            [-2816901, 0]
        ],
        [
            [442253521, 492537313],
            [-22535212, 0],
            [0, 7462687],
            [-5633802, 0],
            [0, 7462686],
            [-2816902, 0]
        ],
        [
            [442253521, 470149253],
            [0, -7462686],
            [-2816902, 0],
            [0, 7462686],
            [2816902, 0]
        ],
        [
            [405633802, 791044775],
            [5633803, 0],
            [0, 37313433]
        ],
        [
            [411267605, 828358208],
            [-8450704, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [411267605, 649253731],
            [0, 7462686],
            [-11267605, 0]
        ],
        [
            [414084507, 626865671],
            [0, 14925373],
            [-2816902, 0],
            [0, 7462687]
        ],
        [
            [411267605, 649253731],
            [2816902, 0],
            [0, 7462686],
            [5633802, 0],
            [0, 7462687]
        ],
        [
            [419718309, 664179104],
            [0, 7462686],
            [-8450704, 0],
            [0, 14925373],
            [-8450704, 0]
        ],
        [
            [411267605, 888059701],
            [0, -7462687]
        ],
        [
            [411267605, 828358208],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, -14925373],
            [2816901, 0],
            [0, -22388060],
            [-2816901, 0],
            [0, -22388059],
            [-2816901, 0],
            [0, -14925373]
        ],
        [
            [414084507, 768656716],
            [5633802, 0],
            [0, -7462687],
            [5633803, 0],
            [0, 7462687],
            [2816902, 0]
        ],
        [
            [428169014, 768656716],
            [0, 44776119],
            [-2816902, 0],
            [0, 14925373],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 37313432],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462687]
        ],
        [
            [414084507, 768656716],
            [0, -14925373],
            [-2816902, 0],
            [0, -7462687],
            [-5633803, 0],
            [0, -7462687],
            [-2816901, 0]
        ],
        [
            [419718309, 664179104],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0],
            [0, 7462686],
            [8450704, 0]
        ],
        [
            [439436619, 686567163],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388060],
            [-2816902, 0],
            [0, 22388059],
            [-2816901, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 22388060]
        ],
        [
            [442253521, 492537313],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [5633803, 0]
        ],
        [
            [459154929, 529850746],
            [0, 7462686]
        ],
        [
            [459154929, 537313432],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 14925374],
            [-5633803, 0],
            [0, 7462686],
            [-2816901, 0],
            [0, 7462687],
            [-2816902, 0],
            [0, 14925373]
        ],
        [
            [453521126, 597014925],
            [-2816901, 0],
            [0, 7462686],
            [-33802817, 0]
        ],
        [
            [453521126, 597014925],
            [2816902, 0]
        ],
        [
            [456338028, 597014925],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 14925374],
            [-2816901, 0],
            [0, 7462686],
            [-5633803, 0],
            [0, 44776119]
        ],
        [
            [439436619, 865671641],
            [0, 7462686],
            [-8450704, 0],
            [0, -7462686],
            [-2816901, 0],
            [0, -22388060],
            [2816901, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -29850747],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [2816902, 0],
            [0, -7462686],
            [2816901, 0],
            [0, -7462687],
            [2816901, 0],
            [0, 52238806],
            [-2816901, 0],
            [0, 22388060],
            [-2816901, 0],
            [0, 14925373],
            [-2816902, 0]
        ],
        [
            [436619718, 761194029],
            [0, 7462687],
            [-2816902, 0],
            [0, -14925373],
            [2816902, 0],
            [0, 7462686]
        ],
        [
            [439436619, 768656716],
            [0, -7462687],
            [2816902, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [445070422, 492537313],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0],
            [0, 7462687],
            [2816902, 0],
            [0, 7462686],
            [2816901, 0]
        ],
        [
            [459154929, 522388059],
            [0, 7462687]
        ],
        [
            [450704225, 723880596],
            [0, -7462686],
            [2816901, 0],
            [0, 7462686],
            [-2816901, 0]
        ],
        [
            [453521126, 835820895],
            [-2816901, 0],
            [0, -7462687],
            [5633803, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [459154929, 537313432],
            [2816902, 0]
        ],
        [
            [461971831, 537313432],
            [8450704, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462686],
            [2816902, 0],
            [0, 7462687],
            [2816901, 0],
            [0, 7462687],
            [-5633803, 0],
            [0, 7462686],
            [-8450704, 0],
            [0, 7462687],
            [-2816901, 0],
            [0, 7462686],
            [-2816902, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [459154929, 522388059],
            [2816902, 0],
            [0, 14925373]
        ],
        [
            [467605633, 813432835],
            [0, 7462687],
            [-2816901, 0],
            [0, -14925374],
            [5633803, 0],
            [0, 7462687],
            [-2816902, 0]
        ],
        [
            [357746479, 731343283],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ],
        [
            [997183098, 970149253],
            [0, -7462687],
            [2816901, 0],
            [0, 7462687],
            [-2816901, 0]
        ]
    ]
}
