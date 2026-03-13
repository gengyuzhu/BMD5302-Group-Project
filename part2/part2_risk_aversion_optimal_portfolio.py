from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.ticker import PercentFormatter
from scipy.optimize import minimize


PROJECT_DIR = Path(r"E:\2025 NUS\BMD5302\Bmd5301_Project")
PART2_DIR = PROJECT_DIR / "part2"
OUTPUT_DIR = PROJECT_DIR / "part2_outputs"
PART1_OUTPUT_DIR = PROJECT_DIR / "part1_outputs"
PART1_DIR = PROJECT_DIR / "part1"
A_MIN = 1.0
A_MAX = 10.0


if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))
if str(PART1_DIR) not in sys.path:
    sys.path.insert(0, str(PART1_DIR))


import part1_efficient_frontier as part1  # noqa: E402


QUESTIONNAIRE = [
    {
        "id": "investment_horizon",
        "dimension": "Time horizon",
        "weight": 1,
        "question": "How long can you keep this portfolio invested before you need to use most of the money?",
        "options": [
            {"score": 1, "label": "Less than 1 year"},
            {"score": 2, "label": "1 to 3 years"},
            {"score": 3, "label": "3 to 5 years"},
            {"score": 4, "label": "5 to 10 years"},
            {"score": 5, "label": "More than 10 years"},
        ],
    },
    {
        "id": "income_resilience",
        "dimension": "Financial resilience",
        "weight": 1,
        "question": "How stable are your income and emergency savings today?",
        "options": [
            {"score": 1, "label": "Income is uncertain and emergency savings are limited"},
            {"score": 2, "label": "Some stability, but reserves are still thin"},
            {"score": 3, "label": "Reasonably stable income and a basic cash buffer"},
            {"score": 4, "label": "Stable income and at least 6 months of reserves"},
            {"score": 5, "label": "Very stable income and strong reserves beyond 12 months"},
        ],
    },
    {
        "id": "liquidity_need",
        "dimension": "Liquidity",
        "weight": 1,
        "question": "How likely are you to need part of this portfolio for spending in the next 3 years?",
        "options": [
            {"score": 1, "label": "Very likely"},
            {"score": 2, "label": "Likely"},
            {"score": 3, "label": "Possible but not planned"},
            {"score": 4, "label": "Unlikely"},
            {"score": 5, "label": "Very unlikely"},
        ],
    },
    {
        "id": "loss_tolerance",
        "dimension": "Loss tolerance",
        "weight": 2,
        "question": "What one-year decline would you tolerate before feeling the need to exit the portfolio?",
        "options": [
            {"score": 1, "label": "Less than 5%"},
            {"score": 2, "label": "5% to 10%"},
            {"score": 3, "label": "10% to 20%"},
            {"score": 4, "label": "20% to 30%"},
            {"score": 5, "label": "More than 30%"},
        ],
    },
    {
        "id": "drawdown_reaction",
        "dimension": "Behavior under stress",
        "weight": 2,
        "question": "If markets fall sharply by 20%, what would you most likely do?",
        "options": [
            {"score": 1, "label": "Sell immediately to avoid further loss"},
            {"score": 2, "label": "Sell part of the portfolio"},
            {"score": 3, "label": "Hold and review carefully"},
            {"score": 4, "label": "Stay invested and rebalance if needed"},
            {"score": 5, "label": "Add more capital while prices are lower"},
        ],
    },
    {
        "id": "return_objective",
        "dimension": "Investment objective",
        "weight": 1,
        "question": "Which objective best matches why you are investing?",
        "options": [
            {"score": 1, "label": "Preserve capital with minimal fluctuation"},
            {"score": 2, "label": "Earn income with limited volatility"},
            {"score": 3, "label": "Balance moderate growth and moderate risk"},
            {"score": 4, "label": "Seek long-term growth and accept sizable swings"},
            {"score": 5, "label": "Maximize growth and accept very high volatility"},
        ],
    },
    {
        "id": "investment_experience",
        "dimension": "Investment experience",
        "weight": 1,
        "question": "How experienced are you with diversified investment products such as funds and ETFs?",
        "options": [
            {"score": 1, "label": "No prior investing experience"},
            {"score": 2, "label": "Limited experience"},
            {"score": 3, "label": "Some experience across several products"},
            {"score": 4, "label": "Experienced and comfortable with market volatility"},
            {"score": 5, "label": "Highly experienced and disciplined through market cycles"},
        ],
    },
    {
        "id": "balance_sheet_strength",
        "dimension": "Balance sheet strength",
        "weight": 1,
        "question": "How would you describe your debt burden and other near-term financial obligations?",
        "options": [
            {"score": 1, "label": "High debt or major obligations due soon"},
            {"score": 2, "label": "Noticeable debt burden"},
            {"score": 3, "label": "Manageable debt and obligations"},
            {"score": 4, "label": "Low debt relative to income"},
            {"score": 5, "label": "Very low debt and strong financial flexibility"},
        ],
    },
]


