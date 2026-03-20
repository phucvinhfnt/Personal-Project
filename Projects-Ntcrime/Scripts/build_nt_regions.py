# =========================================================
# BUILD NT REGIONS FROM ABS SA2 SHAPEFILE
# SA2 → 7 REGIONS
# =========================================================

import geopandas as gpd


# =========================================================
# 1 LOAD SA2 SHAPEFILE
# =========================================================

zip_path = "SA2_2021_AUST_SHP_GDA2020.zip"

print("Loading SA2 shapefile...")

sa2 = gpd.read_file(f"zip://{zip_path}")

print("Total SA2 polygons:", len(sa2))


# =========================================================
# 2 CONVERT CRS
# =========================================================

sa2 = sa2.to_crs(epsg=4326)


# =========================================================
# 3 FILTER NORTHERN TERRITORY
# =========================================================

sa2_nt = sa2[sa2["STE_NAME21"] == "Northern Territory"].copy()

print("NT SA2 count:", len(sa2_nt))


# =========================================================
# 4 FUNCTION MAP SA2 → REGION
# =========================================================

def get_region(sa2_name):

    s = sa2_name.lower()

    if "darwin" in s:
        return "Darwin"

    if "palmerston" in s:
        return "Palmerston"

    if "alice" in s:
        return "Alice Springs"

    if "katherine" in s:
        return "Katherine"

    if "tennant" in s:
        return "Tennant Creek"

    if "nhulunbuy" in s:
        return "Nhulunbuy"

    return "NT Balance"


# =========================================================
# 5 APPLY REGION CLASSIFICATION
# =========================================================

print("Assigning regions...")

sa2_nt["Region"] = sa2_nt["SA2_NAME21"].apply(get_region)

print(sa2_nt[["SA2_NAME21","Region"]].head())


# =========================================================
# 6 MERGE SA2 → REGION
# =========================================================

print("Merging SA2 polygons into regions...")

regions = sa2_nt.dissolve(by="Region")

regions = regions.reset_index()

print("Regions created:")

print(regions["Region"])


# =========================================================
# 7 EXPORT GEOJSON
# =========================================================

output_file = "nt_regions.geojson"

regions.to_file(
    output_file,
    driver="GeoJSON"
)

print("GeoJSON exported:", output_file)


# =========================================================
# 8 OPTIONAL: ALSO EXPORT SA2 NT
# =========================================================

sa2_nt.to_file(
    "nt_sa2.geojson",
    driver="GeoJSON"
)

print("SA2 GeoJSON exported: nt_sa2.geojson")


# =========================================================
# DONE
# =========================================================

print("Completed successfully.")