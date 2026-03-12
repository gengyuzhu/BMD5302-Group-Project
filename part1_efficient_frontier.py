from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.ticker import PercentFormatter
from scipy.optimize import minimize


PROJECT_DIR = Path(r"E:\2025 NUS\BMD5302\Bmd5301_Project")
FUNDS_DIR = PROJECT_DIR / "funds"
OUTPUT_DIR = PROJECT_DIR / "part1_outputs"
ANNUALIZATION_FACTOR = 12


@dataclass(frozen=True)
class FundSpec:
    index: int
    file_name: str
    display_name: str
    short_name: str
    price_column: str
    date_parser: Callable[[pd.Series], pd.Series]
    date_format_label: str


def parse_mm_dd_yyyy(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, format="%m/%d/%Y", errors="raise")


def parse_yy_mon(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, format="%y-%b", errors="raise")


def parse_mon_yy(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, format="%b %y", errors="raise")


def parse_d_mon_yy(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, format="%d-%b-%y", errors="raise")


FUND_SPECS = [
    FundSpec(
        1,
        "1 Nikko AM Singapore STI ETF Stock Price History.csv",
        "Nikko AM Singapore STI ETF",
        "Nikko STI ETF",
        "Price",
        parse_mm_dd_yyyy,
        "MM/DD/YYYY",
    ),
    FundSpec(
        2,
        "2 Lion-OCBC Hang Seng TECH ETFStock Price History.csv",
        "Lion-OCBC Hang Seng TECH ETF",
        "Lion-OCBC HSTECH ETF",
        "Price",
        parse_mm_dd_yyyy,
        "MM/DD/YYYY",
    ),
    FundSpec(
        3,
        "3 ABF SG Bond Index FundPrice History.csv",
        "ABF SG Bond Index Fund",
        "ABF SG Bond",
        "Price",
        parse_mm_dd_yyyy,
        "MM/DD/YYYY",
    ),
    FundSpec(
        4,
        "4 Fidelity Global Technology A-ACC-USD Historical Data.csv",
        "Fidelity Global Technology A-ACC-USD",
        "Fidelity Global Tech",
        "Price",
        parse_yy_mon,
        "YY-Mon",
    ),
    FundSpec(
        5,
        "5 PIMCO Income Fund Cl E Inc SGD-H Historical Data.csv",
        "PIMCO Income Fund Cl E Inc SGD-H",
        "PIMCO Income SGD-H",
        "Price",
        parse_mon_yy,
        "Mon YY",
    ),
    FundSpec(
        6,
        "6 JPMorgan US Technology A (acc) SGD Historical Data.csv",
        "JPMorgan US Technology A (acc) SGD",
        "JPM US Tech SGD",
        "Close",
        parse_d_mon_yy,
        "D-Mon-YY",
    ),
    FundSpec(
        7,
        "7 Schroder Asian Growth A Dis SGD Historical Data.csv",
        "Schroder Asian Growth A Dis SGD",
        "Schroder Asian Growth",
        "Price",
        parse_yy_mon,
        "YY-Mon",
    ),
    FundSpec(
        8,
        "8 BlackRock World Gold Fund A2 SGD-H Historical Data.csv",
        "BlackRock World Gold Fund A2 SGD-H",
        "BlackRock World Gold",
        "Close",
        parse_d_mon_yy,
        "D-Mon-YY",
    ),
    FundSpec(
        9,
        "9 FTIF - Franklin India A (acc) SGD Historical Data.csv",
        "FTIF - Franklin India A (acc) SGD",
        "Franklin India SGD",
        "Close",
        parse_d_mon_yy,
        "D-Mon-YY",
    ),
    FundSpec(
        10,
        "10 United SGD Fund - Class A SGD Acc Historical Data.csv",
        "United SGD Fund - Class A SGD Acc",
        "United SGD Fund",
        "Price",
        parse_yy_mon,
        "YY-Mon",
    ),
]


def clean_numeric(series: pd.Series) -> pd.Series:
    text = series.astype(str).str.replace(",", "", regex=False).str.strip()
    text = text.replace({"-": np.nan, "nan": np.nan, "None": np.nan})
    return pd.to_numeric(text, errors="coerce")


