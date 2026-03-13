# Part 1: The Efficient Frontier

## Scope

This report completes Part 1 of the Robot Adviser project using the 10 CSV files in `funds/`.

- Return frequency used: monthly
- Shared sample used for portfolio construction: `2022-03` to `2026-03`
- Price observations in shared sample: `49`
- Monthly return observations in shared sample: `48`
- Frontier inputs used for plotting: annualized expected returns and annualized covariance

The shared window starts in March 2022 because Funds 6, 8, and 9 only contain data from `2022-03` onward. All other funds contain `2021-04` to `2026-03`, but trimming to the common overlap ensures one consistent variance-covariance matrix for all 10 funds.

## Data Audit

| No. | Fund | Source file | Date format | Price field | Raw rows | Raw coverage | Common window used |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| 1 | Nikko AM Singapore STI ETF | `1 Nikko AM Singapore STI ETF Stock Price History.csv` | `MM/DD/YYYY` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |
| 2 | Lion-OCBC Hang Seng TECH ETF | `2 Lion-OCBC Hang Seng TECH ETFStock Price History.csv` | `MM/DD/YYYY` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |
| 3 | ABF SG Bond Index Fund | `3 ABF SG Bond Index FundPrice History.csv` | `MM/DD/YYYY` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |
| 4 | Fidelity Global Technology A-ACC-USD | `4 Fidelity Global Technology A-ACC-USD Historical Data.csv` | `YY-Mon` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |
| 5 | PIMCO Income Fund Cl E Inc SGD-H | `5 PIMCO Income Fund Cl E Inc SGD-H Historical Data.csv` | `Mon YY` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |
| 6 | JPMorgan US Technology A (acc) SGD | `6 JPMorgan US Technology A (acc) SGD Historical Data.csv` | `D-Mon-YY` | `Close` | 49 | `2022-03` to `2026-03` | `2022-03` to `2026-03` |
| 7 | Schroder Asian Growth A Dis SGD | `7 Schroder Asian Growth A Dis SGD Historical Data.csv` | `YY-Mon` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |
| 8 | BlackRock World Gold Fund A2 SGD-H | `8 BlackRock World Gold Fund A2 SGD-H Historical Data.csv` | `D-Mon-YY` | `Close` | 49 | `2022-03` to `2026-03` | `2022-03` to `2026-03` |
| 9 | FTIF - Franklin India A (acc) SGD | `9 FTIF - Franklin India A (acc) SGD Historical Data.csv` | `D-Mon-YY` | `Close` | 49 | `2022-03` to `2026-03` | `2022-03` to `2026-03` |
| 10 | United SGD Fund - Class A SGD Acc | `10 United SGD Fund - Class A SGD Acc Historical Data.csv` | `YY-Mon` | `Price` | 60 | `2021-04` to `2026-03` | `2022-03` to `2026-03` |

## Method

Monthly simple returns were computed from aligned monthly prices:

`r_t = P_t / P_(t-1) - 1`

The average return vector and covariance matrix were estimated from the 48 monthly return observations. For charting the efficient frontier:

- Annualized expected return: `mu_annual = 12 * mean(monthly returns)`
- Annualized covariance: `Sigma_annual = 12 * Cov(monthly returns)`

Two portfolio sets were optimized:

- With short sales: `sum(w) = 1`
- Without short sales: `sum(w) = 1` and `0 <= w_i <= 1`

## Average Return by Fund

| No. | Fund | Monthly average return | Annualized expected return | Annualized volatility |
| --- | --- | ---: | ---: | ---: |
| 1 | Nikko STI ETF | 0.79% | 9.42% | 9.28% |
| 2 | Lion-OCBC HSTECH ETF | 0.60% | 7.16% | 35.32% |
| 3 | ABF SG Bond | 0.09% | 1.03% | 4.77% |
| 4 | Fidelity Global Tech | 1.30% | 15.56% | 16.73% |
| 5 | PIMCO Income SGD-H | -0.28% | -3.36% | 5.62% |
| 6 | JPM US Tech SGD | 1.01% | 12.18% | 26.04% |
| 7 | Schroder Asian Growth | 0.28% | 3.38% | 16.78% |
| 8 | BlackRock World Gold | 2.43% | 29.21% | 33.55% |
| 9 | Franklin India SGD | 0.28% | 3.36% | 12.96% |
| 10 | United SGD Fund | 0.24% | 2.90% | 1.06% |

Key observations:

- Highest annualized expected return: Fund 8, BlackRock World Gold, `29.21%`
- Lowest annualized expected return: Fund 5, PIMCO Income SGD-H, `-3.36%`
- Lowest annualized volatility: Fund 10, United SGD Fund, `1.06%`
- Highest annualized volatility: Fund 2, Lion-OCBC HSTECH ETF, `35.32%`

## Monthly Variance-Covariance Matrix

Funds are labeled `1` to `10` in the same order as above.

```text
           1         2         3         4         5         6         7         8         9        10
1   0.000717  0.001139  0.000151  0.000466  0.000227  0.000273  0.000741  0.001113  0.000187  0.000030
2   0.001139  0.010397  0.000242  0.000961  0.000346 -0.000060  0.003505  0.002897 -0.001040  0.000093
3   0.000151  0.000242  0.000190  0.000288  0.000156  0.000202  0.000194  0.000529  0.000112  0.000029
4   0.000466  0.000961  0.000288  0.002333  0.000562  0.002985  0.001092  0.001192  0.000611  0.000080
5   0.000227  0.000346  0.000156  0.000562  0.000263  0.000461  0.000327  0.000669  0.000184  0.000037
6   0.000273 -0.000060  0.000202  0.002985  0.000461  0.005649  0.000707 -0.000514  0.001234  0.000062
7   0.000741  0.003505  0.000194  0.001092  0.000327  0.000707  0.002347  0.001568 -0.000094  0.000068
8   0.001113  0.002897  0.000529  0.001192  0.000669 -0.000514  0.001568  0.009383 -0.000597  0.000112
9   0.000187 -0.001040  0.000112  0.000611  0.000184  0.001234 -0.000094 -0.000597  0.001400  0.000014
10  0.000030  0.000093  0.000029  0.000080  0.000037  0.000062  0.000068  0.000112  0.000014  0.000009
```