EXAMPLE_INVESTOR_SCORES = {
    "investment_horizon": 4,
    "income_resilience": 4,
    "liquidity_need": 3,
    "loss_tolerance": 3,
    "drawdown_reaction": 3,
    "return_objective": 4,
    "investment_experience": 3,
    "balance_sheet_strength": 4,
}


def ensure_part1_outputs() -> None:
    required = [
        PART1_OUTPUT_DIR / "average_returns_annualized.csv",
        PART1_OUTPUT_DIR / "covariance_matrix_annualized.csv",
        PART1_OUTPUT_DIR / "efficient_frontier_data.json",
        PART1_OUTPUT_DIR / "individual_fund_statistics.csv",
    ]
    if any(not path.exists() for path in required):
        part1.main()


def load_part1_inputs() -> tuple[pd.Series, pd.DataFrame, dict, pd.DataFrame]:
    annual_mean = pd.read_csv(
        PART1_OUTPUT_DIR / "average_returns_annualized.csv",
        index_col=0,
    ).iloc[:, 0]
    annual_covariance = pd.read_csv(
        PART1_OUTPUT_DIR / "covariance_matrix_annualized.csv",
        index_col=0,
    )
    with open(PART1_OUTPUT_DIR / "efficient_frontier_data.json", "r", encoding="utf-8") as handle:
        frontier_data = json.load(handle)
    asset_statistics = pd.read_csv(PART1_OUTPUT_DIR / "individual_fund_statistics.csv")
    return annual_mean, annual_covariance, frontier_data, asset_statistics


def questionnaire_bounds(questionnaire: list[dict]) -> tuple[float, float]:
    min_score = sum(question["weight"] * 1 for question in questionnaire)
    max_score = sum(question["weight"] * 5 for question in questionnaire)
    return float(min_score), float(max_score)


def score_questionnaire(scores: dict[str, int], questionnaire: list[dict]) -> dict:
    min_score, max_score = questionnaire_bounds(questionnaire)
    weighted_score = 0.0
    detailed_rows = []
    for question in questionnaire:
        selected_score = int(scores[question["id"]])
        selected_option = next(option for option in question["options"] if option["score"] == selected_score)
        contribution = question["weight"] * selected_score
        weighted_score += contribution
        detailed_rows.append(
            {
                "id": question["id"],
                "dimension": question["dimension"],
                "weight": question["weight"],
                "selected_score": selected_score,
                "selected_label": selected_option["label"],
                "weighted_contribution": contribution,
            }
        )

    tolerance_score = (weighted_score - min_score) / (max_score - min_score)
    risk_aversion = A_MAX - (A_MAX - A_MIN) * tolerance_score
    return {
        "weighted_score": float(weighted_score),
        "min_score": float(min_score),
        "max_score": float(max_score),
        "risk_tolerance_index": float(tolerance_score),
        "risk_aversion_a": float(risk_aversion),
        "profile_label": risk_profile_label(risk_aversion),
        "details": detailed_rows,
    }


def risk_profile_label(a_value: float) -> str:
    if a_value >= 7.5:
        return "Conservative"
    if a_value >= 5.0:
        return "Moderately Conservative"
    if a_value >= 3.0:
        return "Moderate Growth"
    return "Aggressive Growth"


def portfolio_metrics(weights: np.ndarray, mean_returns: pd.Series, covariance: pd.DataFrame, a_value: float) -> dict:
    mu = mean_returns.values
    sigma = covariance.values
    expected_return = float(weights @ mu)
    variance = float(weights @ sigma @ weights)
    risk = float(np.sqrt(variance))
    utility = float(expected_return - 0.5 * a_value * variance)
    return {
        "expected_return": expected_return,
        "variance": variance,
        "risk": risk,
        "utility": utility,
    }