def load_fund(spec: FundSpec) -> tuple[pd.Series, dict]:
    path = FUNDS_DIR / spec.file_name
    raw = pd.read_csv(path)
    dates = spec.date_parser(raw["Date"])
    periods = dates.dt.to_period("M")
    prices = clean_numeric(raw[spec.price_column])

    series = (
        pd.DataFrame({"period": periods, "price": prices})
        .dropna()
        .drop_duplicates(subset="period", keep="first")
        .sort_values("period")
        .set_index("period")["price"]
    )
    series.name = spec.short_name

    metadata = {
        "index": spec.index,
        "display_name": spec.display_name,
        "short_name": spec.short_name,
        "source_file": spec.file_name,
        "date_format": spec.date_format_label,
        "price_column": spec.price_column,
        "raw_rows": int(len(raw)),
        "usable_rows": int(series.shape[0]),
        "raw_start": str(series.index.min()),
        "raw_end": str(series.index.max()),
    }
    return series, metadata


def annualize_returns(monthly_returns: pd.Series) -> pd.Series:
    return monthly_returns * ANNUALIZATION_FACTOR


def annualize_covariance(monthly_covariance: pd.DataFrame) -> pd.DataFrame:
    return monthly_covariance * ANNUALIZATION_FACTOR


def portfolio_return(weights: np.ndarray, mean_returns: np.ndarray) -> float:
    return float(weights @ mean_returns)


def portfolio_variance(weights: np.ndarray, covariance: np.ndarray) -> float:
    return float(weights @ covariance @ weights)


def analytical_frontier(
    mean_returns: pd.Series,
    covariance: pd.DataFrame,
    target_returns: np.ndarray,
) -> tuple[pd.DataFrame, dict]:
    mu = mean_returns.values
    sigma = covariance.values
    sigma_inv = np.linalg.inv(sigma)
    ones = np.ones(len(mu))

    a = float(ones @ sigma_inv @ ones)
    b = float(ones @ sigma_inv @ mu)
    c = float(mu @ sigma_inv @ mu)
    d = a * c - b**2

    points = []
    for target in target_returns:
        weights = sigma_inv @ (((c - b * target) / d) * ones + ((a * target - b) / d) * mu)
        risk = np.sqrt(portfolio_variance(weights, sigma))
        points.append(
            {
                "target_return": float(target),
                "return": float(target),
                "risk": float(risk),
                "weights": {name: float(weight) for name, weight in zip(mean_returns.index, weights)},
            }
        )

    gmvp_weights = sigma_inv @ ones / a
    gmvp_return = float(gmvp_weights @ mu)
    gmvp_risk = float(np.sqrt(portfolio_variance(gmvp_weights, sigma)))
    gmvp = {
        "return": gmvp_return,
        "risk": gmvp_risk,
        "weights": {name: float(weight) for name, weight in zip(mean_returns.index, gmvp_weights)},
    }

    return pd.DataFrame(points), gmvp


def optimize_portfolio(
    mean_returns: pd.Series,
    covariance: pd.DataFrame,
    allow_short: bool,
    target_return: float | None = None,
) -> np.ndarray:
    mu = mean_returns.values
    sigma = covariance.values
    n_assets = len(mu)
    x0 = np.repeat(1 / n_assets, n_assets)
    bounds = None if allow_short else [(0.0, 1.0)] * n_assets

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    if target_return is not None:
        constraints.append({"type": "eq", "fun": lambda w, t=target_return: w @ mu - t})

    result = minimize(
        lambda w: portfolio_variance(w, sigma),
        x0=x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-12, "maxiter": 500},
    )

    if not result.success:
        raise RuntimeError(f"Optimization failed for target return {target_return}: {result.message}")
    return result.x


def long_only_frontier(
    mean_returns: pd.Series,
    covariance: pd.DataFrame,
    target_returns: np.ndarray,
) -> tuple[pd.DataFrame, dict]:
    gmvp_weights = optimize_portfolio(mean_returns, covariance, allow_short=False)
    gmvp = {
        "return": portfolio_return(gmvp_weights, mean_returns.values),
        "risk": np.sqrt(portfolio_variance(gmvp_weights, covariance.values)),
        "weights": {name: float(weight) for name, weight in zip(mean_returns.index, gmvp_weights)},
    }

    points = []
    for target in target_returns:
        weights = optimize_portfolio(mean_returns, covariance, allow_short=False, target_return=float(target))
        points.append(
            {
                "target_return": float(target),
                "return": portfolio_return(weights, mean_returns.values),
                "risk": float(np.sqrt(portfolio_variance(weights, covariance.values))),
                "weights": {name: float(weight) for name, weight in zip(mean_returns.index, weights)},
            }
        )

    return pd.DataFrame(points), gmvp


def format_weight_table(weight_dict: dict[str, float]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Fund": list(weight_dict.keys()),
            "Weight": list(weight_dict.values()),
        }
    )


