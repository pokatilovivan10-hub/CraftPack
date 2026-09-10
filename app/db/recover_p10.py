"""Восстановление priority-10 миниатюр из исходных XLSX.
Хэшируем xl/media/* каждого прайса и сопоставляем с недостающими storage_key.
Запись: /tmp/rebuild_p10 + git plumbing + best-effort копия на диск."""
import json, subprocess, os, zipfile, hashlib

ROOT = "/mnt/agents/output/app"
OUT = "/tmp/rebuild_p10"
os.makedirs(OUT, exist_ok=True)
UPLOAD = "/mnt/agents/upload"
XLSX = ["коробки подарочные.xlsx", "бумага упаковочная.xlsx", "лента подарочная.xlsx",
        "пленка упаковочная.xlsx", "Флористика.xlsx", "новый год.xlsx", "мешочки подарочные.xlsx"]

missing = json.load(open("/tmp/missing_images.json"))
need = {}  # hash -> storage_key
for r in missing["mains"]:
    if r["source_priority"] != 10:
        continue
    fname = r["storage_key"].rsplit("/", 1)[-1]
    h = fname.split(".")[0]
    need[h] = r["storage_key"]
print("p10 missing:", len(need), flush=True)

found = 0
for fn in XLSX:
    path = os.path.join(UPLOAD, fn)
    if not os.path.exists(path):
        print("NO FILE:", fn, flush=True)
        continue
    z = zipfile.ZipFile(path)
    media = [n for n in z.namelist() if n.startswith("xl/media/")]
    hits = 0
    for name in media:
        data = z.read(name)
        h = hashlib.sha256(data).hexdigest()
        if h in need:
            key = need[h]
            fname = key.rsplit("/", 1)[-1]
            with open(os.path.join(OUT, fname), "wb") as w:
                w.write(data)
            hits += 1
    print(f"{fn}: media={len(media)} hits={hits}", flush=True)
    found += hits
print("total found:", found, flush=True)

# ── git plumbing ──
tracked = set(subprocess.run(["git","-C",ROOT,"ls-files","public/uploads/products"],capture_output=True,text=True).stdout.split())
lines = []
for h, key in need.items():
    fname = key.rsplit("/", 1)[-1]
    path = os.path.join(OUT, fname)
    rel = "public/" + key
    if rel in tracked or not os.path.exists(path):
        continue
    sha = subprocess.run(["git","-C",ROOT,"hash-object","-w",path],capture_output=True,text=True).stdout.strip()
    lines.append(f"100644 {sha}\t{rel}")
    try:
        with open(os.path.join(ROOT, "public", key), "wb") as w:
            w.write(open(path, "rb").read())
    except OSError:
        pass
B = 200
for i in range(0, len(lines), B):
    subprocess.run(["git","-C",ROOT,"update-index","--add","--index-info"],
                   input="\n".join(lines[i:i+B])+"\n", text=True, check=True)
print("git staged:", len(lines), flush=True)
tracked2 = set(subprocess.run(["git","-C",ROOT,"ls-files","public/uploads/products"],capture_output=True,text=True).stdout.split())
still = [k for k in need.values() if "public/"+k not in tracked2]
print("still missing p10:", len(still), flush=True)
