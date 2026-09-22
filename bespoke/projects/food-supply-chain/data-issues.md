# Food supply chain data: problems found while building the waterfall

Written 2026-09-21, against the SCL-based files Pablo published on 2026-09-14.

- Manifest: `https://owid-public.owid.io/data/food-supply-chain/food-supply-chain.metadata.json`
- Data: `https://owid-public.owid.io/data/food-supply-chain/food-supply-chain.<id>.json`

I fetched all 189 entity files and checked every entity, measure and year:
7,695 combinations in total. The waterfall arithmetic itself is sound. Summing
the twelve signed stages reproduces `food` to within 2% in every single case,
with no nulls anywhere. What follows is everything else.

Related: [owid-issues#2526](https://github.com/owid/owid-issues/issues/2526).

## 1. The stage order is not a valid waterfall order for exporters

This is the big one.

`stages[]` lists exports and animal feed as outflows before it lists
`animal_products` ("Livestock, dairy, eggs and fish") as an inflow. For a
country that exports a lot of meat or fish, that means the chart subtracts the
export of the fish before it adds the fish. The running balance craters and then
climbs back.

Iceland, protein, 2022, in grams per person per day:

| stage                           |   value | running balance |
| ------------------------------- | ------: | --------------: |
| Crop production                 |   +7.28 |            7.28 |
| Imports                         | +194.94 |          202.22 |
| Exports                         | -654.99 |     **-452.77** |
| Stock change                    |  +20.51 |         -432.26 |
| Seed                            |   -0.46 |         -432.72 |
| Losses                          |   -0.82 |         -433.54 |
| Non-food uses                   |   -8.13 |         -441.67 |
| Processing, net                 |   +9.59 |         -432.08 |
| Animal feed                     | -119.42 |         -551.50 |
| Livestock, dairy, eggs and fish | +703.79 |          152.29 |
| Tourist consumption             |    0.00 |          152.29 |
| Residuals                       |   -0.38 |          151.92 |
| **Food available to eat**       |         |      **151.92** |

The total is right. The path to it is not. A reader watching that chart sees
Iceland's food supply go 450 g per person per day into deficit and come back,
which is not a thing that happens.

Scale of it: the running balance goes below zero in **591 of 7,695**
entity-measure-years, across **36 entities**. Denmark, Iceland, Ireland, New
Zealand and Uruguay are affected in all 42 of their entity-measure-years, in
every measure and every year. Also hit: Netherlands, Norway, Belarus, Belize,
Kiribati, Seychelles, Brazil, Ukraine and the Oceania aggregate.

The stage where the balance first goes negative:

| stage           | cases |
| --------------- | ----: |
| Animal feed     |   346 |
| Exports         |   128 |
| Non-food uses   |    82 |
| Processing, net |    28 |
| Losses          |     4 |
| Stock change    |     2 |
| Seed            |     1 |

It is worst in protein (292 cases), then mass (194), then energy (105).

**A reordering fixes almost all of it.** I tested moving `animal_products` up to
sit with the other inflows, so the order becomes crop production, then
livestock/fish, then imports, then every outflow with feed near the end. That
drops the negative excursions from 591 cases across 36 entities to **13 cases
across 5 entities**, and the worst dip from -3,130% of the chart's peak to -13%.
The five that remain are Uruguay, Brazil, Eswatini, Saint Kitts and Nevis, and
Ukraine, all shallow.

I also tested netting feed and livestock into a single "animal detour" step,
which is the shape the design handoff hinted at. **That is worse**, not better:
905 cases across 63 entities, because the Gulf states, Israel, Malta, Cyprus and
others import their feed, so the netted step swings sharply negative. Don't do
that one.

For now the chart keeps the manifest's order and lets the axis go negative,
which is Sophia's call. But if the stage order in `stages[]` were changed to put
supply first, the chart would inherit the fix for free and the presentation
order would stop being a thing the front end overrides.

## 2. Nauru's numbers are impossible

Nauru, 2023:

| measure                      | Non-food uses | Livestock/fish | Food available to eat |
| ---------------------------- | ------------: | -------------: | --------------------: |
| kcal per person per day      |        21,061 |         21,074 |                 3,044 |
| g protein per person per day |         3,361 |          3,364 |                   103 |
| kg per person per day        |         27.63 |          27.65 |                  1.67 |

3.4 kg of protein per person per day, and 27 kg of food mass per person per day.
A person eats something like 60 to 100 g of protein. The two stages are within
0.1% of each other, which looks like a large tuna catch being routed through
"industrial and other non-food uses" and then straight back out through
"livestock, dairy, eggs and fish" without ever being consumed by anyone in
Nauru.

Tuvalu has the same pattern, milder: non-food uses is 7x its food protein.

Every other entity is under 5x. Whatever this is, it is specific to the small
Pacific island states with large fishing zones and tiny populations.

The consequence for the chart is that Nauru's protein waterfall has a value
domain around 33x taller than the part anyone wants to look at, so the real
chart is squeezed into 3% of the plot height.

## 3. 28 mappable countries are missing

Absent from `dimensions.entities`, checked against the countries OWID marks as
mappable:

Andorra, Antarctica, Benin, Brunei, Burundi, Central African Republic, Chad,
Dominica, Equatorial Guinea, Eritrea, French Guiana, French Southern
Territories, Greenland, **Japan**, Kosovo, Liechtenstein, **Mali**, Monaco,
Palau, Palestine, Puerto Rico, San Marino, **Singapore**, **Somalia**, **South
Sudan**, **Sudan**, Togo, Western Sahara.

The microstates and territories are unsurprising. The rest are not: Japan,
Sudan, Somalia, South Sudan, Mali, Chad, Benin, Togo, Burundi, Central African
Republic, Eritrea, Singapore and Palestine are all countries a reader will look
for, and most of them are exactly the places where "where does the food go" is
the interesting question.

Pablo noted on the issue that FBS pulled Japan and ten other countries in
October 2025 pending a review, and that ETL keeps them alive by combining the
latest FBS release with the previous one. That trick has not been applied to
SCL. It sounds like it could be.

## 4. Year coverage varies per entity, and the manifest doesn't say so

The manifest declares `timeRange: { start: 2010, end: 2023 }`. That is the
union, not what any given entity has.

| coverage            | entities |
| ------------------- | -------: |
| 2010-2023, 14 years |      179 |
| 2019-2023, 5 years  |        8 |
| 2010-2019           |        1 |
| 2010-2018           |        1 |

The short ones are Bahrain, Bhutan, Marshall Islands, Micronesia, Nauru, Qatar,
Tonga and Tuvalu (2019 onwards), Cuba (stops at 2019) and North Korea (stops at
2018).

This is fine as data. It is awkward as an interface, because the year control
can only find out what years an entity has after it has fetched that entity's
file, so the slider has to rebuild and the selection has to clamp on every
entity change. If the manifest carried a per-entity year range, or even just a
first and last year per entity, that would go away.

## 5. `direction` doesn't tell you which way a bar points

Three stages declared `"out"` are frequently negative, meaning they add rather
than subtract:

| stage                   |          negative in |
| ----------------------- | -------------------: |
| Residuals and balancing | 5,476 of 7,695 (71%) |
| Stock change            |          3,173 (41%) |
| Processing, net         |          1,909 (25%) |

`exports` is negative once, which is probably worth a look on its own.

Not a bug, but worth stating in the manifest's own terms: `direction` is the
sign convention for the arithmetic, not a claim about which way the bar goes.
The chart computes a signed delta and reads the sign off that. Anybody else
consuming these files will hit the same thing.

## 6. Some per-capita totals are very large, and the framing should be deliberate

Energy entering the system, 2023, kcal per person per day:

- Latvia 35,800, Netherlands 35,720, Lithuania 33,672, Djibouti 31,219
- Yemen 1,927, DR Congo 2,374, Madagascar 2,421

The share that ends up as food available to eat ranges from **8.7%** (Djibouti)
to **99.4%** (Mongolia).

I don't think these are wrong. They are re-export and transit economies, and a
per-capita denominator on a country that moves other people's food through its
ports produces exactly this. But it means a headline like "only 44% of what
enters our food system gets eaten" is a property of the country selected, not a
fact about food, and the chart's copy has to survive being pointed at Djibouti
and at Mongolia on the same day.

## 7. The stage names need English

Not a data problem, just a note on what the chart has to supply. "Processing,
net", "Residuals and balancing" and "Industrial and other non-food uses" are
accounting terms. The viz will write reader-facing labels for all twelve, and
it would be better if those lived in the manifest next to the keys than in the
front end, since the next consumer of this data will write them again.

## Summary for the data team

Worth acting on, roughly in order:

1. Reorder `stages[]` so all inflows come before the outflows. One change, fixes
   591 broken waterfalls down to 13 shallow ones.
2. Look at Nauru and Tuvalu. Non-food uses at 7x to 33x food protein is not
   real.
3. Apply the FBS backfill trick to SCL, or otherwise recover Japan, Sudan,
   Somalia, South Sudan, Mali, Chad, Benin, Togo, Burundi, CAR, Eritrea,
   Singapore and Palestine.
4. Put per-entity year coverage in the manifest.
5. Consider adding reader-facing stage labels and descriptions to the manifest.
