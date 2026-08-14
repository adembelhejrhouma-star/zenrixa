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
        
        # -> Scroll the landing page to reveal the pricing / plans section so a subscription plan and billing-cycle control become visible.
        await page.mouse.wheel(0, 300)
        
        # -> Reveal the pricing / plans section on the landing page so the 'Choose your plan' heading and plan cards (Basic, Standard, Pro) are visible.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll up to reveal the 'Choose your plan' heading and the plan cards (Basic, Standard, Pro) on the landing page.
        await page.mouse.wheel(0, 300)
        
        # -> Scroll down until the 'Choose your plan' heading and plan cards (Basic, Standard, Pro) are visible on the page.
        await page.mouse.wheel(0, 300)
        
        # -> Click the 'On 6 months' billing label to select a billing plan (required before buying) so the plans are billed every 6 months.
        # On 6 months label
        elem = page.locator('[id="toggle-six-label"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Buy' button on the Pro plan card to continue to checkout and display the checkout experience.
        # Buy button
        elem = page.get_by_text('Pro', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Buy', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'Sign up' page and create a new account so the visitor can sign in and continue the purchase flow.
        await page.goto("http://localhost:3000/signup.html")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the 'Email' and 'Password' fields and click the 'Sign up' button to create a new test account.
        # you@example.com email field
        elem = page.locator('[id="email"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("ts+20260802-143501@example.com")
        
        # -> Fill the 'Email' and 'Password' fields and click the 'Sign up' button to create a new test account.
        # Create a password password field
        elem = page.locator('[id="password"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test123456!")
        
        # -> Fill the 'Email' and 'Password' fields and click the 'Sign up' button to create a new test account.
        # Sign up button
        elem = page.locator('[id="submit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Back to home' button to return to the landing page so the pricing section can be selected.
        # ← button
        elem = page.get_by_role('button', name='←', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'On 6 months' billing label to select a billing plan (required before buying) and wait for the UI to update.
        # On 6 months label
        elem = page.locator('[id="toggle-six-label"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Buy' button on the Pro plan card to continue to checkout.
        # Buy button
        elem = page.get_by_text('Pro', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='Buy', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the checkout experience is displayed
        # Assert: The browser is on the checkout page for the selected plan and billing.
        await expect(page).to_have_url(re.compile("checkout\\.html\\?plan=pro\\&billing=on_6_months"), timeout=15000), "The browser is on the checkout page for the selected plan and billing."
        await page.locator("xpath=/html/body/div[1]/div[2]/div[3]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The checkout payment button 'Pay' is visible.
        await expect(page.locator("xpath=/html/body/div[1]/div[2]/div[3]/button").nth(0)).to_be_visible(timeout=15000), "The checkout payment button 'Pay' is visible."
        # Assert: The payment card number field with placeholder 'Card number' is present.
        await expect(page.locator("xpath=/html/body/div/form/div/div[2]/span[1]/span[2]/div/div[2]/span/input").nth(0)).to_have_attribute("placeholder", "Card number", timeout=15000), "The payment card number field with placeholder 'Card number' is present."
        # Assert: The selected plan price '$100' is displayed on the checkout page.
        await expect(page.locator("xpath=/html/body/div[1]/div[2]/div[5]/div[2]/div/div[2]/div[1]").nth(0)).to_contain_text("$100", timeout=15000), "The selected plan price '$100' is displayed on the checkout page."
        
        # --> Verify the selected plan details are displayed
        # Assert: The checkout URL contains the selected plan (plan=pro).
        await expect(page).to_have_url(re.compile("plan=pro"), timeout=15000), "The checkout URL contains the selected plan (plan=pro)."
        # Assert: The checkout URL contains the selected billing cycle (billing=on_6_months).
        await expect(page).to_have_url(re.compile("billing=on_6_months"), timeout=15000), "The checkout URL contains the selected billing cycle (billing=on_6_months)."
        # Assert: The checkout page displays the selected plan price ($100).
        await expect(page.locator("xpath=/html/body/div[1]/div[2]/div[5]/div[2]/div/div[2]/div[1]").nth(0)).to_have_text("$100", timeout=15000), "The checkout page displays the selected plan price ($100)."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    