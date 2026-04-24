# Business Principles & Model Notes

## Retainer revenue accounting

Retainer contractors carry two separate monthly amounts:

- `monthly_retainer_fee` — Bouw Check's revenue (our fee). Used in all
  commission/revenue rollups (MTD, QTD, YTD, Finance page totals).
- `monthly_ad_budget` — pass-through to Meta Ads. This is the client's
  ad spend, not our income. Never count this as revenue.

When computing retainer contribution to total revenue, always use
`monthly_retainer_fee` only.

## BKC model transition (pending)

Bouwkostencalculatie is currently on retainer (€500 fee + €500 ad budget).
Due to recent deal flow success, this contractor may transition to a
percentage-based commission model.

**When the switch happens:**
1. Update `commission_model` → `'percentage'`
2. Set `commission_rate` to agreed percentage
3. Zero out `monthly_retainer_fee` and `monthly_ad_budget`
4. Stop ad budget pass-through billing
5. Historical retainer billing won't appear in future YTD calcs —
   if continuity is needed, preserve it in a separate `retainer_history`
   table before zeroing the fields

Do not implement until Jasper confirms the model switch.

## Commission state machine

```
lead created          → potential (not tracked until quote captured)
project created       → EARNED, awaiting payout ("Commissie pending")
project, betaald      → PAID ("Commissie MTD/QTD/YTD")
```

Future: once `quote_amount` capture is active for full_sales contractors,
add a "Potentiële commissie" card (weighted pipeline forecast).
Three-card row: MTD (paid) / Pending (earned) / Potential (forecast).

## Canonical stage mapping notes

"Doorgestuurd" on DCN DK board = forwarded to contractor (contacted),
NOT a won deal. Handled via `boards_config.stage_overrides` per board.
Global `STAGE_MAP` does not include this status.

"Inspectie gepland" = inspection stage (between contacted and quote_sent).
Used by Hollands Prefab workflow.
