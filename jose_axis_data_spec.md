# Powerwave equipment data spec for Axis

Handoff notes for moving Powerwave Services equipment and calibration data into Axis.

Prepared for Jose (Software Access) on 19 November 2026.
This document describes the CSV export from the Powerwave tracker and the coding rules needed for a smooth import. It contains no passwords, API keys, or private connection details.

## How to get the files

1. Sign in to the Powerwave tracker.
2. Open the Equipment tab. Click **Export CSV**. That file is the main equipment load for Axis.
3. On the Certs Needed tab, click **Export CSV** if you also want the current certification-work list.
4. Click **Data spec** next to either Export button to download this document.

The equipment export is a UTF-8 CSV (Excel-friendly BOM), with a header row, one row per unit, ISO dates (`YYYY-MM-DD`), and plain ASCII hyphens only (no em or en dashes). It covers the whole owned / assigned lineup shown on Equipment, including PWS, R, I, LEASE, PENDING, and "NO PWS ID" units. It does not include prices, rental rates, invoices, or any other dollar amounts.

Software Access and Admin users can run these exports. Tech users cannot.

## ID conventions

| Kind | Pattern | Meaning |
| --- | --- | --- |
| Powerwave asset ID | `PWS` + 5 digits, for example `PWS00033` | Official Powerwave-owned asset number. This is the preferred primary key once a unit has one. |
| Intellirent R number | `R` + digits, for example `R39007` | Intellirent asset label given when Intellirent sold the unit to Powerwave. Chris Peel (Intellirent) has confirmed that an R number can be reassigned only when the unit comes in for service. The next time that unit is sent in, it should receive a proper PWS asset number. Until then, treat the R number as the working ID. |
| Intellirent I number | `I` + digits, for example `I36937` | Intellirent-owned rental asset. These sometimes appear on the Equipment list when they are in Powerwave's custody or were recently converted. Do not treat an I number as a Powerwave-owned PWS ID. |
| LEASE | literal `LEASE` (two units share this placeholder today) | Leased kit that does not yet have a PWS or R number. Use serial number to distinguish rows. |
| PENDING | literal `PENDING` (several units share this placeholder today) | New or unassigned kit waiting for a PWS number. Use serial number to distinguish rows. |
| NO PWS ID | literal `NO PWS ID` | Temporary key used when a unit was claimed before a PWS number was written into every field. Prefer the PWS number once it appears in notes or is assigned. |

Format rules:

- IDs are uppercase letters plus digits, no spaces.
- PWS numbers are zero-padded to five digits (`PWS00008`, not `PWS8`).
- A unit can move from `I#####` or `R#####` to `PWS#####` after service. Historical notes often record the old ID (`formerly Intellirent I35274`, `was R38701`).
- For Axis, use `pws_id` when present; otherwise use `rental_no`; otherwise use `serial` plus `unit`.

## Status values

The `status` column is the short live status from the tracker:

| Value | Meaning |
| --- | --- |
| `CONFIRMED` | A holder has been confirmed for the unit. |
| `NOT CONFIRMED` | The unit is assigned to a holder, but that assignment has not been confirmed. |
| `MISSING` | The unit cannot currently be accounted for with a confirmed holder. |
| `At Intellirent for cal - ...` | The unit is confirmed and is currently at Intellirent for calibration or service. The remainder of the string is a short note (sent or dropped date, sometimes a service request number such as `SRV01067`). |

The `confirmed` column is a simplified Yes/No for import:

- **Yes** when status is `CONFIRMED`, or status starts with `At Intellirent for cal`.
- **No** when status is `MISSING` or `NOT CONFIRMED`.

The `confirmation` column keeps the longer human-readable confirmation text (who confirmed, when, and how).

## No-cal rules

These models do not require periodic calibration. Last cert dates and PDFs may still exist as history, but they should not be used as a live due date, and the unit should not appear on a "certs needed" or overdue-cal list.

| Model | How to match (case-insensitive substring) | Label | Why |
| --- | --- | --- | --- |
| Doble TR-3170 | `TR-3170` | No cal required | Doble TR-3170 travel transducers do not require calibration (Powerwave, 11 November 2026). |
| Eagle Eye SG Ultra Max | `SG Ultra Max` | No cal required | Intellirent (Matt Sheppard, 12 November 2026) says the SG Ultra Max does not require calibration. |

The equipment export includes `no_cal_required` as Yes or No using the same match. When it is Yes, leave `cal_due` unused for scheduling in Axis, even if a historical date is present.

## Cal tag colors

Powerwave cal tags are tied to the due month, not the color of the physical case.

| Due month | Tag | Color |
| --- | --- | --- |
| January (`JAN`) | JAN | red |
| May (`MAY`) | MAY | blue |
| September (`SEP`) | SEP | green |

Other due months are uncommon in this lineup; if one appears, do not invent a color. The `cal_tag` export column is one of `JAN`, `MAY`, `SEP`, or blank (for example, no-cal or not yet tagged).

## How calibration certificates map to units

Certificate files live in a private `certs/` folder. The tracker field `cert_path` (source: `Cert PDF`) is the path to use:

