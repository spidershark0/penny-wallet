# Changelog

All notable changes to PennyWallet will be documented in this file.

## [0.0.10] - 2026-05-03

### Added
- **Refund as negative expense** — new「這是退款」toggle in the expense form saves the transaction with a negative amount; refunds render as a lighter green `+amount` in the list, distinguishable from regular income at a glance; migration script `scripts/migrate-refund.mjs` converts legacy `transfer credit_card_refund` records to the new format
- **Income wallet selector** — credit card accounts are now excluded from the income wallet picker

### Changed
- **Transaction modal visual refresh** — single accent colour (only Confirm is blue, title / type tabs / Cancel all neutral grey); refund toggle moved to the first field under the type tabs and indented as a sub-option of "expense"; mobile amount hero shows `NT$`-prefixed thousand-separated numbers (muted when empty, full-contrast when typed); mobile top buttons shrunk to 32 × 32 visible / 44 pt touch; tag chip × hit area enlarged via padding without changing visible size
- **Charts** — migrated to Chart.js for more stable rendering and a smaller bundle; pie chart merges small categories into "Others" with tap-to-drill-down; tooltip now shows amount and percentage
- **Transaction list** — action buttons reveal on hover (desktop) / stay visible (mobile) for a cleaner default layout
- **Shared styling** — unified CSS colour tokens; refactored shared `Card` and `Metric` components

### Fixed
- **Modal polish** — removed stray outer border inherited from Obsidian theme; restored checkbox appearance so it renders correctly across themes; added consistent separator lines between field rows; suppressed Obsidian's purple focus outline on type tabs

### Removed
- **Legacy refund category** — `credit_card_refund` transfer category removed (replaced by the negative-expense format above)

## [0.0.9] - 2026-04-17

### Added
- Data validation: detects malformed transaction rows and surfaces errors in the UI

### Fixed
- Mobile tag dropdown on iOS no longer triggers the system keyboard; uses native tap-to-select flow instead

## [0.0.8] - 2026-04-16

### Added
- Tags field on each transaction for flexible labeling and filtering

## [0.0.7] - 2026-04-14

### Changed
- Merged `repayment` transaction type into `transfer` — existing repayments are read as `transfer` with category `credit_card_payment`
- Renamed transfer type label from 「轉帳」to 「移轉」(zh) / "Transfer" (en)
- `translateCategory`: empty, `-`, and `other` values now display as 「未分類」/ "Uncategorized" instead of a dash
- Category defaults are now always normalized on config load (`normalizeOptions`), ignoring stale stored defaults

### Added
- Expanded default expense categories: `clothing`, `education`, `cash_expense`, `insurance`, `fees`, `tax`
- Expanded default income categories: `interest`, `lottery`, `rent`, `cashback`, `dividend`, `investment_profit`, `insurance_income`, `pension`
- Default transfer categories: `account_transfer`, `credit_card_payment`, `credit_card_refund`, `investment_trade`
- Custom transfer categories section in Settings
- `scripts/migrate-categories.mjs` — migrates old ledger rows (`repayment`→`transfer`, `other`→`-`) and `.penny-wallet.json` config to the new schema

### Fixed
- `credit_card_refund` balance calculation now correctly adjusts only the single credit card wallet (not double-counted)
- `credit_card_payment` balance calculation now decreases both bank (from) and credit card debt (to)

## [0.0.6] - 2026-04-11

### Changed
- Dashboard and Asset views now use a 2-column grid layout for better use of screen space.

## [0.0.5] - 2026-04-10

### Added
- Add click-through from income and expense pie charts to the Transactions view with related filters.
- Add drag-and-drop wallet reordering in Settings (SortableJS) and improve settings/detail UX.

### Fixed
- Wallet balance ordering now follows the configured wallet order.
- Fix mobile numpad tap feedback on iOS

## [0.0.4] - 2026-04-09

### Changed
- Replace Finance Trends view with the new Asset view.
- Update related dashboard/chart rendering and styling for the new view flow.

### Fixed
- Stabilize UI tests for the updated view behavior.

## [0.0.3] - 2026-04-08

### Fixed
- Prevent iOS dashboard navigation buttons from wrapping in longer locales.
- Improve archived wallet settings UX.

## [0.0.2] - 2026-04-08

### Added
- `createdAt` field on each transaction for stable same-date ordering
- Transactions on the same date now sort by creation time (newest first)

### Fixed
- iOS touch event handling and lint issues
- Mobile detail view now shows correct wallet name

## [0.0.1] - 2026-04-06

### Added
- Initial release
- Finance Overview with monthly income / expense summary, account balances, net asset, asset allocation pie chart, and category pie charts (legends show name, amount, and percentage)
- Transactions view with multi-select type filter, category checklist dropdown, keyword search on notes, sticky subtotals, inline edit and delete
- Finance Trends view with 3 / 6 / 12-month income/expense bar chart, category trend line chart, net asset line chart, and per-account balance trend
- Multiple account types: cash, bank, credit card (with debt tracking)
- Custom expense and income categories
- Credit card repayment workflow with automatic debt calculation
- iOS Shortcuts support via `obsidian://penny-wallet` URI handler
- Bilingual support: English and Traditional Chinese
- Plain Markdown storage — one file per month, compatible with Git sync and Dataview
- Config stored as `.penny-wallet.json` at vault root
