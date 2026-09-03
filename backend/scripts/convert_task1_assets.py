"""Convert task-package 1 scale configuration into the backend PostgreSQL shape.

The source package keeps scale data in scoring/config_data.py. This script uses
that module as the source of truth and emits a JSON export plus PostgreSQL
JSONB seed SQL for the existing scale_configs table.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SOURCE_DOCUMENTS = {
    "SCD_Q9": "1_AD临床前期SCD筛查量表-基线期-加上情景选择题.pdf",
    "GDS": "1_AD临床前期SCD筛查量表-基线期-加上情景选择题.pdf",
    "FAQ": "1_AD临床前期SCD筛查量表-基线期-加上情景选择题.pdf",
    "MMSE": "1_AD临床前期SCD筛查量表-基线期-加上情景选择题.pdf",
    "MOCA_B": "4.最新量表操作说明修订版.pdf",
    "CDR": "5.CDR.pdf",
}


def config_to_dict(scale) -> dict:
    return {
        "scaleConfigId": f"{scale.code.lower()}-{scale.version}",
        "scaleCode": scale.code,
        "name": scale.name,
        "version": scale.version,
        "category": "screening" if scale.code in {"SCD_Q9", "GDS", "FAQ"} else "cognitive",
        "sourceDocument": SOURCE_DOCUMENTS[scale.code],
        "instructions": [scale.instruction],
        "items": [item.to_dict() for item in scale.items],
        "scoring": {
            "scoringType": scale.scoring_type,
            "scoreMin": scale.score_min,
            "scoreMax": scale.score_max,
            "cutoffs": [cutoff.to_dict() for cutoff in scale.cutoffs],
            "remark": scale.remark,
            "algorithmSource": f"scoring/scales/{scale.code.lower()}.py",
        },
        "stimulusAssets": [],
        "status": "draft",
    }


def sql_quote(value: str) -> str:
    return value.replace("'", "''")


def emit_seed_sql(configs: list[dict]) -> str:
    lines = [
        "-- Generated from task package 1 scoring/config_data.py.",
        "-- Target: backend/sql/001_init.sql -> scale_configs.",
        "-- Clinical rules remain draft until the team confirms them.",
        "BEGIN;",
    ]
    for config in configs:
        payloads = {
            "instructions": json.dumps(config["instructions"], ensure_ascii=False, separators=(",", ":")),
            "items": json.dumps(config["items"], ensure_ascii=False, separators=(",", ":")),
            "scoring": json.dumps(config["scoring"], ensure_ascii=False, separators=(",", ":")),
            "stimulus_assets": json.dumps(config["stimulusAssets"], ensure_ascii=False, separators=(",", ":")),
        }
        lines.append(
            "INSERT INTO scale_configs "
            "(scale_config_id, scale_code, name, version, category, source_document, "
            "instructions, items, scoring, stimulus_assets, status) VALUES ("
            f"'{sql_quote(config['scaleConfigId'])}', "
            f"'{sql_quote(config['scaleCode'])}', "
            f"'{sql_quote(config['name'])}', "
            f"'{sql_quote(config['version'])}', "
            f"'{sql_quote(config['category'])}', "
            f"'{sql_quote(config['sourceDocument'])}', "
            f"'{sql_quote(payloads['instructions'])}'::jsonb, "
            f"'{sql_quote(payloads['items'])}'::jsonb, "
            f"'{sql_quote(payloads['scoring'])}'::jsonb, "
            f"'{sql_quote(payloads['stimulus_assets'])}'::jsonb, "
            f"'{sql_quote(config['status'])}'"
            ");"
        )
    lines.extend(["COMMIT;", ""])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "_incoming" / "ad-ouc-master",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()

    source_root = args.source_root.resolve()
    output_root = args.output_root.resolve()
    sys.path.insert(0, str(source_root))
    from scoring.config_data import ALL_SCALES  # type: ignore[import-not-found]

    configs = [config_to_dict(scale) for scale in ALL_SCALES]
    fixture_path = output_root / "fixtures" / "task1-scale-configs.json"
    seed_path = output_root / "sql" / "004_seed_scale_configs.sql"
    fixture_path.parent.mkdir(parents=True, exist_ok=True)
    seed_path.parent.mkdir(parents=True, exist_ok=True)
    fixture_path.write_text(
        json.dumps(configs, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    seed_path.write_text(emit_seed_sql(configs), encoding="utf-8")

    item_count = sum(len(config["items"]) for config in configs)
    option_count = sum(
        len(item["options"])
        for config in configs
        for item in config["items"]
    )
    cutoff_count = sum(len(config["scoring"]["cutoffs"]) for config in configs)
    print(
        f"Converted {len(configs)} scales, {item_count} items, "
        f"{option_count} options, {cutoff_count} cutoffs."
    )
    print(f"JSON: {fixture_path}")
    print(f"SQL:  {seed_path}")


if __name__ == "__main__":
    main()
