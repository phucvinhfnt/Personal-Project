# =========================================================
# CSV -> PYTHON CLEAN -> EXCEL + CLEAN CSV (API-READY)
# FINAL PRODUCTION VERSION
# =========================================================

import os, re
import pandas as pd

INPUT_CSV = "data/nt_crime_statistics_dec_2025.xlsx"
BASE = os.path.splitext(os.path.basename(INPUT_CSV))[0]
OUTPUT_XLSX = f"/workspaces/Personal-Project/{BASE}_cleaned.xlsx"
OUTPUT_CSV  = f"/workspaces/Personal-Project/{BASE}_FACT_OFFENCES.csv"

if not os.path.exists(INPUT_CSV):
    raise FileNotFoundError(f"File not found: {INPUT_CSV}")

# ----------------------------
# 1) LOAD RAW CSV / EXCEL
# ----------------------------
extension = os.path.splitext(INPUT_CSV)[1].lower()
if extension in [".xls", ".xlsx"]:
    df_raw = pd.read_excel(INPUT_CSV, dtype=str)
elif extension in [".csv", ".txt"]:
    df_raw = pd.read_csv(INPUT_CSV, dtype=str, encoding="utf-8", low_memory=False)
else:
    raise ValueError(f"Unsupported input file type: {extension}")

df_raw = df_raw.rename(columns=lambda c: c.strip() if isinstance(c, str) else c)

print("✅ RAW rows:", len(df_raw))
print("✅ RAW columns:", list(df_raw.columns))


# ----------------------------
# 2) Flexible column detection
# ----------------------------
def pick_col(df, candidates):
    cols = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in cols:
            return cols[cand.lower()]
    for c in df.columns:
        for cand in candidates:
            if cand.lower() in str(c).lower():
                return c
    return None

col_asat   = pick_col(df_raw, ["As At", "AsAt"])
col_year   = pick_col(df_raw, ["Year"])
col_month  = pick_col(df_raw, ["Month number", "Month"])
col_cat    = pick_col(df_raw, ["Offence category"])
col_type   = pick_col(df_raw, ["Offence type"])
col_alc    = pick_col(df_raw, ["Alcohol involvement", "Alcohol"])
col_dv     = pick_col(df_raw, ["DV involvement", "DV"])
col_region = pick_col(df_raw, ["Reporting region", "Region"])
col_sa2    = pick_col(df_raw, ["Statistical Area 2", "SA2"])
col_count  = pick_col(df_raw, ["Number of offences", "Offences", "Count"])


# ----------------------------
# 3) CLEAN FUNCTIONS
# ----------------------------
def clean_text(s):
    if pd.isna(s): return None
    s = str(s).strip()
    s = re.sub(r"\s+", " ", s)
    if s in ["", "-", "–", "—"]:
        return None
    return s

def parse_date_any(x):
    if pd.isna(x): return pd.NaT
    x = str(x).strip()
    if x in ["", "-", "–", "—"]:
        return pd.NaT
    return pd.to_datetime(x, dayfirst=True, errors="coerce")


# ✅ ROBUST Alcohol logic
def alcohol_clean(x):
    if pd.isna(x):
        return None

    s = str(x).strip().upper()

    # YES formats
    if s in ["YES", "Y", "1", "TRUE"] or "ALCOHOL INVOLVED" in s:
        return "Alcohol involved"

    # NO formats
    elif s in ["NO", "N", "0", "FALSE"] or "NO ALCOHOL" in s:
        return "No alcohol involved"

    # Missing formats
    elif s in ["", "-", "–", "—"]:
        return None

    else:
        return None


def dv_flag_clean(x):
    if pd.isna(x): return 0
    s = str(x).strip().upper()
    if s in ["Y", "YES", "TRUE", "1"]:
        return 1
    return 0


# ----------------------------
# 4) BUILD FACT TABLE
# ----------------------------
fact = pd.DataFrame()

fact["as_at"] = df_raw[col_asat].apply(parse_date_any)

fact["year"]  = pd.to_numeric(df_raw[col_year], errors="coerce").astype("Int64")
fact["month"] = pd.to_numeric(df_raw[col_month], errors="coerce").astype("Int64")

fact["period_start"] = pd.to_datetime(
    dict(year=fact["year"].astype("float"),
         month=fact["month"].astype("float"),
         day=1),
    errors="coerce"
)

fact["year_month"] = fact["period_start"].dt.strftime("%Y-%m")
fact["quarter"] = fact["month"].apply(lambda m: f"Q{int((m-1)//3 + 1)}" if pd.notna(m) else None)

fact["offence_category"] = df_raw[col_cat].apply(clean_text)
fact["offence_type"]     = df_raw[col_type].apply(clean_text)

# Alcohol
fact["alcohol_involvement"] = df_raw[col_alc].apply(alcohol_clean)

fact["alcohol_flag"] = fact["alcohol_involvement"].apply(
    lambda x: 1 if x == "Alcohol involved" else 0
).astype("Int64")

# DV
fact["dv_flag"] = df_raw[col_dv].apply(dv_flag_clean).astype("Int64")

fact["reporting_region"] = df_raw[col_region].apply(clean_text)
fact["sa2_name"]         = df_raw[col_sa2].apply(clean_text)

fact["offence_count"] = pd.to_numeric(df_raw[col_count], errors="coerce").fillna(0).astype("Int64")

fact = fact.reset_index(drop=True)

# ----------------------------
# 5) VALIDATION CHECKS
# ----------------------------
print("\n✅ FACT rows:", len(fact))
print("✅ Year range:", fact["year"].min(), "to", fact["year"].max())
print("✅ Alcohol breakdown:")
print(fact["alcohol_involvement"].value_counts(dropna=False))

# ----------------------------
# 6) SAVE OUTPUTS
# ----------------------------
with pd.ExcelWriter(OUTPUT_XLSX, engine="openpyxl") as writer:
    df_raw.to_excel(writer, sheet_name="RAW", index=False)
    fact.to_excel(writer, sheet_name="FACT_OFFENCES", index=False)

fact.to_csv(OUTPUT_CSV, index=False, encoding="utf-8")

print("\n✅ Saved Excel:", OUTPUT_XLSX)
print("✅ Saved Clean CSV:", OUTPUT_CSV)
