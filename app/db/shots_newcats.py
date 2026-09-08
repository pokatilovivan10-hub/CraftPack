import asyncio, pathlib
from playwright.async_api import async_playwright

OUT = pathlib.Path("/mnt/agents/output/скриншоты-итерация-3")
OUT.mkdir(exist_ok=True)
BASE = "http://localhost:3100"

SHOTS = [
    ("каталог-лента-desktop", "/catalog/lenta", 1440, 900, False),
    ("каталог-мешочки-desktop", "/catalog/meshochki-podarochnye", 1440, 900, False),
    ("каталог-новый-год-desktop", "/catalog/novyy-god", 1440, 900, False),
    ("каталог-плёнка-desktop", "/catalog/plyonka-upakovochnaya", 1440, 900, False),
    ("каталог-лента-mobile", "/catalog/lenta", 390, 844, True),
    ("товар-новогодний-пакет-desktop", "/product/paket-podarochnyy-s-tisneniem-novyy-god-339-12-15-6-7-zelenyy-210g-1-20-1-240-300339h", 1440, 900, False),
]

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        for name, path, w, h, mobile in SHOTS:
            page = await browser.new_page(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
            await page.goto(BASE + path, wait_until="networkidle", timeout=45000)
            await page.wait_for_timeout(9000)
            await page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
            print("ok", name)
            await page.close()
        await browser.close()

asyncio.run(main())
