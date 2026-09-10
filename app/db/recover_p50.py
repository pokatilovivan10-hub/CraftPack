"""Восстановление priority-50 изображений со старого сайта.
Источник URL: отчёты замены фото. Проверка: sha256(content) == имя файла.
Запись: /tmp/rebuild + git plumbing (hash-object + update-index --index-info).
Также best-effort копия на диск public/uploads/products."""
import json, subprocess, os, io, hashlib, time
from concurrent.futures import ThreadPoolExecutor
import urllib.request

ROOT = "/mnt/agents/output/app"
OUT = "/tmp/rebuild"
os.makedirs(OUT, exist_ok=True)

# ── карта hash -> url из обоих отчётов ──
hash2url = {}
for rep in ["/mnt/agents/output/отчёт-замены-фото.json",
            "/mnt/agents/output/отчёт-замены-фото-новые-категории.json"]:
    for row in json.load(open(rep))["rows"]:
        ni, oi = row.get("newImage"), row.get("oldImage")
        if ni and oi and ni.get("storageKey") and oi.get("url"):
            fname = ni["storageKey"].rsplit("/", 1)[-1]
            h = fname.split(".")[0]
            hash2url[h] = oi["url"]
print("url map:", len(hash2url), flush=True)

missing = json.load(open("/tmp/missing_images.json"))
tracked = set(subprocess.run(["git","-C",ROOT,"ls-files","public/uploads/products"],capture_output=True,text=True).stdout.split())

targets = []
for r in missing["mains"]:
    if r["source_priority"] != 50:
        continue
    fname = r["storage_key"].rsplit("/", 1)[-1]
    h, ext = fname.split(".")[0], fname.rsplit(".", 1)[-1]
    if h in hash2url:
        targets.append((h, ext, hash2url[h], r["storage_key"]))
print("p50 targets with url:", len(targets), flush=True)

def fetch(t):
    h, ext, url, key = t
    path = os.path.join(OUT, f"{h}.{ext}")
    if os.path.exists(path) and hashlib.sha256(open(path,'rb').read()).hexdigest() == h:
        return (t, "cached")
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=40).read()
            got = hashlib.sha256(data).hexdigest()
            if got != h:
                last = f"hash mismatch {got[:12]}"
                break  # содержимое не то — ретрай бессмысленен
            with open(path, "wb") as w:
                w.write(data)
            return (t, "ok")
        except Exception as e:
            last = str(e)[:100]
            time.sleep(2)
    return (t, "fail: " + str(last))

ok, failed = 0, []
with ThreadPoolExecutor(max_workers=8) as ex:
    for i, (t, status) in enumerate(ex.map(fetch, targets)):
        if status in ("ok", "cached"):
            ok += 1
        else:
            failed.append((t[0], t[2], status))
        if (i+1) % 200 == 0:
            print(f"  {i+1}/{len(targets)} ok={ok} fail={len(failed)}", flush=True)
print(f"download done: ok={ok} fail={len(failed)}", flush=True)
json.dump(failed, open("/tmp/rebuild_failed.json","w"))

# ── git plumbing: добавляем скачанное ──
lines = []
for h, ext, url, key in targets:
    path = os.path.join(OUT, f"{h}.{ext}")
    rel = "public/" + key
    if rel in tracked or not os.path.exists(path):
        continue
    sha = subprocess.run(["git","-C",ROOT,"hash-object","-w",path],capture_output=True,text=True).stdout.strip()
    lines.append(f"100644 {sha}\t{rel}")
    try:
        with open(os.path.join(ROOT,"public",key), "wb") as w:
            w.write(open(path,"rb").read())
    except OSError:
        pass
B = 200
for i in range(0, len(lines), B):
    subprocess.run(["git","-C",ROOT,"update-index","--add","--index-info"],
                   input="\n".join(lines[i:i+B])+"\n", text=True, check=True)
print("git staged:", len(lines), flush=True)

tracked2 = set(subprocess.run(["git","-C",ROOT,"ls-files","public/uploads/products"],capture_output=True,text=True).stdout.split())
still = [t[3] for t in targets if "public/"+t[3] not in tracked2]
print("still missing p50:", len(still), flush=True)