def optimize_utility(
    mean_returns: pd.Series,
    covariance: pd.DataFrame,
    a_value: float,
    allow_short: bool,
) -> np.ndarray:
    mu = mean_returns.values
    sigma = covariance.values
    n_assets = len(mu)
    x0 = np.repeat(1 / n_assets, n_assets)
    bounds = None if allow_short else [(0.0, 1.0)] * n_assets
    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    result = minimize(
        lambda w: -(float(w @ mu) - 0.5 * a_value * float(w @ sigma @ w)),
        x0=x0,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-12, "maxiter": 600},
    )
    if not result.success:
        raise RuntimeError(f"Optimization failed for A={a_value}, allow_short={allow_short}: {result.message}")
    return result.x


def build_portfolio_record(
    a_value: float,
    weights: np.ndarray,
    mean_returns: pd.Series,
    covariance: pd.DataFrame,
) -> dict:
    metrics = portfolio_metrics(weights, mean_returns, covariance, a_value)
    return {
        "risk_aversion_a": float(a_value),
        "profile_label": risk_profile_label(a_value),
        "expected_return": metrics["expected_return"],
        "variance": metrics["variance"],
        "risk": metrics["risk"],
        "utility": metrics["utility"],
        "weights": {name: float(weight) for name, weight in zip(mean_returns.index, weights)},
    }


def to_summary_frame(records: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "risk_aversion_a": record["risk_aversion_a"],
                "profile_label": record["profile_label"],
                "expected_return": record["expected_return"],
                "variance": record["variance"],
                "risk": record["risk"],
                "utility": record["utility"],
            }
            for record in records
        ]
    )


def weights_to_frame(weights: dict[str, float], asset_statistics: pd.DataFrame) -> pd.DataFrame:
    mapping = asset_statistics.set_index("short_name")[["fund_index", "display_name"]]
    frame = pd.DataFrame({"short_name": list(weights.keys()), "weight": list(weights.values())})
    frame = frame.join(mapping, on="short_name")
    return frame[["fund_index", "display_name", "short_name", "weight"]].sort_values("fund_index")


def save_questionnaire_csv(questionnaire: list[dict], destination: Path) -> None:
    rows = []
    for question in questionnaire:
        for option in question["options"]:
            rows.append(
                {
                    "question_id": question["id"],
                    "dimension": question["dimension"],
                    "weight": question["weight"],
                    "question": question["question"],
                    "score": option["score"],
                    "option_label": option["label"],
                }
            )
    pd.DataFrame(rows).to_csv(destination, index=False)


