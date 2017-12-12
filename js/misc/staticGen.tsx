import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'

class ChartPage extends React.Component<any> {
    render() {
        const {props} = this
        const {chart} = this.props
        return <html lang="en">
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1"/>
                <title>{chart.title} - Our World in Data</title>
                <meta name="description" content={chart.description}/>
                <link rel="canonical" href={chart.canonicalUrl}/>
                <meta property="fb:app_id" content="1149943818390250"/>
                <meta property="og:url" content={chart.canonicalUrl}/>
                <meta property="og:title" content={chart.title}/>
                <meta property="og:description" content={chart.description}/>
                <meta property="og:image" content={chart.imageUrl}/>
                <meta property="og:image:width" content="1080"/>
                <meta property="og:image:height" content="720"/>
                <meta property="og:site_name" content="Our World in Data"/>
                <meta name="twitter:card" content="summary_large_image"/>
                <meta name="twitter:site" content="@MaxCRoser"/>
                <meta name="twitter:creator" content="@MaxCRoser"/>
                <meta name="twitter:title" content={chart.title}/>
                <meta name="twitter:description" content={chart.description}/>
                <meta name="twitter:image" content={chart.imageUrl}/>
                {/*<style>
                    html, body {
                        height: 100%;
                        margin: 0;
                    }

                    figure[data-grapher-src] {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        width: 100%;
                        height: 100%;
                    }
                </style>*/}
                <script src={`${props.baseUrl}/embedCharts.js`}></script>
            </head>
            <body className="singleChart">
                <figure data-grapher-src={chart.canonicalUrl}></figure>
            </body>
        </html>
    }
}

console.log(ReactDOMServer.renderToStaticMarkup(<ChartPage chart={{title: "foo"}}/>))
