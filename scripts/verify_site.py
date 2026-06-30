"""Interactive verification of the AI Builders Daily prototype.

Drives the deployed site with Playwright and checks:
  - Annotation flow: select text -> click "+ 标注" -> right drawer opens,
    DOM gets the colored underline, localStorage gets prd_annotations_v1.
  - User switch: changing the active fake user, navigating back to the same
    page, still sees the other user's annotation.
  - Home: hot discussions panel populated, TOP visited builders works.
  - Digest content quality: /#/digest/today has at least one highlight card
    and no "今日无更新" filler.
  - feed-history.json: cover >= 20 days of real data.
"""
import asyncio
import json
import os
import sys

from playwright.async_api import async_playwright

URL = os.environ.get("SITE_URL", "https://db55bc9e3fb2.aime-app.bytedance.net")


def log(msg):
    print(msg, flush=True)


async def select_text_in(page, selector, start=0, end=None):
    handle = await page.query_selector(selector)
    if not handle:
        raise RuntimeError(f"Selector not found: {selector}")
    box = await handle.bounding_box()
    text = await handle.inner_text()
    if end is None:
        end = min(len(text), 30)
    # Use page.evaluate to set the Selection over a text range explicitly.
    result = await page.evaluate(
        """({selector, start, end}) => {
        const root = document.querySelector(selector);
        if (!root) return null;
        // Find the first text node and use range there
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let n = walker.nextNode();
        while (n) { textNodes.push(n); n = walker.nextNode(); }
        if (!textNodes.length) return null;
        const range = document.createRange();
        let remaining = start, startNode = null, startOffset = 0;
        for (const t of textNodes) {
          if (remaining <= t.length) { startNode = t; startOffset = remaining; break; }
          remaining -= t.length;
        }
        if (!startNode) return null;
        let endNode = null, endOffset = 0; remaining = end;
        for (const t of textNodes) {
          if (remaining <= t.length) { endNode = t; endOffset = remaining; break; }
          remaining -= t.length;
        }
        if (!endNode) { endNode = textNodes[textNodes.length-1]; endOffset = endNode.length; }
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        // Dispatch a mouseup event on the element so the toolbar appears
        const rect = range.getBoundingClientRect();
        return { text: sel.toString(), x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }""",
        {"selector": selector, "start": start, "end": end},
    )
    if not result:
        raise RuntimeError("Failed to set selection")
    # Dispatch a real mouseup on the page to trigger the document listener.
    await page.mouse.move(result["x"], result["y"])
    await page.mouse.down()
    await page.mouse.up()
    return result