```
certs/<id>.pdf
```

`<id>` is usually the unit ID (`certs/PWS00033.pdf`, `certs/I36881.pdf`) or, for some leased or unlabeled units, the serial number (`certs/012534092.pdf`).

Rules:

- `has_cert` is Yes when `cert_path` is present, No when it is empty.
- A path of `certs/PWS00033.pdf` is the current filed cert for that unit. Opening it in the tracker uses a signed, time-limited link. The Software Access role can open any `certs/*.pdf` file shown on equipment, and cannot open order PDFs.
- Certificate PDFs themselves are not inside the CSV. Import the path, then attach the matching PDF from the cal-sheet / certs library (Dropbox access is provided separately by Powerwave; this spec does not describe sharing).
- Some notes mention an ETI cert number, ETI control number, or AEMC cert reference. Those values are not stored as their own database columns. They are left blank in `cert_number` and `cal_vendor` so Axis is not loaded with guessed values. You can harvest them later from `notes` or from the Certs Needed `what_is_needed` text when a human reviews them.

Typical vendors mentioned in notes (not a complete or guaranteed list): ETI (Electrical Test Instruments / ETI Precision) and AEMC.

## Equipment CSV field dictionary

File name pattern: `powerwave_equipment_YYYY-MM-DD.csv`.

Required in the table below means "Powerwave expects this to be present for a clean Axis asset record." Rows can still export with blanks. It does not mean every current row is complete.

| Field | Type | Format | Example | Required | Source in the tracker | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| pws_id | text | `PWS` + 5 digits, or blank | `PWS00033` | Yes, once assigned | `Unit` / `Asset` when it matches `PWS#####` | Preferred Axis asset tag. Blank for R, I, LEASE, PENDING, and similar rows. |
| rental_no | text | `R` or `I` + digits, or blank | `R39007` | No | `Unit` / `Asset` when it matches `R#####` or `I#####` | Working ID until a PWS number is assigned. |
| unit | text | Raw unit key | `PWS00033`, `LEASE`, `PENDING` | Yes | `Unit` | Always filled. Use this plus serial when pws_id and rental_no are blank. Two LEASE rows and several PENDING rows can share the same unit key. |
| description | text | Free text | `Doble TDR9000: 1 Accessory Package` | Yes | `Description` | Best human label for the asset. |
| make_model | text | Free text | `TDR9000` | No | `Model` | Shorter make/model string. May be less complete than description. |
| serial | text | Free text, no spaces added | `34305829` | Yes if no stable unit ID | `Serial` | Unique enough to match almost every unit. Required to distinguish shared LEASE / PENDING keys. |
| holder | text | Person, shop, or place name | `Patrick Arreaga` | No | `Holder` | Who currently has the unit, or a shop / yard / Intellirent location. |
| status | text | See Status values | `CONFIRMED` | Yes | `Status` | Short live status. "At Intellirent for cal" values include a trailing note. |
| confirmed | text | `Yes` or `No` | `Yes` | Yes | Derived from `Status` | See Status values. |
| cal_date | date | `YYYY-MM-DD` or blank | `2026-10-26` | No | `Cal date` | Last calibration date. Blank when unknown or not applicable. |
| cal_due | date | `YYYY-MM-DD` or blank | `2027-10-26` | No | `Due date` | Next due date. Ignore for scheduling when `no_cal_required` is Yes. |
| cert_number | text | Blank in this export |  | No | Not a first-class field | Reserved for a future structured cert number. See certificate mapping above. |
| cal_vendor | text | Blank in this export |  | No | Not a first-class field | Reserved for a future structured vendor. See certificate mapping above. |
| has_cert | text | `Yes` or `No` | `Yes` | Yes | Derived from `Cert PDF` | Yes means a cert file is on record, not that it is still in date. |
| cert_path | text | `certs/<id>.pdf` or blank | `certs/PWS00033.pdf` | No | `Cert PDF` | Path to the filed PDF. |
| airtag | text | Free text or blank |  | No | `AirTag` | Apple AirTag or similar tracker note, when recorded. |
| notes | text | Free text, may contain several clauses separated by `;` | `Now PWS00040 (was R38701). ETI cert ...` | No | `Notes` | Operational history, prior IDs, and informal cert references. If a dollar amount ever appears, the export replaces it with `[redacted]`. |
| cal_tag | text | `JAN`, `MAY`, `SEP`, or blank | `MAY` | No | `Cal tag` | See Cal tag colors. |
| confirmation | text | Free text | `CONFIRMED 11/03/2026 (Tristen)` | No | `Confirmation` or `Status label` | Longer confirmation detail. |
| intellirent_facility | text | Place name or blank | `Intellirent - Tempe` | No | `Intellirent facility` | Facility involved in recent Intellirent service, when known. |
| intellirent_last_order | text | Service / order reference or blank | `SRV01067` | No | `Intellirent last order` | Latest related service request or order number. Not a price. |
| no_cal_required | text | `Yes` or `No` | `No` | Yes | Derived from model rules | See No-cal rules. |

