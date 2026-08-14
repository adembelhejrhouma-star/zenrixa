import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3000")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Open the 'Sign up' page (navigate to the Sign up page) to create a brand-new unique test account.
        await page.goto("http://localhost:3000/signup.html")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the 'Email' and 'Password' fields on the Sign Up page with the new unique credentials and click the 'Sign up' button.
        # you@example.com email field
        elem = page.locator('[id="email"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("ts+20260802_120000_001@example.com")
        
        # -> Fill the 'Email' and 'Password' fields on the Sign Up page with the new unique credentials and click the 'Sign up' button.
        # Create a password password field
        elem = page.locator('[id="password"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test123456!")
        
        # -> Fill the 'Email' and 'Password' fields on the Sign Up page with the new unique credentials and click the 'Sign up' button.
        # Sign up button
        elem = page.locator('[id="submit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the landing page and select a plan and the 'on_6_months' billing cycle.
        await page.goto("http://localhost:3000/landing.html")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Scroll down on the landing page to reveal the plan selection cards and billing cycle controls so a plan and 'on_6_months' billing can be chosen.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll to reveal the 'Choose your plan' section on the landing page so the plan cards and billing cycle controls become visible.
        await page.mouse.wheel(0, 300)
        
        # -> Click the 'Buy' button on the Pro plan
        # Buy button
        elem = page.get_by_text('Pro', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Buy', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the checkout experience is displayed
        await page.locator("xpath=/html/body/div/div[2]/div[3]/div[3]/input").nth(0).scroll_into_view_if_needed()
        # Assert: The checkout payment form's 'Full name on card' input is visible.
        await expect(page.locator("xpath=/html/body/div/div[2]/div[3]/div[3]/input").nth(0)).to_be_visible(timeout=15000), "The checkout payment form's 'Full name on card' input is visible."
        await page.locator("xpath=/html/body/div/div[2]/div[3]/div[4]/div/select").nth(0).scroll_into_view_if_needed()
        # Assert: The checkout country selector is visible.
        await expect(page.locator("xpath=/html/body/div/div[2]/div[3]/div[4]/div/select").nth(0)).to_be_visible(timeout=15000), "The checkout country selector is visible."
        await page.locator("xpath=/html/body/div/div[2]/div[3]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Pay' button to complete the purchase is visible on the checkout page.
        await expect(page.locator("xpath=/html/body/div/div[2]/div[3]/button").nth(0)).to_be_visible(timeout=15000), "The 'Pay' button to complete the purchase is visible on the checkout page."
        await page.locator("xpath=/html/body/div/div[2]/div[5]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The 'Return to Dashboard' button is visible on the checkout page.
        await expect(page.locator("xpath=/html/body/div/div[2]/div[5]/button").nth(0)).to_be_visible(timeout=15000), "The 'Return to Dashboard' button is visible on the checkout page."
        
        # --> Verify the selected plan details are displayed
        # Assert: Checkout URL contains plan=pro, confirming the selected plan is preserved.
        await expect(page).to_have_url(re.compile("plan=pro"), timeout=15000), "Checkout URL contains plan=pro, confirming the selected plan is preserved."
        # Assert: Checkout URL contains billing=on_6_months, confirming the chosen billing cycle is preserved.
        await expect(page).to_have_url(re.compile("billing=on_6_months"), timeout=15000), "Checkout URL contains billing=on_6_months, confirming the chosen billing cycle is preserved."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    