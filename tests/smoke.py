"""Smoke test: fresh-user setup for each pay frequency, then every tab.
Run from the repo root:  python3 tests/smoke.py
Needs: pip install playwright && playwright install chromium
"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'index.html').as_uri()
FREQS = ['monthly', 'lastwd', 'weekly', 'fortnightly', 'fourweekly']

async def run(p, freq):
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': 390, 'height': 844})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(PAGE); await pg.wait_for_timeout(300)
    await pg.click('[data-ob=next]')
    await pg.select_option('#ob-freq', freq)
    if freq == 'monthly': await pg.select_option('#ob-day', '15')
    await pg.click('[data-ob=next]')
    await pg.fill('#ob-inc', '2000'); await pg.click('[data-ob=next]')
    await pg.fill('#oba-0', '800'); await pg.fill('#oba-2', '90'); await pg.click('[data-ob=next]')
    await pg.fill('#ob-sav', '50')
    if await pg.query_selector('#ob-bal'): await pg.fill('#ob-bal', '600')
    await pg.click('[data-ob=finish]'); await pg.wait_for_timeout(200)
    setup_closed = await pg.evaluate("document.getElementById('setup').hidden")
    for k in ['1', '2']: await pg.click(f'.key[data-v="{k}"]')
    await pg.click('#save')
    for t in ['activity', 'bills', 'insights', 'log']:
        await pg.click(f'.tab[data-v={t}]'); await pg.wait_for_timeout(100)
    info = await pg.evaluate("JSON.stringify({cycle:curCycle(), pot:pot(), safe:safeInfo().safe, entries:S.tx.length})")
    await b.close()
    ok = setup_closed and not errs
    print(('PASS' if ok else 'FAIL'), freq.ljust(12), info, errs or '')
    return ok

async def main():
    async with async_playwright() as p:
        results = [await run(p, f) for f in FREQS]
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
