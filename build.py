"""Build champions.json, then apply hand-verified fixes from overrides.json.

Run: python build.py
Sources:
  Data Dragon (Riot)      - id, name, title, image
  Official LoL wiki       - resource, range, positions, release year
  Universe (Riot lore)    - region, species (races), gender guess from bio pronouns
Anything the sources get wrong goes in overrides.json so re-runs keep the fix.
"""
import json
import re
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
DDRAGON = "https://ddragon.leagueoflegends.com"
WIKI = "https://wiki.leagueoflegends.com/en-us/Module:ChampionData/data?action=raw"
UNIVERSE = "https://universe-meeps.leagueoflegends.com/v1/en_us"

REGION_NAMES = {
    "bandle-city": "Bandle City", "bilgewater": "Bilgewater", "demacia": "Demacia",
    "freljord": "Freljord", "ionia": "Ionia", "ixtal": "Ixtal", "mount-targon": "Targon",
    "noxus": "Noxus", "piltover": "Piltover", "shadow-isles": "Shadow Isles",
    "shurima": "Shurima", "unaffiliated": "Runeterra", "void": "The Void", "zaun": "Zaun",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "champion-data-builder"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def get(url):
    return json.loads(fetch(url))


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def wiki_data():
    out = {}
    # shortcut: regex over the Lua table, relies on the module's one-field-per-line layout
    for block in re.split(r'\n  \["', fetch(WIKI))[1:]:
        field = lambda k: (re.search(rf'\["{k}"\]\s*=\s*"([^"]*)"', block) or [None, None])[1]
        lst = lambda k: re.findall(r'"([^"]+)"', (re.search(rf'\["{k}"\]\s*=\s*\{{([^}}]*)\}}', block) or [None, ""])[1])
        if field("apiname"):
            out[field("apiname")] = {
                "resource": field("resource"), "range": field("rangetype"), "date": field("date"),
                "positions": list(dict.fromkeys(lst("client_positions") + lst("external_positions"))),
            }
    return out


def guess_gender(bio):
    """Guess from pronouns in the official bio; None when it's not clear-cut."""
    text = re.sub(r"<[^>]+>", " ", bio).lower()
    count = lambda words: sum(len(re.findall(rf"\b{w}\b", text)) for w in words)
    he, she = count(["he", "him", "his", "himself"]), count(["she", "her", "hers", "herself"])
    if he >= 3 * max(she, 1):
        return "Male"
    if she >= 3 * max(he, 1):
        return "Female"
    return None


def build():
    version = get(f"{DDRAGON}/api/versions.json")[0]
    dd = get(f"{DDRAGON}/cdn/{version}/data/en_US/champion.json")["data"]
    wiki = wiki_data()
    uni_by = {}
    for u in get(f"{UNIVERSE}/search/index.json")["champions"]:
        uni_by[norm(u["name"])] = uni_by[norm(u["slug"])] = u

    overrides_path = HERE / "overrides.json"
    overrides = json.loads(overrides_path.read_text("utf-8")) if overrides_path.exists() else {}

    champs, gaps = [], {}
    for cid, c in sorted(dd.items()):
        w = wiki.get(cid, {})
        u = uni_by.get(norm(c["name"])) or uni_by.get(norm(cid))
        species = gender = None
        if u:
            detail = get(f"{UNIVERSE}/champions/{u['slug']}/index.json")["champion"]
            species = [r["name"] for r in detail.get("races") or []] or None
            gender = guess_gender(detail["biography"]["full"] + " " + detail["biography"]["short"])
        resource = w.get("resource") or c["partype"]
        champ = {
            "id": cid,
            "name": c["name"],
            "title": c["title"],
            "image": f"{DDRAGON}/cdn/{version}/img/champion/{c['image']['full']}",
            "gender": gender,
            "positions": w.get("positions") or None,
            "species": species,
            "resource": resource if resource not in ("", "None") else "Manaless",
            "range": [w["range"]] if w.get("range") else None,
            "regions": [REGION_NAMES.get(u["associated-faction-slug"], u["associated-faction-slug"])] if u else None,
            "releaseYear": int(w["date"][:4]) if w.get("date") else None,
        }
        champ.update(overrides.get(cid, {}))
        missing = [k for k, v in champ.items() if v is None]
        if missing:
            gaps[cid] = missing
        champs.append(champ)

    (HERE / "champions.json").write_text(json.dumps(champs, indent=2, ensure_ascii=False), "utf-8")
    assert len(champs) == len(dd) and all(c["name"] and c["image"] for c in champs)
    print(f"Wrote {len(champs)} champions (Data Dragon {version}).")
    by_field = {}
    for cid, fields in gaps.items():
        for f in fields:
            by_field.setdefault(f, []).append(cid)
    for f, ids in by_field.items():
        print(f"  missing {f}: {len(ids)} -> {', '.join(ids)}")


if __name__ == "__main__":
    build()