## Certs Needed CSV field dictionary

File name pattern: `powerwave_certs_needed_YYYY-MM-DD.csv`.

This is a work list, not the system of record for every asset. Rows can repeat a unit that also appears in the equipment export. Use it to see what certification work is still open.

| Field | Type | Format | Example | Required | Source in the tracker | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| unit_id | text | Same ID conventions as equipment | `PWS00000` | Yes | `Unit ID` | Working ID on the certs-needed sheet. |
| pws_id | text | `PWS#####` or blank | `PWS00000` | No | Parsed from `Unit ID` / `Asset` |  |
| rental_no | text | `R#####` / `I#####` or blank |  | No | Parsed from `Unit ID` / `Asset` |  |
| description | text | Free text | `OMICRON CMC 356: AP Relay Test Set` | No | `Description` |  |
| make_model | text | Free text | `OMICRON CMC 356: AP` | No | `Make / Model` |  |
| serial | text | Free text | `DJ424G` | No | `Serial` |  |
| who_has_it | text | Person or group | `NIT` | No | `Who has it` | May use short group names (for example NIT). |
| category | text | Status text with the leading `N. ` index removed | `DONE - cert received` | Yes | `Category` | Common prefixes include `DONE -`, `EXPIRED`, and open "needed" categories. |
| tracker_cal | date | `YYYY-MM-DD` or blank | `2026-10-05` | No | `Tracker cal` | Source sheet may use `M/D/YYYY`; the export normalizes to ISO. |
| tracker_due | date | `YYYY-MM-DD` or blank | `2027-10-05` | No | `Tracker due (10-14, newer)` when present, else `Tracker due` |  |
| what_is_needed | text | Free text | `Cal 10/5/2026, due 10/5/2027 - ETI cert 98760-003174-15 ...` | No | `What is needed` | Often includes informal cert numbers. Review before promoting those into Axis cert fields. |
| has_cert | text | `Yes` or `No` | `Yes` | No | Joined from equipment `Cert PDF` when the unit ID matches |  |
| cert_path | text | `certs/<id>.pdf` or blank | `certs/PWS00000.pdf` | No | Joined from equipment `Cert PDF` |  |

## Suggested Axis import mapping

These are suggestions only. Adjust names to whatever Axis calls the same idea.

| Axis idea | Load from | Import notes |
| --- | --- | --- |
| Asset / equipment number | `pws_id`, else `rental_no`, else a temporary key from `unit` + `serial` | Keep the original `unit` value in a custom field so later PWS conversions can be matched. |
| Secondary / legacy asset number | `rental_no` when `pws_id` is also present | Useful after an R-to-PWS conversion. Also scan `notes` for "was R" / "formerly I" text. |
| Description | `description` | Fall back to `make_model` if description is blank. |
| Manufacturer / model | `make_model` (and parse manufacturer from description when needed) | Description is often `Make Model: variant`. |
| Serial number | `serial` | Required uniqueness for LEASE and PENDING rows. |
| Custodian / assigned to | `holder` | Map names to Axis people records where you can. Unmatched names can stay as free text. |
| Asset status | `status` plus `confirmed` | Keep the original `status` string. You can also derive a simpler Axis status: In service (`CONFIRMED`), Unconfirmed assignment (`NOT CONFIRMED`), Missing (`MISSING`), Out for calibration (starts with `At Intellirent for cal`). |
| Last calibration date | `cal_date` | ISO date. |
| Calibration due date | `cal_due` | Skip or mark "not applicable" when `no_cal_required` is Yes. |
| Calibration interval | (not exported) | Powerwave practice is typically 12 months. A documented exception is the live-line tool test on some units (24 months), which appears only in notes. |
| Cal tag / due season | `cal_tag` | JAN = red, MAY = blue, SEP = green. |
| Certificate on file | `has_cert`, `cert_path` | Attach the PDF at `certs/<id>.pdf`. Leave cert number and vendor blank until they are entered as structured data. |
| Location / facility | `intellirent_facility` when the unit is at Intellirent; otherwise infer from `holder` |  |
| External service reference | `intellirent_last_order` | Service request or order number, not a financial document. |
| AirTag / physical tracker | `airtag` |  |
| Remarks | `notes` | Keep as history; do not parse prices from it. |
| Do-not-calibrate flag | `no_cal_required` | Apply the TR-3170 and SG Ultra Max rules even if a historical cert is attached. |

Load the equipment CSV first. Use the Certs Needed CSV as an exceptions / open-work queue (`category` and `what_is_needed`), not as the master asset list.

## What is intentionally not in these exports

Software Access can read equipment, calibration, certificate, holder, and job-assignment data. It cannot read financial data. The CSV and the Software Access data feed both exclude:

- rental rates, list prices, invoice totals, and any other dollar amounts
- rental order history, live rental boards, quotes, and spend records
- order PDFs (those files can contain prices and are admin-only)

If a stray dollar amount appears in a notes field, the CSV replaces that amount with `[redacted]`.

## Revision

First version, 19 November 2026, matching the tracker Equipment and Certs Needed export buttons added for Software Access.
