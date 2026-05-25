# =========================================================
# BUILD NT REGIONS FROM ABS SA2 SHAPEFILE
# SA2 → 7 REGIONS
# =========================================================

import geopandas as gpd
import os
import re
import sys

# =========================================================
# 1 PATHS
# =========================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
DATA_DIR = os.path.join(PROJECT_DIR, "data")

os.makedirs(DATA_DIR, exist_ok=True)

SA2_OUTPUT = os.path.join(DATA_DIR, "nt_sa2.geojson")
REGION_OUTPUT = os.path.join(DATA_DIR, "nt_regions.geojson")
ZIP_PATH = os.path.join(SCRIPT_DIR, "SA2_2021_AUST_SHP_GDA2020.zip")

# =========================================================
# 2 LOAD SA2 DATA
# =========================================================

if os.path.exists(SA2_OUTPUT):
    print("Loading SA2 from existing GeoJSON...")
    sa2 = gpd.read_file(SA2_OUTPUT)
else:
    print("Loading SA2 from shapefile zip...")
    if not os.path.exists(ZIP_PATH):
        print(f"ERROR: Cannot find {ZIP_PATH}")
        sys.exit(1)

    sa2 = gpd.read_file(f"zip://{ZIP_PATH}")

print("Total SA2 polygons:", len(sa2))

# =========================================================
# 3 CONVERT CRS TO WGS84
# =========================================================

sa2 = sa2.to_crs(epsg=4326)

# =========================================================
# 4 FILTER NORTHERN TERRITORY
# =========================================================

sa2_nt = sa2[sa2["STE_NAME21"] == "Northern Territory"].copy()

print("NT SA2 count:", len(sa2_nt))

# =========================================================
# 5 MAP SA2 TO REGION
# =========================================================

def normalize_name(name):
    return re.sub(r"[^a-z0-9 ]+", " ", str(name).lower()).strip()


def get_region(sa2_name):
    s = normalize_name(sa2_name)

    darwin_suburbs = [
        "lyons", "tiwi", "east point", "brinkin", "nakara", "rapid creek",
        "nightcliff", "alawa", "wagaman", "leanyer", "wulagi",
        "jingili", "millner", "moili", "anula", "wanguri", "malak", "mararra",
        "karama", "coconut grove", "ludmilla", "the narrows",
        "parap", "fannie bay", "the gardens", "stuart park", "moil",
        "larrakeyah", "darwin city", "bayview", "winnellie",
        "charles darwin", "berrimah", "east arm", "darwin airport"
    ]

    # 🔥 check suburb Darwin only by normalized SA2 name
    for suburb in darwin_suburbs:
        if re.search(rf"\b{re.escape(suburb)}\b", s):
            return "Darwin"


    palmerston_names = {
        normalize_name(x)
        for x in [
            "driver",
            "gray",
            "bakewell",
            "woodroffe",
            "moulden",
            "Rosebery - Bellamack",
            "Durack - Marlow Lagoon",
        ]
    }

    if "palmerston" in s or s in palmerston_names:
        return "Palmerston"


    alice_names = {
        normalize_name(x)
        for x in [
            "Larapinta",
            "Charles",
            "East Side",
            "Flynn (NT)",
            "Mount Johns",
            "Ross",
        ]
    }

    if s in alice_names:
        return "Alice Springs"


    if "katherine" in s:
        return "Katherine"

    if "tennant" in s:
        return "Tennant Creek"

    if "nhulunbuy" in s:
        return "Nhulunbuy"

    return "NT Balance"

print("Assigning regions...")

sa2_nt["Region"] = sa2_nt["SA2_NAME21"].apply(get_region)

print(sa2_nt[["SA2_NAME21", "Region"]].head(20))

# =========================================================
# 6 EXPORT SA2 GEOJSON
# =========================================================

sa2_nt.to_file(SA2_OUTPUT, driver="GeoJSON")

print("SA2 GeoJSON exported:", SA2_OUTPUT)

# =========================================================
# 7 DISSOLVE SA2 INTO REGIONS
# =========================================================

print("Dissolving SA2 polygons into 7 regions...")

regions = sa2_nt.dissolve(
    by="Region",
    as_index=False
)

# Keep only clean region fields
regions = regions[["Region", "geometry"]]

print("Regions created:")
print(regions["Region"])

print("Region count:", len(regions))

# =========================================================
# 8 EXPORT REGION GEOJSON
# =========================================================

regions.to_file(REGION_OUTPUT, driver="GeoJSON")

print("Region GeoJSON exported:", REGION_OUTPUT)

# =========================================================
# DONE
# =========================================================

print("Completed successfully.")