import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GRAPHER_PAGE_BODY_CLASS,
    LoadingIndicator,
} from "@ourworldindata/grapher"
import {
    flatten,
    PostReference,
    RelatedChart,
    serializeJSONForHTML,
    GrapherInterface,
    uniq,
    SiteFooterContext,
    Url,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import React from "react"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { ChartListItemVariant } from "./ChartListItemVariant.js"
import { Head } from "./Head.js"
import { IFrameDetector } from "./IframeDetector.js"
import { RelatedArticles } from "./RelatedArticles/RelatedArticles.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"
import GrapherImage from "./GrapherImage.js"

const notebook = `
\`\`\`python
#
#  internal.py
#
#  Internal APIs subject to change at any time.
#

import datetime as dt
import json
import re
from dataclasses import dataclass
from typing import Dict, List, Literal, Optional

import pandas as pd
from dateutil.parser import parse as date_parse


class LicenseError(Exception):
    pass


class ChartNotFoundError(Exception):
    pass


@dataclass
class _Indicator:
    data: dict
    metadata: dict

    def to_dict(self):
        return {"data": self.data, "metadata": self.metadata}

    def to_frame(self):
        if self.metadata.get("nonRedistributable"):
            raise LicenseError(
                "API download is disallowed for this indicator due to license restrictions from the data provider"
            )

        # getting a data frame is easy
        df = pd.DataFrame.from_dict(self.data)

        # turning entity ids into entity names
        entities = pd.DataFrame.from_records(self.metadata["dimensions"]["entities"]["values"])
        id_to_name = entities.set_index("id").name.to_dict()
        df["entities"] = df.entities.apply(id_to_name.__getitem__)

        # make the "values" column more interestingly named
        short_name = self.metadata.get("shortName", f'_{self.metadata["id"]}')
        df = df.rename(columns={"values": short_name})

        time_col = self._detect_time_col_type()
        if time_col == "dates":
            df["years"] = self._convert_years_to_dates(df["years"])

        # order the columns better
        cols = ["entities", "years"] + sorted(df.columns.difference(["entities", "years"]))
        df = df[cols]

        return df

    def _detect_time_col_type(self) -> Literal["dates", "years"]:
        if self.metadata.get("display", {}).get("yearIsDay"):
            return "dates"

        return "years"

    def _convert_years_to_dates(self, years):
        base_date = date_parse(self.metadata["display"]["zeroDay"])
        return years.apply(lambda y: base_date + dt.timedelta(days=y))


@dataclass
class _GrapherBundle:
    config: dict
    dimensions: Dict[int, _Indicator]
    origins: List[dict]

    def to_json(self):
        return json.dumps(
            {
                "config": self.config,
                "dimensions": {k: i.to_dict() for k, i in self.dimensions.items()},
                "origins": self.origins,
            }
        )

    def size(self):
        return len(self.to_json())

    @property
    def indicators(self) -> List[_Indicator]:
        return list(self.dimensions.values())

    def to_frame(self):
        # combine all the indicators into a single data frame and one metadata dict
        metadata = {}
        df = None
        for i in self.indicators:
            to_merge = i.to_frame()
            (value_col,) = to_merge.columns.difference(["entities", "years"])
            metadata[value_col] = i.metadata.copy()

            if df is None:
                df = to_merge
            else:
                df = pd.merge(df, to_merge, how="outer", on=["entities", "years"])

        assert df is not None

        # save some useful metadata onto the frame
        assert self.config
        slug = self.config["slug"]
        df.attrs["slug"] = slug
        df.attrs["url"] = f"https://ourworldindata.org/grapher/{slug}"
        df.attrs["metadata"] = metadata

        # if there is only one indicator, we can use the slug as the column name
        if len(df.columns) == 3:
            assert self.config
            (value_col,) = df.columns.difference(["entities", "years"])
            short_name = slug.replace("-", "_")
            df = df.rename(columns={value_col: short_name})
            df.attrs["metadata"][short_name] = df.attrs["metadata"].pop(value_col)

            df.attrs["value_col"] = short_name

        # we kept using "years" until now to keep the code paths the same, but they could
        # be dates
        if df["years"].astype(str).str.match(r"^\d{4}-\d{2}-\d{2}$").all():
            df = df.rename(columns={"years": "dates"})

        return df

    def __repr__(self):
        return f"GrapherBundle(config={self.config}, dimensions=..., origins=...)"


def _fetch_grapher_config(slug):
    resp = open_url(f"https://ourworldindata.org/grapher/{slug}")
    if resp.status_code == 404:
        raise ChartNotFoundError(slug)

    resp.raise_for_status()
    return json.loads(resp.content.decode("utf-8").split("//EMBEDDED_JSON")[1])


def _fetch_dimension(id: int) -> _Indicator:
    data = open_url(f"https://api.ourworldindata.org/v1/indicators/{id}.data.json").json()
    metadata = open_url(f"https://api.ourworldindata.org/v1/indicators/{id}.metadata.json").json()
    return _Indicator(data, metadata)


def _fetch_bundle(slug: str) -> _GrapherBundle:
    config = _fetch_grapher_config(slug)
    indicator_ids = [d["variableId"] for d in config["dimensions"]]

    dimensions = {indicator_id: _fetch_dimension(indicator_id) for indicator_id in indicator_ids}

    origins = []
    for d in dimensions.values():
        if d.metadata.get("origins"):
            origins.append(d.metadata.pop("origins"))
    return _GrapherBundle(config, dimensions, origins)


def _list_charts() -> List[str]:
    content = open_url("https://ourworldindata.org/charts").content.decode("utf-8")
    links = re.findall('"(/grapher/[^"]+)"', content)
    slugs = [link.strip('"').split("/")[-1] for link in links]
    return sorted(set(slugs))




@dataclass
class Chart:
    """
    A chart published on Our World in Data, for example:
    https://ourworldindata.org/grapher/life-expectancy
    """

    slug: str

    _bundle: Optional[_GrapherBundle] = None

    @property
    def bundle(self) -> _GrapherBundle:
        # LARS: give a nice error if the chart does not exist
        if self._bundle is None:
            self._bundle = _fetch_bundle(self.slug)

        return self._bundle

    @property
    def config(self) -> dict:
        return self.bundle.config  # type: ignore

    def get_data(self) -> pd.DataFrame:
        return self.bundle.to_frame()

    def __lt__(self, other):
        return self.slug < other.slug

    def __eq__(self, value: object) -> bool:
        return isinstance(value, Chart) and value.slug == self.slug


def list_charts() -> List[str]:
    """
    List all available charts published on Our World in Data.
    """
    return sorted(_list_charts())


def get_data(slug: str) -> pd.DataFrame:
    """
    Fetch the data for a chart by its slug.
    """
    return Chart(slug).get_data()
\`\`\`

`

const notebookScript = `import {StarboardEmbed} from "https://unpkg.com/starboard-wrap/dist/index.js"
    const mount = document.querySelector("#notebook");

    const notebook = \`# %% [markdown]
# Test
Try editing this cell by clicking the pencil on the left!
# %% [python]
print("hello")\`

    const el = new StarboardEmbed({
        notebookContent: notebook,
        src: "https://unpkg.com/starboard-notebook/dist/index.html"
    });

    mount.appendChild(el);
`

export const GrapherPage = (props: {
    grapher: GrapherInterface
    relatedCharts?: RelatedChart[]
    relatedArticles?: PostReference[]
    baseUrl: string
    baseGrapherUrl: string
}) => {
    const { grapher, relatedCharts, relatedArticles, baseGrapherUrl, baseUrl } =
        props
    const pageTitle = grapher.title
    const canonicalUrl = urljoin(baseGrapherUrl, grapher.slug as string)
    const dataApiOrigin = Url.fromURL(DATA_API_URL).origin
    let pageDesc: string
    if (grapher.subtitle?.length) {
        // convert subtitle from markdown to plaintext
        pageDesc = new MarkdownTextWrap({
            text: grapher.subtitle,
            fontSize: 10,
        }).plaintext
    } else pageDesc = "An interactive visualization from Our World in Data."

    // Due to thumbnails not taking into account URL parameters, they are often inaccurate on
    // social media. We decided to remove them and use a single thumbnail for all charts.
    // See https://github.com/owid/owid-grapher/issues/1086
    //
    // const imageUrl = urljoin(
    //     baseGrapherUrl,
    //     "exports",
    //     `${grapher.slug}.png?v=${grapher.version}`
    // )
    const imageUrl: string = urljoin(baseUrl, "default-grapher-thumbnail.png")
    const imageWidth = "1200"
    const imageHeight = "628"

    const script = `const jsonConfig = ${serializeJSONForHTML({
        ...grapher,
        adminBaseUrl: ADMIN_BASE_URL,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        dataApiUrl: DATA_API_URL,
    })}
window.Grapher.renderSingleGrapherOnGrapherPage(jsonConfig)`

    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))

    return (
        <html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                <IFrameDetector />
                <noscript>
                    <style>{`
                    figure { display: none !important; }
                `}</style>
                </noscript>
                <link rel="preconnect" href={dataApiOrigin} />
                {flatten(
                    variableIds.map((variableId) =>
                        [
                            getVariableDataRoute(DATA_API_URL, variableId),
                            getVariableMetadataRoute(DATA_API_URL, variableId),
                        ].map((href) => (
                            <link
                                key={href}
                                rel="preload"
                                href={href}
                                as="fetch"
                                crossOrigin="anonymous"
                            />
                        ))
                    )
                )}
                <link
                    rel="preload"
                    href="/fonts/PlayfairDisplayLatin-SemiBold.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className={GRAPHER_PAGE_BODY_CLASS}>
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <figure data-grapher-src={`/grapher/${grapher.slug}`}>
                        <LoadingIndicator />
                    </figure>
                    <noscript id="fallback">
                        {grapher.slug && (
                            <GrapherImage
                                slug={grapher.slug}
                                alt={grapher.title}
                            />
                        )}
                        <p>Interactive visualization requires JavaScript</p>
                    </noscript>

                    {((relatedArticles && relatedArticles.length !== 0) ||
                        (relatedCharts && relatedCharts.length !== 0)) && (
                        <div className="related-research-data">
                            <h2>Related research and data</h2>
                            {relatedArticles &&
                                relatedArticles.length !== 0 && (
                                    <RelatedArticles
                                        articles={relatedArticles}
                                    />
                                )}
                            {relatedCharts && relatedCharts.length !== 0 && (
                                <>
                                    <h3>Charts</h3>
                                    <ul>
                                        {relatedCharts
                                            .filter(
                                                (chartItem) =>
                                                    chartItem.slug !==
                                                    grapher.slug
                                            )
                                            .map((c) => (
                                                <ChartListItemVariant
                                                    key={c.slug}
                                                    chart={c}
                                                />
                                            ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}
                </main>
                <div id="notebook" />
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.grapherPage}
                />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: script }}
                />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: notebookScript }}
                />
            </body>
        </html>
    )
}