def plot_frontier_with_utility(
    destination: Path,
    frontier_data: dict,
    asset_statistics: pd.DataFrame,
    long_record: dict,
    short_record: dict,
    a_value: float,
) -> None:
    short_frontier = pd.DataFrame(frontier_data["frontiers"]["shortSalesAllowed"])
    long_frontier = pd.DataFrame(frontier_data["frontiers"]["longOnly"])

    fig, axes = plt.subplots(1, 2, figsize=(15.5, 7.8))

    retail_x_max = max(asset_statistics["annual_volatility"].max(), long_frontier["risk"].max()) + 0.02
    retail_y_max = max(asset_statistics["annual_return"].max(), long_frontier["return"].max(), long_record["expected_return"]) + 0.04

    for ax in axes:
        ax.scatter(
            asset_statistics["annual_volatility"],
            asset_statistics["annual_return"],
            s=68,
            color="#d58526",
            label="Individual Funds",
            zorder=3,
        )
        for _, row in asset_statistics.iterrows():
            ax.annotate(
                str(int(row["fund_index"])),
                (row["annual_volatility"], row["annual_return"]),
                textcoords="offset points",
                xytext=(5, 5),
                fontsize=8.5,
                weight="bold",
            )

        ax.plot(short_frontier["risk"], short_frontier["return"], color="#376da3", linewidth=2.4, label="Short-sales frontier")
        ax.plot(long_frontier["risk"], long_frontier["return"], color="#5a9d47", linewidth=2.4, linestyle="--", label="Long-only frontier")
        ax.scatter(
            long_record["risk"],
            long_record["expected_return"],
            marker="*",
            s=240,
            color="#8f6846",
            edgecolors="black",
            linewidth=0.8,
            label=f"Recommended long-only optimum (A={a_value:.2f})",
            zorder=4,
        )
        ax.xaxis.set_major_formatter(PercentFormatter(1.0))
        ax.yaxis.set_major_formatter(PercentFormatter(1.0))
        ax.grid(alpha=0.25)
        ax.set_xlabel("Annualized Volatility")

    axes[0].set_title("Retail-scale view", fontsize=13, weight="bold")
    axes[0].set_ylabel("Annualized Expected Return")
    axes[0].set_xlim(0.0, retail_x_max)
    axes[0].set_ylim(min(asset_statistics["annual_return"].min(), 0.0) - 0.05, retail_y_max)

    sigma_grid_retail = np.linspace(0.0, retail_x_max, 240)
    long_utility_curve = long_record["utility"] + 0.5 * a_value * sigma_grid_retail**2
    axes[0].plot(sigma_grid_retail, long_utility_curve, color="#8f6846", linewidth=1.5, alpha=0.75, linestyle=":")

    axes[1].set_title("Full theoretical view", fontsize=13, weight="bold")
    axes[1].set_xlim(0.0, max(short_record["risk"], short_frontier["risk"].max(), asset_statistics["annual_volatility"].max()) + 0.05)
    axes[1].set_ylim(min(asset_statistics["annual_return"].min(), 0.0) - 0.05, short_record["expected_return"] + 0.2)
    axes[1].scatter(
        short_record["risk"],
        short_record["expected_return"],
        marker="*",
        s=240,
        color="#cc3f5c",
        edgecolors="black",
        linewidth=0.8,
        label=f"Theoretical short-sales optimum (A={a_value:.2f})",
        zorder=4,
    )
    sigma_grid_full = np.linspace(0.0, axes[1].get_xlim()[1], 320)
    short_utility_curve = short_record["utility"] + 0.5 * a_value * sigma_grid_full**2
    axes[1].plot(sigma_grid_full, short_utility_curve, color="#cc3f5c", linewidth=1.5, alpha=0.75, linestyle=":")

    handles, labels = axes[1].get_legend_handles_labels()
    fig.legend(handles, labels, loc="lower center", ncol=3, frameon=True, bbox_to_anchor=(0.5, -0.01))
    fig.suptitle("Utility Maximization on the Efficient Frontier", fontsize=15, weight="bold")
    fig.savefig(destination, dpi=220, bbox_inches="tight")
    plt.close(fig)


def plot_portfolios_vs_risk_aversion(destination: Path, long_df: pd.DataFrame, short_df: pd.DataFrame) -> None:
    fig, axes = plt.subplots(3, 1, figsize=(12.5, 12), sharex=True)

    axes[0].plot(long_df["risk_aversion_a"], long_df["expected_return"], color="#5a9d47", linewidth=2.3, label="Long-only")
    axes[0].plot(short_df["risk_aversion_a"], short_df["expected_return"], color="#376da3", linewidth=2.3, label="Short sales")
    axes[0].set_ylabel("Expected Return")
    axes[0].yaxis.set_major_formatter(PercentFormatter(1.0))
    axes[0].grid(alpha=0.25)
    axes[0].legend()

    axes[1].plot(long_df["risk_aversion_a"], long_df["risk"], color="#5a9d47", linewidth=2.3)
    axes[1].plot(short_df["risk_aversion_a"], short_df["risk"], color="#376da3", linewidth=2.3)
    axes[1].set_ylabel("Volatility")
    axes[1].yaxis.set_major_formatter(PercentFormatter(1.0))
    axes[1].grid(alpha=0.25)

    axes[2].plot(long_df["risk_aversion_a"], long_df["utility"], color="#5a9d47", linewidth=2.3)
    axes[2].plot(short_df["risk_aversion_a"], short_df["utility"], color="#376da3", linewidth=2.3)
    axes[2].set_ylabel("Utility")
    axes[2].set_xlabel("Risk Aversion (A)")
    axes[2].grid(alpha=0.25)

    fig.suptitle("How the Optimal Portfolio Changes with Risk Aversion", fontsize=15, weight="bold")
    fig.savefig(destination, dpi=220, bbox_inches="tight")
    plt.close(fig)


