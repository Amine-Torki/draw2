"""
export_models.py  —  Export draw2 models to ONNX for the browser demo.

Run from the draw2 repo root with the venv active:
    python docs/export_models.py


Outputs (in docs/models/), uploaded to the demo bucket under onnx_models/:
    ygo_yolo.onnx        (~20 MB)   — YOLO-OBB detector
    vit_int8.onnx        (~90 MB)   — ViT classifier, INT8 quantised
    cardnames_onnx.json             — {vit_index: {EN, FR, JA, card_id, label}}

Named cardnames_onnx.json to distinguish it from the card_id-keyed cardnames.json
on the model repo: ONNX export drops the id2label mapping transformers reads from
config.json, so the browser needs names keyed by the ViT output index instead.

Japanese names come from YGOJSON (github.com/iconmaster5326/YGOJSON, MIT
licensed), which aggregates them from Yugipedia.

Requirements:
    pip install ultralytics transformers onnx onnxruntime torch
"""

import json
import os
from pathlib import Path

import torch
from huggingface_hub import hf_hub_download
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoImageProcessor, AutoModelForImageClassification
from ultralytics import YOLO

OUT_DIR = Path(__file__).parent / "models"
OUT_DIR.mkdir(exist_ok=True)


def export_yolo():
    print("\n=== Exporting YOLO-OBB ===")
    yolo_path = hf_hub_download(repo_id="HichTala/draw2", filename="ygo_yolo.pt")
    model = YOLO(yolo_path)
    # Export to ONNX. opset 17 is fine for ORT 1.18+.
    result = model.export(format="onnx", imgsz=640, opset=17, simplify=True)
    exported = Path(result)
    dest = OUT_DIR / "ygo_yolo.onnx"
    import shutil as _shutil
    _shutil.copy2(exported, dest)
    exported.unlink(missing_ok=True)
    size = dest.stat().st_size / 1e6
    print(f"  Saved: {dest}  ({size:.1f} MB)")


def export_vit():
    print("\n=== Exporting ViT (FP32 then INT8) ===")
    model = AutoModelForImageClassification.from_pretrained("HichTala/draw2")
    model.eval()

    dummy = torch.randn(1, 3, 224, 224)
    fp32_path = OUT_DIR / "vit_fp32.onnx"

    with torch.no_grad():
        torch.onnx.export(
            model,
            dummy,
            str(fp32_path),
            input_names=["pixel_values"],
            output_names=["logits"],
            dynamic_axes={"pixel_values": {0: "batch"}, "logits": {0: "batch"}},
            opset_version=17,
        )

    fp32_size = fp32_path.stat().st_size / 1e6
    print(f"  FP32: {fp32_path}  ({fp32_size:.1f} MB)")

    int8_path = OUT_DIR / "vit_int8.onnx"
    quantize_dynamic(
        model_input=str(fp32_path),
        model_output=str(int8_path),
        weight_type=QuantType.QUInt8,
    )
    int8_size = int8_path.stat().st_size / 1e6
    print(f"  INT8: {int8_path}  ({int8_size:.1f} MB)")
    print("  Kept FP32 model for comparison.")



def fetch_ygojson_ja_names():
    """
    card_id (str, unpadded) -> Japanese name, sourced from YGOJSON's
    aggregate cards.json (MIT licensed, aggregates Yugipedia). YGOJSON pads
    passwords with leading zeros, so we normalize before indexing.
    """
    import io
    import zipfile

    import requests

    url = "https://github.com/iconmaster5326/YGOJSON/releases/download/v1/aggregate.zip"
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
        cards = json.loads(z.read("cards.json"))

    pw_to_ja = {}
    for card in cards:
        ja = (card.get("text", {}).get("ja") or {}).get("name")
        if not ja:
            continue
        for pw in card.get("passwords", []):
            key = str(int(pw))
            pw_to_ja.setdefault(key, ja)
    return pw_to_ja


def export_cardnames():
    """
    cardnames.json from draw.py maps card_id (str) -> {EN:..., FR:...}.
    For the browser we want: label_index (str) -> {EN: ..., card_id: ...}
    so the ViT output index maps directly to a name.

    The ViT label format in draw2 is "CardName-card_id" (the HF model config
    stores id2label). We extract both.
    """
    print("\n=== Exporting card names ===")
    from transformers import AutoConfig

    config = AutoConfig.from_pretrained("HichTala/draw2")
    id2label = config.id2label  # {int: "CardName-card_id"}

    # Also grab cardnames.json for multilingual names
    raw_path = hf_hub_download(repo_id="HichTala/draw2", filename="cardnames.json")
    with open(raw_path, "r", encoding="utf-8") as f:
        cardnames_raw = json.load(f)  # {card_id: {EN: ..., FR: ...}}

    print("  Fetching Japanese names from YGOJSON...")
    pw_to_ja = fetch_ygojson_ja_names()

    out = {}
    ja_matched = 0
    for idx, label_str in id2label.items():
        parts = label_str.rsplit("-", 1)
        card_id = parts[-1] if len(parts) == 2 else ""
        name_raw = parts[0] if len(parts) == 2 else label_str
        card_data = cardnames_raw.get(card_id, {})
        entry = {
            "EN": card_data.get("EN") or name_raw.replace("-", " "),
            "FR": card_data.get("FR") or name_raw.replace("-", " "),
            "card_id": card_id,
            "label": label_str,
        }
        ja = pw_to_ja.get(card_id)
        if ja:
            entry["JA"] = ja
            ja_matched += 1
        out[str(idx)] = entry

    dest = OUT_DIR / "cardnames_onnx.json"
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  Saved: {dest}  ({dest.stat().st_size / 1e3:.0f} kB, {len(out)} entries, {ja_matched} with JA)")


if __name__ == "__main__":
    export_yolo()
    export_vit()
    export_cardnames()
    print("\nDone. All models saved to docs/models/.")
    print("Upload them to the bucket under onnx_models/; nothing here is committed to git.")