Full-precision matrices are saved in:

- [`part1_outputs/covariance_matrix_monthly.csv`](part1_outputs/covariance_matrix_monthly.csv)
- [`part1_outputs/covariance_matrix_annualized.csv`](part1_outputs/covariance_matrix_annualized.csv)

## Global Minimum Variance Portfolio (GMVP)

### GMVP with Short Sales Allowed

- Expected return: `3.70%`
- Volatility: `0.71%`

| Fund | Weight |
| --- | ---: |
| Nikko STI ETF | 2.34% |
| Lion-OCBC HSTECH ETF | -0.11% |
| ABF SG Bond | -7.53% |
| Fidelity Global Tech | -0.26% |
| PIMCO Income SGD-H | -9.53% |
| JPM US Tech SGD | -0.07% |
| Schroder Asian Growth | -1.56% |
| BlackRock World Gold | -0.16% |
| Franklin India SGD | 0.61% |
| United SGD Fund | 116.28% |

### GMVP without Short Sales

- Expected return: `2.90%`
- Volatility: `1.06%`

| Fund | Weight |
| --- | ---: |
| United SGD Fund | 100.00% |

Interpretation:

- The long-only GMVP collapses to Fund 10 because it has by far the lowest volatility in the shared sample.
- Allowing short sales produces a lower-volatility GMVP by levering Fund 10 and offsetting it with small short positions in higher-volatility funds.

## Efficient Frontier Visualizations

### Comparison Chart

![Efficient Frontier Comparison](part1_outputs/efficient_frontier_comparison.png)

### Separate Charts

- [`part1_outputs/efficient_frontier_short_sales.png`](part1_outputs/efficient_frontier_short_sales.png)
- [`part1_outputs/efficient_frontier_long_only.png`](part1_outputs/efficient_frontier_long_only.png)

Interpretation:

- The long-only frontier begins at the long-only GMVP and curves upward toward higher-return, higher-risk combinations dominated by the gold and technology funds.
- The short-sales frontier is steeper because the optimizer can combine the very low-volatility United SGD Fund with short positions in other funds.
- Individual fund points are labeled `1` to `10` on the plots, and the legend uses the same numbering.

## Files Generated

### Reproducible analysis

- [`part1/part1_efficient_frontier.py`](part1/part1_efficient_frontier.py)
- [`part1/EfficientFrontierInteractive.jsx`](part1/EfficientFrontierInteractive.jsx)

### Core outputs

- [`part1_outputs/fund_metadata.csv`](part1_outputs/fund_metadata.csv)
- [`part1_outputs/normalized_prices_common_window.csv`](part1_outputs/normalized_prices_common_window.csv)
- [`part1_outputs/monthly_returns_common_window.csv`](part1_outputs/monthly_returns_common_window.csv)
- [`part1_outputs/average_returns_monthly.csv`](part1_outputs/average_returns_monthly.csv)
- [`part1_outputs/average_returns_annualized.csv`](part1_outputs/average_returns_annualized.csv)
- [`part1_outputs/individual_fund_statistics.csv`](part1_outputs/individual_fund_statistics.csv)
- [`part1_outputs/gmvp_weights_short_sales.csv`](part1_outputs/gmvp_weights_short_sales.csv)
- [`part1_outputs/gmvp_weights_long_only.csv`](part1_outputs/gmvp_weights_long_only.csv)
- [`part1_outputs/frontier_points_short_sales.csv`](part1_outputs/frontier_points_short_sales.csv)
- [`part1_outputs/frontier_points_long_only.csv`](part1_outputs/frontier_points_long_only.csv)
- [`part1_outputs/efficient_frontier_data.json`](part1_outputs/efficient_frontier_data.json)

## Note on the Interactive Part 1 Interface

`part1/EfficientFrontierInteractive.jsx` is the current web implementation of Part 1. It reads:

- `part1_outputs/efficient_frontier_data.json`
- `part1_outputs/covariance_matrix_annualized.csv`

The interface now mirrors the analytical workflow used in this report:

- view switch between the combined frontier, short-sales-only view, and long-only view
- hover tooltips for individual funds, both GMVPs, and the currently selected frontier point
- a `Frontier position` summary row that shows where the selected portfolio sits on the active frontier
- a `Portfolio Inspector` module placed directly below the frontier-position summary, with:
  - long-only vs short-sales mode toggle
  - slider-based frontier navigation
  - live target return, expected return, and volatility cards
  - an automatically refreshed weight table for the selected point
- a `Frontier Analytics` section at the bottom of the page with three tabs:
  - `Annualized Fund Statistics (48 months real data)`
  - `Correlation Matrix (Annualized, 48 months)`
  - `Variance-Covariance Matrix (Annualized)`

The analytics section adds the following website features on top of the static PNG figures:

- sortable fund statistics table
- search/filter by fund name, short name, or ticker
- hover tooltips for correlation and covariance matrix cells
- direct comparison of annualized return, volatility, Sharpe ratio, correlation, and covariance inside one page

This keeps the website fully aligned with the same dataset, annualization rules, and optimization outputs documented in the report.