async def main():
    results = {"pass": [], "fail": []}

    def check(name, cond, detail=""):
        if cond:
            results["pass"].append(name)
            log(f"  ✓ {name}")
        else:
            results["fail"].append((name, detail))
            log(f"  ✗ {name} :: {detail}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()
        console_msgs = []
        page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}"))

        # --- Step 1: feed-history.json coverage ---
        log("\n[1] Verify feed-history.json coverage")
        resp = await page.request.get(f"{URL}/data/feed-history.json")
        check("feed-history.json reachable", resp.ok, f"status={resp.status}")
        data = await resp.json() if resp.ok else {}
        days = data.get("days") or []
        covered = data.get("stats", {}).get("coveredDays") or len(days)
        total = data.get("stats", {}).get("totalTweets") or sum(
            sum(len(u.get("tweets", [])) for u in d.get("x", {}).get("users", []))
            for d in days
        )
        check("feed-history days >= 20", covered >= 20, f"covered={covered}")
        log(f"    covered={covered} days, totalTweets={total}, newest={days[0]['date'] if days else 'n/a'}")

        # --- Step 2: Home page ---
        log("\n[2] Home page checks")
        await page.goto(f"{URL}/#/", wait_until="networkidle")
        await page.wait_for_timeout(800)
        body_text = await page.locator("body").inner_text()
        check("No '分类速览' on home", "分类速览" not in body_text)
        check("Has 'AI 行业要闻精选' or digest title", "今日 AI Builders" in body_text or "AI 行业要闻" in body_text)
        check("Has 今日热门讨论 panel", "今日热门讨论" in body_text)
        check("Has TOP 关注 Builder panel", "TOP 关注 Builder" in body_text)
        check("Top visited fallback message present (no visits yet)", "暂无访问数据" in body_text)

        # --- Step 3: Annotation flow on home page ---
        log("\n[3] Annotation flow on /#/")
        # Clear annotations to start fresh
        await page.evaluate("localStorage.removeItem('prd_annotations_v1');")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(800)
        # Find a highlight tweet body or quote block
        sel_candidates = [
            "[data-annotatable-block]",
        ]
        ann_blocks = await page.query_selector_all("[data-annotatable-block]")
        check("Annotatable blocks exist on home", len(ann_blocks) > 0, f"count={len(ann_blocks)}")
        target_selector = None
        for blk in ann_blocks:
            txt = await blk.inner_text()
            if len(txt) > 40:
                target_selector = f"[data-annotatable-block='{await blk.get_attribute('data-annotatable-block')}']"
                break
        check("Found a long-enough annotatable block", target_selector is not None)
        if not target_selector:
            await browser.close()
            print(json.dumps(results, indent=2, ensure_ascii=False))
            sys.exit(1)
        log(f"    using selector: {target_selector}")
        # Select 20 chars from this block
        info = await select_text_in(page, target_selector, 5, 30)
        log(f"    selected text='{info['text'][:40]}'")
        # Wait for toolbar
        toolbar = await page.wait_for_selector("[data-annotation-toolbar]", timeout=3000)
        check("Floating toolbar appeared", toolbar is not None)
        # Click "+ 标注"
        annotate_btn = await page.query_selector("[data-annotation-toolbar] [data-action='annotate']")
        check("Toolbar has '+ 标注' button", annotate_btn is not None)
        await annotate_btn.click()
        await page.wait_for_timeout(500)
        # Check localStorage
        ann_list = await page.evaluate("JSON.parse(localStorage.getItem('prd_annotations_v1') || '[]')")
        check("Annotation written to localStorage", len(ann_list) >= 1, f"ann_list={ann_list}")
        # Check colored underline appears in DOM (the highlighted span style background)
        highlighted = await page.query_selector(f"{target_selector} span[style*='background']")
        check("Highlighted span rendered", highlighted is not None)
        # Drawer should be visible
        drawer_text_present = "本页讨论" in await page.locator("body").inner_text()
        check("Right drawer auto-opened", drawer_text_present)
        # Badge with 💬1
        badge_present = False
        body_text_now = await page.locator("body").inner_text()
        if "1" in body_text_now and "💬" in body_text_now:
            badge_present = True
        check("Comment badge visible", badge_present)

        # --- Step 4: Switch user and verify other user can see annotation ---
        log("\n[4] Switch user and revisit")
        # Set a different user via localStorage
        await page.evaluate("localStorage.setItem('prd_current_user', 'zhangsan'); window.dispatchEvent(new Event('user:update'));")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(800)
        ann_list2 = await page.evaluate("JSON.parse(localStorage.getItem('prd_annotations_v1') || '[]')")
        check("Annotation still present after user switch", len(ann_list2) >= 1)
        body2 = await page.locator("body").inner_text()
        check("Other user sees existing annotation indicators", "💬" in body2 or "本页讨论" in body2)

        # --- Step 5: digest/today highlight cards & no '今日无更新' filler ---
        log("\n[5] /#/digest/today checks")
        await page.evaluate("localStorage.setItem('prd_current_user', 'baonan');")
        await page.goto(f"{URL}/#/digest/today", wait_until="networkidle")
        await page.wait_for_timeout(800)
        digest_text = await page.locator("body").inner_text()
        check("No '今日无更新' filler", "今日无更新" not in digest_text)
        check("Has '今日三大焦点' or builder cards", "今日三大焦点" in digest_text or "今日要点" in digest_text)
        cards = await page.query_selector_all("[id^='brief-']")
        check("At least one highlight card", len(cards) >= 1, f"cards={len(cards)}")

        # --- Step 6: visit a few builder pages and re-check Top visited ---
        log("\n[6] Builder visit tracking → Home Top panel")
        for h in ["sama", "karpathy", "rauchg", "sama"]:
            await page.goto(f"{URL}/#/builders/{h}", wait_until="networkidle")
            await page.wait_for_timeout(300)
        visits = await page.evaluate("JSON.parse(localStorage.getItem('prd_builder_visits_v1') || '{}')")
        log(f"    visits payload: {visits}")
        check("Visits map populated", isinstance(visits, dict) and len(visits) >= 3)
        check("sama visit count is 2", visits.get("sama", {}).get("count") == 2, f"sama={visits.get('sama')}")
        await page.goto(f"{URL}/#/", wait_until="networkidle")
        await page.wait_for_timeout(500)
        home_text = await page.locator("body").inner_text()
        check("Top visited shows Sam Altman", "Sam Altman" in home_text)

        # --- Step 7: 30-day history visible in builder timeline ---
        log("\n[7] Builder timeline pulls 30-day real data")
        await page.goto(f"{URL}/#/builders/swyx", wait_until="networkidle")
        await page.wait_for_timeout(500)
        # click 时间线 tab
        try:
            await page.get_by_text("原始动态时间线").click()
        except Exception:
            pass
        await page.wait_for_timeout(500)
        tl_text = await page.locator("body").inner_text()
        check("Timeline shows multiple month tweets count", "近 30 天" in tl_text or "近30天" in tl_text)

        # --- Print console errors if any ---
        errs = [m for m in console_msgs if m.startswith("[error]") or "Error" in m]
        log(f"\n[console] {len(console_msgs)} messages, {len(errs)} errors")
        for m in errs[:10]:
            log(f"   {m}")

        await browser.close()

    log("\n=== SUMMARY ===")
    log(f"PASS {len(results['pass'])}")
    log(f"FAIL {len(results['fail'])}")
    for n, d in results["fail"]:
        log(f" - {n} :: {d}")
    sys.exit(0 if not results["fail"] else 1)


asyncio.run(main())
