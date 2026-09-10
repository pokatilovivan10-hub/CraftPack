"""Генерация недостающих _480.jpg с пост-записью и проверкой (FUSE флаки)."""
import os, time, sys
from PIL import Image

DIR = "/mnt/agents/output/app/public/uploads/products"
TARGET_W = 480

def fresh_missing():
    files = os.listdir(DIR)
    have480 = {f for f in files if f.endswith("_480.jpg")}
    need = []
    for f in files:
        if f.endswith(".jpg") and not f.endswith("_480.jpg"):
            v = f[:-4] + "_480.jpg"
            if v not in have480:
                need.append((f, v))
    return need

made = 0
for attempt in range(4):
    need = fresh_missing()
    print(f"attempt {attempt}: missing {len(need)}", flush=True)
    if not need:
        break
    for f, v in need:
        src = os.path.join(DIR, f)
        dst = os.path.join(DIR, v)
        try:
            with Image.open(src) as im:
                if im.width <= TARGET_W:
                    # оригинал и так мал — копируем как есть
                    with open(src, "rb") as r, open(dst, "wb") as w:
                        w.write(r.read())
                else:
                    im = im.convert("RGB")
                    h = round(im.height * TARGET_W / im.width)
                    im = im.resize((TARGET_W, h), Image.LANCZOS)
                    im.save(dst, "JPEG", quality=85)
            made += 1
            if made % 200 == 0:
                print(f"  made {made}", flush=True)
        except Exception as e:
            print(f"  FAIL {f}: {e}", flush=True)
    time.sleep(3)  # даём FUSE синхронизироваться

# Финальная проверка через stat, а не listdir
need = fresh_missing()
still = [v for _, v in need if not os.path.isfile(os.path.join(DIR, v))]
print(f"DONE made={made} still_missing={len(still)}")
for s in still[:10]:
    print("  still:", s)