def plot_weight_comparison(destination: Path, long_record: dict, short_record: dict, asset_statistics: pd.DataFrame) -> None:
    ordered_names = asset_statistics.sort_values("fund_index")["short_name"].tolist()
    long_weights = [long_record["weights"][name] for name in ordered_names]
    short_weights = [short_record["weights"][name] for name in ordered_names]
    labels = asset_statistics.sort_values("fund_index")["fund_index"].astype(str).tolist()

    x = np.arange(len(labels))
    width = 0.38

    fig, ax = plt.subplots(figsize=(13, 6.8))
    ax.bar(x - width / 2, long_weights, width=width, color="#8f6846", label="Recommended long-only")
    ax.bar(x + width / 2, short_weights, width=width, color="#376da3", label="Short-sales benchmark")
    ax.axhline(0, color="#222222", linewidth=0.8)
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.set_xlabel("Fund Number")
    ax.set_ylabel("Portfolio Weight")
    ax.set_title("Example Investor: Portfolio Weights by Constraint Set", fontsize=14, weight="bold")
    ax.grid(axis="y", alpha=0.25)
    ax.legend()

    mapping_text = "\n".join(
        f"{int(row['fund_index'])}. {row['short_name']}"
        for _, row in asset_statistics.sort_values("fund_index").iterrows()
    )
    fig.text(
        0.84,
        0.5,
        mapping_text,
        va="center",
        ha="left",
        fontsize=8.5,
        bbox={"boxstyle": "round,pad=0.45", "facecolor": "#fafafa", "edgecolor": "#d0d0d0"},
    )
    plt.subplots_adjust(right=0.8)
    fig.savefig(destination, dpi=220, bbox_inches="tight")
    plt.close(fig)


def plot_recommended_long_only_weights(destination: Path, long_record: dict, asset_statistics: pd.DataFrame) -> None:
    frame = weights_to_frame(long_record["weights"], asset_statistics)
    fig, ax = plt.subplots(figsize=(11.5, 6.2))
    bars = ax.bar(frame["fund_index"].astype(str), frame["weight"], color="#8f6846")
    ax.set_xlabel("Fund Number")
    ax.set_ylabel("Portfolio Weight")
    ax.yaxis.set_major_formatter(PercentFormatter(1.0))
    ax.set_title("Recommended Long-Only Portfolio Weights", fontsize=14, weight="bold")
    ax.grid(axis="y", alpha=0.25)

    for bar, weight in zip(bars, frame["weight"]):
        if abs(weight) > 1e-5:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.01,
                f"{weight * 100:.1f}%",
                ha="center",
                va="bottom",
                fontsize=9,
            )

    mapping_text = "\n".join(
        f"{int(row['fund_index'])}. {row['short_name']}"
        for _, row in frame.iterrows()
    )
    fig.text(
        0.82,
        0.5,
        mapping_text,
        va="center",
        ha="left",
        fontsize=8.5,
        bbox={"boxstyle": "round,pad=0.45", "facecolor": "#fafafa", "edgecolor": "#d0d0d0"},
    )
    plt.subplots_adjust(right=0.78)
    fig.savefig(destination, dpi=220, bbox_inches="tight")
    plt.close(fig)


