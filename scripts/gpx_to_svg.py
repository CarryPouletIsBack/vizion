#!/usr/bin/env python3
"""
Script pour convertir un fichier GPX en SVG (tracé uniquement).
"""

import xml.etree.ElementTree as ET
import sys
import os
from typing import List, Tuple


def parse_gpx(gpx_file: str) -> List[Tuple[float, float, float]]:
    """
    Parse un fichier GPX et extrait les coordonnées (lat, lon, ele).
    Gère les fichiers avec ou sans namespace.
    """
    tree = ET.parse(gpx_file)
    root = tree.getroot()

    points: List[Tuple[float, float, float]] = []

    # Track points (namespace wildcard)
    for trkpt in root.findall(".//{*}trkpt"):
        lat = float(trkpt.get("lat"))
        lon = float(trkpt.get("lon"))
        ele_tag = trkpt.find("{*}ele")
        ele = float(ele_tag.text) if ele_tag is not None else 0.0
        points.append((lat, lon, ele))

    # Route points
    if not points:
        for rtept in root.findall(".//{*}rtept"):
            lat = float(rtept.get("lat"))
            lon = float(rtept.get("lon"))
            ele_tag = rtept.find("{*}ele")
            ele = float(ele_tag.text) if ele_tag is not None else 0.0
            points.append((lat, lon, ele))

    # Waypoints (fallback)
    if not points:
        for wpt in root.findall(".//{*}wpt"):
            lat = float(wpt.get("lat"))
            lon = float(wpt.get("lon"))
            ele_tag = wpt.find("{*}ele")
            ele = float(ele_tag.text) if ele_tag is not None else 0.0
            points.append((lat, lon, ele))

    return points


def normalize_coordinates(points: List[Tuple[float, float, float]]) -> Tuple[List[Tuple[float, float]], List[Tuple[float, float]]]:
    """
    Normalise les coordonnées GPS pour les convertir en coordonnées SVG.
    Retourne les points normalisés (x, y) et un profil distance/élévation (en km / m).
    """
    if not points:
        return [], []

    lats = [p[0] for p in points]
    lons = [p[1] for p in points]

    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)

    lat_range = max_lat - min_lat
    lon_range = max_lon - min_lon

    width = 800
    height = 600
    margin = 20

    scale_lat = (height - 2 * margin) / lat_range if lat_range > 0 else 1
    scale_lon = (width - 2 * margin) / lon_range if lon_range > 0 else 1
    scale = min(scale_lat, scale_lon)

    normalized = []
    profile = []
    cumulative_km = 0.0

    def haversine_km(a_lat, a_lon, b_lat, b_lon):
        from math import radians, sin, cos, asin, sqrt

        R = 6371
        dlat = radians(b_lat - a_lat)
        dlon = radians(b_lon - a_lon)
        a = sin(dlat / 2) ** 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(dlon / 2) ** 2
        c = 2 * asin(sqrt(a))
        return R * c

    prev_lat, prev_lon = points[0][0], points[0][1]
    for lat, lon, ele in points:
        x = margin + (lon - min_lon) * scale
        y = height - margin - (lat - min_lat) * scale
        normalized.append((x, y))
        # distance cumulée
        cumulative_km += haversine_km(prev_lat, prev_lon, lat, lon)
        prev_lat, prev_lon = lat, lon
        profile.append((round(cumulative_km, 2), round(ele)))

    return normalized, profile


def create_svg(points: List[Tuple[float, float]], output_file: str, profile: List[Tuple[float, float]]):
    """
    Crée un fichier SVG à partir des points normalisés.
    """
    if not points:
        print("Aucun point trouvé dans le fichier GPX")
        return

    width = 800
    height = 600
    path_data = "M " + " L ".join([f"{x:.2f},{y:.2f}" for x, y in points])

    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <path d="{path_data}" fill="none" stroke="#d4df00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(svg_content)

    print(f"SVG créé avec succès: {output_file}")
    print(f"Nombre de points: {len(points)}")
    # Sauvegarder le profil à côté pour debug éventuel
    profile_file = output_file + ".profile.json"
    try:
        import json

        with open(profile_file, "w", encoding="utf-8") as pf:
            json.dump(profile, pf)
    except Exception:
        pass


def main():
    if len(sys.argv) < 2:
        print("Usage: python gpx_to_svg.py <fichier.gpx> [fichier_sortie.svg]")
        sys.exit(1)

    gpx_file = sys.argv[1]
    if not os.path.exists(gpx_file):
        print(f"Erreur: Le fichier {gpx_file} n'existe pas")
        sys.exit(1)

    output_file = sys.argv[2] if len(sys.argv) > 2 else gpx_file.replace(".gpx", ".svg")

    points = parse_gpx(gpx_file)
    if not points:
        print("Aucun point GPS trouvé dans le fichier GPX")
        sys.exit(1)

    normalized_points, profile = normalize_coordinates(points)
    create_svg(normalized_points, output_file, profile)


if __name__ == "__main__":
    main()