def save_plot(
    destination: Path,
    title: str,
    assets: pd.DataFrame,
    frontier_sets: list[tuple[str, pd.DataFrame, str, str]],
    gmvp_points: list[tuple[str, dict, str]],
    fund_specs: list[FundSpec],
) -> None:
    fig, ax = plt.subplots(figsize=(14, 8))
    plt.subplots_adjust(right=0.76)

    ax.scatter(
        assets["annual_volatility"],
        assets["annual_return"],
        color="#f28e2b",
        s=80,
        label="Individual Funds",
        zorder=4,
    )
    for _, row in assets.iterrows():
        ax.annotate(
            str(int(row["fund_index"])),
            (row["annual_volatility"], row["annual_return"]),
            textcoords="offset points",
            xytext=(5, 5),
            fontsize=9,
            color="#2f2f2f",
            weight="bold",
        )

    for label, frontier, color, linestyle in frontier_sets:
        ax.plot(
            frontier["risk"],
            frontier["return"],
            label=label,
            color=color,
            linewidth=2.5,
            linestyle=linestyle,
            zorder=2,
        )

    for label, gmvp, color in gmvp_points:
        ax.scatter(
            gmvp["risk"],
            gmvp["return"],
            marker="*",
            s=220,
            color=color,
            edgecolors="black",
            linewidth=0.8,
            label=label,
            zorder=5,
        )

    mapping_text = "\n".join(f"{spec.index}. {spec.short_name}" for spec in fund_specs)
    fig.text(
        0.79,
        0.5,
        mapping_text,
        va="center",
        ha="left",
        fontsize=8.5,
        bbox={"boxstyle": "round,pad=0.45", "facecolor": "#fafafa", "edgecolor": "#d0d0d0"},
    )

    ax.set_title(title, fontsize=14, weight="bold")
    ax.set_xlabel("Annualized Volatility")
    ax.set_ylabel("Annualized Expected Return")
    ax.xaxis.set_major_formatter(PercentFormatter(1.0))
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.grid(alpha=0.25)
    ax.legend(frameon=True, loc="lower right")

    fig.savefig(destination, dpi=220, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    price_series = []
    metadata_rows = []
    for spec in FUND_SPECS:
        series, metadata = load_fund(spec)
        price_series.append(series)
        metadata_rows.append(metadata)

    all_prices = pd.concat(price_series, axis=1, join="outer").sort_index()
    common_periods = None
    for series in price_series:
        periods = set(series.index)
        common_periods = periods if common_periods is None else common_periods & periods

    common_index = pd.PeriodIndex(sorted(common_periods), freq="M")
    normalized_prices = all_prices.loc[common_index]
    monthly_returns = normalized_prices.pct_change().dropna()

    monthly_mean = monthly_returns.mean()
    monthly_covariance = monthly_returns.cov()
    annual_mean = annualize_returns(monthly_mean)
    annual_covariance = annualize_covariance(monthly_covariance)

    asset_statistics = pd.DataFrame(
        {
            "fund_index": [spec.index for spec in FUND_SPECS],
            "display_name": [spec.display_name for spec in FUND_SPECS],
            "short_name": [spec.short_name for spec in FUND_SPECS],
            "monthly_average_return": monthly_mean.values,
            "annual_return": annual_mean.values,
            "annual_volatility": np.sqrt(np.diag(annual_covariance.values)),
        }
    )

    short_target_min = float(min(annual_mean.min(), 0.95 * annual_mean.min()) - 0.03)
    short_target_max = float(max(annual_mean.max(), 1.05 * annual_mean.max()) + 0.03)
    short_targets = np.linspace(short_target_min, short_target_max, 250)
    short_frontier, gmvp_short = analytical_frontier(annual_mean, annual_covariance, short_targets)
    short_frontier = (
        short_frontier.loc[short_frontier["return"] >= gmvp_short["return"] - 1e-10]
        .reset_index(drop=True)
    )

    gmvp_long_initial_weights = optimize_portfolio(annual_mean, annual_covariance, allow_short=False)
    gmvp_long_return = portfolio_return(gmvp_long_initial_weights, annual_mean.values)
    long_targets = np.linspace(gmvp_long_return, float(annual_mean.max()), 200)
    long_frontier, gmvp_long = long_only_frontier(annual_mean, annual_covariance, long_targets)

    metadata_frame = pd.DataFrame(metadata_rows)
    metadata_frame["common_sample_start"] = str(common_index.min())
    metadata_frame["common_sample_end"] = str(common_index.max())
    metadata_frame["common_price_observations"] = len(common_index)
    metadata_frame["common_return_observations"] = len(monthly_returns)

    normalized_prices_to_save = normalized_prices.copy()
    normalized_prices_to_save.index = normalized_prices_to_save.index.astype(str)
    normalized_prices_to_save.index.name = "Period"
    normalized_prices_to_save.to_csv(OUTPUT_DIR / "normalized_prices_common_window.csv")

    monthly_returns_to_save = monthly_returns.copy()
    monthly_returns_to_save.index = monthly_returns_to_save.index.astype(str)
    monthly_returns_to_save.index.name = "Period"
    monthly_returns_to_save.to_csv(OUTPUT_DIR / "monthly_returns_common_window.csv")

    metadata_frame.to_csv(OUTPUT_DIR / "fund_metadata.csv", index=False)
    asset_statistics.to_csv(OUTPUT_DIR / "individual_fund_statistics.csv", index=False)
    monthly_mean.rename("monthly_average_return").to_csv(OUTPUT_DIR / "average_returns_monthly.csv", header=True)
    annual_mean.rename("annualized_average_return").to_csv(OUTPUT_DIR / "average_returns_annualized.csv", header=True)
    monthly_covariance.to_csv(OUTPUT_DIR / "covariance_matrix_monthly.csv")
    annual_covariance.to_csv(OUTPUT_DIR / "covariance_matrix_annualized.csv")
    short_frontier.drop(columns=["weights"]).to_csv(OUTPUT_DIR / "frontier_points_short_sales.csv", index=False)
    long_frontier.drop(columns=["weights"]).to_csv(OUTPUT_DIR / "frontier_points_long_only.csv", index=False)
    format_weight_table(gmvp_short["weights"]).to_csv(OUTPUT_DIR / "gmvp_weights_short_sales.csv", index=False)
    format_weight_table(gmvp_long["weights"]).to_csv(OUTPUT_DIR / "gmvp_weights_long_only.csv", index=False)

    save_plot(
        OUTPUT_DIR / "efficient_frontier_comparison.png",
        "Efficient Frontier Comparison (Annualized, Monthly Data)",
        asset_statistics,
        [
            ("Short Sales Allowed", short_frontier, "#4e79a7", "-"),
            ("Long-Only Frontier", long_frontier, "#59a14f", "--"),
        ],
        [
            ("GMVP (Short Sales Allowed)", gmvp_short, "#e15759"),
            ("GMVP (Long-Only)", gmvp_long, "#9c755f"),
        ],
        FUND_SPECS,
    )
    save_plot(
        OUTPUT_DIR / "efficient_frontier_short_sales.png",
        "Efficient Frontier with Short Sales Allowed",
        asset_statistics,
        [("Short Sales Allowed", short_frontier, "#4e79a7", "-")],
        [("GMVP (Short Sales Allowed)", gmvp_short, "#e15759")],
        FUND_SPECS,
    )
    save_plot(
        OUTPUT_DIR / "efficient_frontier_long_only.png",
        "Efficient Frontier without Short Sales (Long-Only)",
        asset_statistics,
        [("Long-Only Frontier", long_frontier, "#59a14f", "-")],
        [("GMVP (Long-Only)", gmvp_long, "#9c755f")],
        FUND_SPECS,
    )

    summary = {
        "metadata": {
            "sample_start": str(common_index.min()),
            "sample_end": str(common_index.max()),
            "price_observations": len(common_index),
            "return_observations": len(monthly_returns),
            "return_frequency": "monthly",
            "annualization_factor": ANNUALIZATION_FACTOR,
        },
        "funds": [
            {
                "index": int(row["fund_index"]),
                "displayName": row["display_name"],
                "shortName": row["short_name"],
                "monthlyAverageReturn": float(row["monthly_average_return"]),
                "annualReturn": float(row["annual_return"]),
                "annualVolatility": float(row["annual_volatility"]),
            }
            for _, row in asset_statistics.iterrows()
        ],
        "gmvp": {
            "shortSalesAllowed": gmvp_short,
            "longOnly": gmvp_long,
        },
        "frontiers": {
            "shortSalesAllowed": short_frontier.to_dict(orient="records"),
            "longOnly": long_frontier.to_dict(orient="records"),
        },
    }
    with open(OUTPUT_DIR / "efficient_frontier_data.json", "w", encoding="utf-8") as handle:
        json.dump(summary, handle, indent=2)


if __name__ == "__main__":
    main()
