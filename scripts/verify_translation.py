"""Focused verification script for the translation upgrade.

Visits the deployed site, opens /#/digest/today and walks back through the
30-day digests to confirm:
  * at least N tweets render real Chinese in the "中文翻译" block
  * no "(mock)" / "ZH (mock)" string is left over
  * at least one tweet shows the "📎 被转内容核心结论" callout
  * console is clean
"""
import asyncio
import json
import os
import re
import sys

from playwright.async_api import async_playwright

URL = os.environ.get(
    "SITE_URL", "https://b5818d9a642f.aime-app.bytedance.net"
)
CN_RE = re.compile(r"[\u4e00-\u9fa5]")


def chinese_ratio(text: str) -> float:
    if not text:
        return 0.0
    cn = sum(1 for ch in text if "\u4e00" <= ch <= "\u9fa5")
    return cn / len(text)


async def collect_zh_blocks(page) -> list[str]:
    # Tweet 中文翻译 blocks have blockId ending with "-zh"
    return await page.evaluate(
        """() => Array.from(document.querySelectorAll('[data-annotatable-block]'))
              .filter(el => /-zh$/.test(el.getAttribute('data-annotatable-block')||''))
              .map(el => el.innerText)"""
    )


async def main():
    results = {"pass": [], "fail": []}
    console_errors: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context()
        page = await ctx.new_page()
        page.on(
            "console",
            lambda msg: console_errors.append(f"{msg.type}: {msg.text}")
            if msg.type in ("error", "warning")
            else None,
        )

        async def visit(path: str):
            await page.goto(URL + path)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(1.0)

        # Walk a few digest dates; today often only has minor tweets so pick a few.
        all_zh: list[str] = []
        quote_summary_seen = 0
        mock_text_seen = 0

        # collect 30 digest dates by hitting /digest/<date> for a few known days
        # but easier: visit /#/digest/today and the 5 latest by clicking sidebar.
        await visit("/#/digest/today")
        # fish out dates from the timeline links
        dates = await page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href*="#/digest/"]'))
              .map(a => a.getAttribute('href'))
              .filter(h => /digest\\/2025|digest\\/2026/.test(h))
              .slice(0, 12)"""
        )
        urls = ["/#/digest/today"] + list(dict.fromkeys(dates))
        for u in urls[:8]:
            await visit(u)
            blocks = await collect_zh_blocks(page)
            all_zh.extend(blocks)
            # check quote-summary blocks via class signature
            qs_count = await page.evaluate(
                """() => document.body.innerText.split('📎 被转内容核心结论').length - 1"""
            )
            quote_summary_seen += qs_count
            mock_count = await page.evaluate(
                """() => (document.body.innerText.match(/\\(mock\\)/g) || []).length
                       + (document.body.innerText.match(/ZH \\(mock\\)/g) || []).length"""
            )
            mock_text_seen += mock_count

        # also visit one builder detail page
        await visit("/#/builders/sama")
        blocks = await collect_zh_blocks(page)
        all_zh.extend(blocks)

        await browser.close()

    chinese_blocks = [b for b in all_zh if chinese_ratio(b) > 0.3]
    print(f"total zh blocks: {len(all_zh)}, with >30% chinese: {len(chinese_blocks)}")
    print(f"quote-summary callouts seen: {quote_summary_seen}")
    print(f"mock leftover text seen: {mock_text_seen}")

    if len(chinese_blocks) >= 20:
        results["pass"].append(f"≥20 中文翻译块: {len(chinese_blocks)}")
    else:
        results["fail"].append(f"中文翻译块过少: {len(chinese_blocks)}")

    if quote_summary_seen >= 1:
        results["pass"].append(f"📎 被转内容核心结论 出现 {quote_summary_seen} 次")
    else:
        results["fail"].append("没有看到 📎 被转内容核心结论")

    if mock_text_seen == 0:
        results["pass"].append("页面已无 (mock)/ZH (mock) 残留")
    else:
        results["fail"].append(f"仍残留 (mock) 文本 {mock_text_seen} 处")

    if not [c for c in console_errors if c.startswith("error")]:
        results["pass"].append("控制台 0 error")
    else:
        results["fail"].append(f"控制台 error: {console_errors[:3]}")

    print(json.dumps(results, ensure_ascii=False, indent=2))
    sys.exit(0 if not results["fail"] else 1)


if __name__ == "__main__":
    asyncio.run(main())
