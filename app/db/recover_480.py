"""Финальная генерация _480: для каждого variants-ref из БД, отсутствующего в git,
оригинал читается из git object store (или /tmp/rebuild), ресайз -> hash-object -> index."""
import json, subprocess, io, os
from PIL import Image

ROOT = "/mnt/agents/output/app"

def git(*args, input=None, binary=False):
    r = subprocess.run(["git","-C",ROOT,*args], input=input, capture_output=True, text=not binary)
    if r.returncode != 0:
        raise RuntimeError(f"git {args[0]}: {(r.stderr or b'')[:200]}")
    return r.stdout

imgs = json.load(open("/tmp/db_images.json"))
tracked = set(git("ls-files", "public/uploads/products").split())

# variants refs, которых нет в git
need = {}  # variant_rel -> original_rel
for r in imgs:
    v = r.get("variants")
    if isinstance(v, str):
        v = json.loads(v)
    for key in (v or {}).values():
        rel = "public/" + key
        if rel not in tracked:
            need[rel] = "public/" + r["storage_key"]
print("variants to generate:", len(need), flush=True)

made, failed = 0, []
lines = []
for rel, orig in need.items():
    try:
        data = git("cat-file", "blob", f":{orig}", binary=True)
    except Exception:
        # оригинал не в индексе — пробуем HEAD
        try:
            data = git("cat-file", "blob", f"HEAD:{orig}", binary=True)
        except Exception:
            failed.append(rel)
            continue
    try:
        im = Image.open(io.BytesIO(data)).convert("RGB")
        if im.width > 480:
            h = round(im.height * 480 / im.width)
            im = im.resize((480, h), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=85)
        tmp = f"/tmp/v480_{os.getpid()}.jpg"
        with open(tmp, "wb") as w:
            w.write(buf.getvalue())
        sha = git("hash-object", "-w", tmp).strip()
        lines.append(f"100644 {sha}\t{rel}")
        try:
            with open(os.path.join(ROOT, rel), "wb") as w:
                w.write(buf.getvalue())
        except OSError:
            pass
        made += 1
        if made % 300 == 0:
            print(f"  {made}/{len(need)}", flush=True)
    except Exception as e:
        failed.append(rel)
        print("  fail", rel, str(e)[:100], flush=True)

B = 200
for i in range(0, len(lines), B):
    git("update-index", "--add", "--index-info", input="\n".join(lines[i:i+B]) + "\n")
print(f"made={made} staged={len(lines)} failed={len(failed)}", flush=True)

tracked2 = set(git("ls-files", "public/uploads/products").split())
still = [r for r in need if r not in tracked2]
print("still missing variants:", len(still), flush=True)