def nearest_record(records: list[dict], a_value: float) -> dict:
    return min(records, key=lambda record: abs(record["risk_aversion_a"] - a_value))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ensure_part1_outputs()
    annual_mean, annual_covariance, frontier_data, asset_statistics = load_part1_inputs()

    scoring = score_questionnaire(EXAMPLE_INVESTOR_SCORES, QUESTIONNAIRE)
    example_a = scoring["risk_aversion_a"]

    a_grid = np.round(np.linspace(A_MIN, A_MAX, 181), 2)
    long_records = []
    short_records = []
    for a_value in a_grid:
        long_weights = optimize_utility(annual_mean, annual_covariance, float(a_value), allow_short=False)
        short_weights = optimize_utility(annual_mean, annual_covariance, float(a_value), allow_short=True)
        long_records.append(build_portfolio_record(float(a_value), long_weights, annual_mean, annual_covariance))
        short_records.append(build_portfolio_record(float(a_value), short_weights, annual_mean, annual_covariance))

    long_example = build_portfolio_record(
        example_a,
        optimize_utility(annual_mean, annual_covariance, example_a, allow_short=False),
        annual_mean,
        annual_covariance,
    )
    short_example = build_portfolio_record(
        example_a,
        optimize_utility(annual_mean, annual_covariance, example_a, allow_short=True),
        annual_mean,
        annual_covariance,
    )

    recommended_portfolio = {
        "constraint_set": "long_only",
        "rationale": (
            "The long-only solution is recommended for a retail robo-adviser because it avoids leverage and short-sale implementation complexity, while still maximizing the investor's quadratic utility under realistic retail constraints."
        ),
        "portfolio": long_example,
    }

    questionnaire_json = {
        "aRange": {"min": A_MIN, "max": A_MAX},
        "questionnaire": QUESTIONNAIRE,
        "mappingFormula": {
            "weightedScoreMin": questionnaire_bounds(QUESTIONNAIRE)[0],
            "weightedScoreMax": questionnaire_bounds(QUESTIONNAIRE)[1],
            "riskToleranceIndex": "(weighted_score - min_score) / (max_score - min_score)",
            "riskAversionA": "A = 10 - 9 * risk_tolerance_index",
        },
        "exampleInvestorScores": EXAMPLE_INVESTOR_SCORES,
        "exampleInvestorResult": scoring,
    }

    long_summary = to_summary_frame(long_records)
    short_summary = to_summary_frame(short_records)

    long_summary.to_csv(OUTPUT_DIR / "optimal_portfolios_long_only_summary.csv", index=False)
    short_summary.to_csv(OUTPUT_DIR / "optimal_portfolios_short_sales_summary.csv", index=False)
    weights_to_frame(long_example["weights"], asset_statistics).to_csv(
        OUTPUT_DIR / "example_investor_weights_long_only.csv", index=False
    )
    weights_to_frame(short_example["weights"], asset_statistics).to_csv(
        OUTPUT_DIR / "example_investor_weights_short_sales.csv", index=False
    )
    pd.DataFrame(scoring["details"]).to_csv(OUTPUT_DIR / "example_investor_questionnaire_breakdown.csv", index=False)
    save_questionnaire_csv(QUESTIONNAIRE, OUTPUT_DIR / "questionnaire_definition.csv")

    plot_frontier_with_utility(
        OUTPUT_DIR / "utility_frontier_example.png",
        frontier_data,
        asset_statistics,
        long_example,
        short_example,
        example_a,
    )
    plot_portfolios_vs_risk_aversion(
        OUTPUT_DIR / "optimal_portfolio_vs_risk_aversion.png",
        long_summary,
        short_summary,
    )
    plot_weight_comparison(
        OUTPUT_DIR / "example_investor_weight_comparison.png",
        long_example,
        short_example,
        asset_statistics,
    )
    plot_recommended_long_only_weights(
        OUTPUT_DIR / "recommended_long_only_weights.png",
        long_example,
        asset_statistics,
    )

    comprehensive_payload = {
        "metadata": frontier_data["metadata"],
        "questionnaire": questionnaire_json,
        "funds": frontier_data["funds"],
        "frontiers": frontier_data["frontiers"],
        "optimalPortfolios": {
            "longOnly": long_records,
            "shortSalesAllowed": short_records,
        },
        "exampleInvestor": {
            "scores": EXAMPLE_INVESTOR_SCORES,
            "scoring": scoring,
            "recommendedLongOnly": long_example,
            "benchmarkShortSales": short_example,
        },
        "recommendedPortfolio": recommended_portfolio,
    }

    with open(OUTPUT_DIR / "questionnaire_definition.json", "w", encoding="utf-8") as handle:
        json.dump(questionnaire_json, handle, indent=2)
    with open(OUTPUT_DIR / "optimal_portfolios_long_only_full.json", "w", encoding="utf-8") as handle:
        json.dump(long_records, handle, indent=2)
    with open(OUTPUT_DIR / "optimal_portfolios_short_sales_full.json", "w", encoding="utf-8") as handle:
        json.dump(short_records, handle, indent=2)
    with open(OUTPUT_DIR / "part2_risk_profile_data.json", "w", encoding="utf-8") as handle:
        json.dump(comprehensive_payload, handle, indent=2)


if __name__ == "__main__":
    main()
