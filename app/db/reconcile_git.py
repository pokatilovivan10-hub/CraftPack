"""Сверка git ↔ БД, пакетная версия:
1) missing-файлы, которые есть на диске — git add пачками по 200.
2) missing _480 — регенерация из оригинала (диск или git-блоб) в /tmp,
   затем пакетный update-index --index-info.
3) Финальная проверка покрытия."""
import json, os, subprocess, time, io
from PIL import Image

ROOT = "/mnt/agents/output/app"

def git(*args, input=None, check=True):
    r = subprocess.run(["git", "-C", ROOT, *args], input=input, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {args[0]}: {r.stderr[:300]}")
    return r.stdout

expected = ["public/" + e for e in json.load(open("/tmp/expected_files.json")) if e.startswith("uploads/products/")]
tracked = set(git("ls-files", "public/uploads/products").split())
missing = [e for e in expected if e not in tracked]
print(f"expected={len(expected)} tracked={len(tracked)} missing={len(missing)}", flush=True)

def isfile_retry(p, tries=3):
    for _ in range(tries):
        try:
            if os.path.isfile(p) and os.path.getsize(p) > 0:
                return True
        except OSError:
            pass
        time.sleep(1)
    return False

# Снимок каталога: 3 прохода listdir с объединением (FUSE может терять записи)
DIR = os.path.join(ROOT, "public/uploads/products")
disk_set = set()
for _ in range(3):
    try:
        disk_set.update(os.listdir(DIR))
    except OSError:
        pass
    time.sleep(2)
print(f"disk files: {len(disk_set)}", flush=True)

# ── 1. Файлы, которые есть на диске — пакетный add ──────────────────────────
on_disk, need_regen, unrecoverable = [], [], []
for rel in missing:
    fname = rel.rsplit("/", 1)[-1]
    if fname in disk_set:
        on_disk.append(rel)
    elif rel.endswith("_480.jpg"):
        need_regen.append(rel)
    else:
        unrecoverable.append(rel)
print(f"on_disk={len(on_disk)} need_regen={len(need_regen)} unrecoverable={len(unrecoverable)}", flush=True)

added = 0
for i in range(0, len(on_disk), 200):
    chunk = on_disk[i:i + 200]
    for attempt in range(3):
        r = subprocess.run(["git", "-C", ROOT, "add", "--"] + chunk, capture_output=True, text=True)
        if r.returncode == 0:
            added += len(chunk)
            break
        time.sleep(2)
    else:
        print("ADD FAILED chunk:", chunk[0], r.stderr[:200], flush=True)
    if (i // 200) % 2 == 0:
        print(f"  added {added}/{len(on_disk)}", flush=True)

# ── 2. Регенерация _480 ─────────────────────────────────────────────────────
regen_ok, index_lines = 0, []
for rel in need_regen:
    orig_rel = rel[:-8] + ".jpg"
    orig_disk = os.path.join(ROOT, orig_rel)
    data = None
    if orig_rel.rsplit("/", 1)[-1] in disk_set and isfile_retry(orig_disk, tries=2):
        try:
            data = open(orig_disk, "rb").read()
        except OSError:
            data = None
    if data is None and orig_rel in tracked:
        r = subprocess.run(["git", "-C", ROOT, "show", f"HEAD:{orig_rel}"], capture_output=True)
        if r.returncode == 0:
            data = r.stdout
    if not data:
        unrecoverable.append(rel)
        continue
    try:
        im = Image.open(io.BytesIO(data)).convert("RGB")
        if im.width > 480:
            h = round(im.height * 480 / im.width)
            im = im.resize((480, h), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=85)
        tmp = f"/tmp/regen_{os.getpid()}.jpg"
        with open(tmp, "wb") as w:
            w.write(buf.getvalue())
        try:
            with open(os.path.join(ROOT, rel), "wb") as w:
                w.write(buf.getvalue())
        except OSError:
            pass
        sha = git("hash-object", "-w", tmp).strip()
        index_lines.append(f"100644 {sha}\t{rel}")
        regen_ok += 1
        if regen_ok % 200 == 0:
            print(f"  regen {regen_ok}/{len(need_regen)}", flush=True)
    except Exception as e:
        print("  regen fail", rel, str(e)[:120], flush=True)
        unrecoverable.append(rel)

# пакетный update-index
if index_lines:
    git("update-index", "--add", "--index-info", input="\n".join(index_lines) + "\n")
print(f"regen_ok={regen_ok}", flush=True)

# ── 3. Финальная проверка ───────────────────────────────────────────────────
tracked2 = set(git("ls-files", "public/uploads/products").split())
still = [e for e in expected if e not in tracked2]
print(f"FINAL: tracked={len(tracked2)} still_missing={len(still)}", flush=True)
for s in still[:15]:
    print("  MISS:", s, flush=True)
print("unrecoverable:", len(unrecoverable), flush=True)
