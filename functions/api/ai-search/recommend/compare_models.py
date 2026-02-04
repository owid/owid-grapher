#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "click",
#     "httpx",
#     "rich",
# ]
# ///
"""
Compare AI search recommend endpoint across models and search modes.

Usage:
    ./compare_models.py "query1" "query2" ...
    ./compare_models.py --models llama3.1,openai "climate change"
    ./compare_models.py --search keyword,semantic "what causes cancer"
"""

import asyncio
import urllib.parse
from dataclasses import dataclass

import click
import httpx
from rich.console import Console
from rich.table import Table

console = Console()

DEFAULT_MODELS = ["llama3.1", "openai"]
DEFAULT_SEARCH_MODES = ["keyword"]
BASE_URL = "http://localhost:8788/api/ai-search/recommend"


@dataclass
class Result:
    query: str
    model: str
    search_mode: str
    timing_ms: int
    keywords: list[str]
    recommendations: list[str]
    error: str | None = None


async def fetch_recommendation(
    client: httpx.AsyncClient,
    query: str,
    model: str,
    search_mode: str,
) -> Result:
    """Fetch a single recommendation from the API."""
    encoded_query = urllib.parse.quote(query)
    url = f"{BASE_URL}?q={encoded_query}&model={model}&search={search_mode}"

    try:
        response = await client.get(url, timeout=120.0)
        data = response.json()

        if "error" in data:
            return Result(
                query=query,
                model=model,
                search_mode=search_mode,
                timing_ms=0,
                keywords=[],
                recommendations=[],
                error=data.get("error", "Unknown error"),
            )

        return Result(
            query=query,
            model=model,
            search_mode=search_mode,
            timing_ms=data.get("timing", {}).get("agent_ms", 0),
            keywords=data.get("searchQueries", []),
            recommendations=[r.get("title", "") for r in data.get("recommendations", [])],
        )
    except Exception as e:
        return Result(
            query=query,
            model=model,
            search_mode=search_mode,
            timing_ms=0,
            keywords=[],
            recommendations=[],
            error=str(e),
        )


async def run_comparisons(
    queries: list[str],
    models: list[str],
    search_modes: list[str],
) -> list[Result]:
    """Run all comparisons in parallel."""
    async with httpx.AsyncClient() as client:
        tasks = [
            fetch_recommendation(client, query, model, search_mode)
            for query in queries
            for model in models
            for search_mode in search_modes
        ]
        return await asyncio.gather(*tasks)


def display_results(results: list[Result], queries: list[str]) -> None:
    """Display results in a formatted table."""
    for query in queries:
        query_results = [r for r in results if r.query == query]

        console.print(f"\n[bold cyan]Query: {query}[/bold cyan]")

        table = Table(show_header=True, header_style="bold")
        table.add_column("Model")
        table.add_column("Search")
        table.add_column("Time", justify="right")
        table.add_column("Keywords/Query")
        table.add_column("Recommendations")

        for r in sorted(query_results, key=lambda x: (x.search_mode, x.timing_ms)):
            if r.error:
                table.add_row(
                    r.model,
                    r.search_mode,
                    "[red]ERROR[/red]",
                    "",
                    f"[red]{r.error}[/red]",
                )
            else:
                # Truncate keywords display
                keywords_display = ", ".join(r.keywords[:5])
                if len(r.keywords) > 5:
                    keywords_display += f" (+{len(r.keywords) - 5})"

                # Truncate recommendations display
                recs_display = "\n".join(r.recommendations[:3])
                if len(r.recommendations) > 3:
                    recs_display += f"\n(+{len(r.recommendations) - 3} more)"

                table.add_row(
                    r.model,
                    r.search_mode,
                    f"{r.timing_ms:,}ms",
                    keywords_display,
                    recs_display,
                )

        console.print(table)


@click.command()
@click.argument("queries", nargs=-1, required=True)
@click.option(
    "--models",
    "-m",
    default=",".join(DEFAULT_MODELS),
    help="Comma-separated list of models to compare",
)
@click.option(
    "--search",
    "-s",
    default=",".join(DEFAULT_SEARCH_MODES),
    help="Comma-separated list of search modes (keyword, semantic)",
)
@click.option(
    "--base-url",
    "-u",
    default=BASE_URL,
    help="Base URL for the API",
)
def main(queries: tuple[str, ...], models: str, search: str, base_url: str) -> None:
    """Compare AI search recommendations across models and search modes.

    Examples:
        ./compare_models.py "climate change" "child mortality"
        ./compare_models.py -m llama3.1,openai -s keyword,semantic "what causes cancer"
    """
    global BASE_URL
    BASE_URL = base_url

    model_list = [m.strip() for m in models.split(",")]
    search_list = [s.strip() for s in search.split(",")]
    query_list = list(queries)

    console.print(f"[dim]Models: {model_list}[/dim]")
    console.print(f"[dim]Search modes: {search_list}[/dim]")
    console.print(f"[dim]Queries: {len(query_list)}[/dim]")

    results = asyncio.run(run_comparisons(query_list, model_list, search_list))
    display_results(results, query_list)


if __name__ == "__main__":
    main()
