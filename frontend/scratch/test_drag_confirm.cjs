const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE] ${msg.text()}`);
  });

  console.log('Navigating...');
  await page.goto('http://localhost:5174/reserve/alabang-function-room', { waitUntil: 'networkidle2' });
  
  // Wait for page load
  await new Promise(r => setTimeout(r, 2000));

  console.log('Setting tomorrow date...');
  await page.evaluate(() => {
    const input = document.querySelector('input[type="date"]');
    if (input) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const val = tomorrow.toISOString().split('T')[0];
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Wait for time slots to fetch
  await new Promise(r => setTimeout(r, 1500));

  console.log('Selecting first available time slot...');
  const slotSelected = await page.evaluate(() => {
    // Find slot buttons. They are typically divs or buttons.
    // Let's find any button/div that contains time slot text or is inside slot container.
    // Slots are rendered inside TimeSlotControl. Let's find button or option elements.
    const slots = Array.from(document.querySelectorAll('button, div')).filter(el => {
      const text = el.textContent || '';
      return (text.includes('AM') || text.includes('PM')) && !text.includes('Confirm');
    });
    if (slots.length > 0) {
      slots[0].click();
      return true;
    }
    return false;
  });
  console.log('Time slot selected:', slotSelected);

  // Wait for state updates
  await new Promise(r => setTimeout(r, 500));

  console.log('Clicking Confirm Schedule...');
  const clickedConfirm = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent && b.textContent.includes('Confirm Schedule'));
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Confirm Schedule button clicked:', clickedConfirm);

  // Wait for overlay fadeout
  await new Promise(r => setTimeout(r, 1500));

  // Get clicked element at start position to verify overlay is gone
  const rect = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('div'));
    const viewportEl = elements.find(el => el.style.cursor && (el.style.cursor.includes('grab') || el.style.cursor.includes('grabbing')));
    if (!viewportEl) return null;
    const r = viewportEl.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

  if (rect) {
    const startX = Math.round(rect.x + 30);
    const startY = Math.round(rect.y + 30);
    
    const clickedElement = await page.evaluate((x, y) => {
      const el = document.elementFromPoint(x, y);
      return el ? { tagName: el.tagName, className: el.className, style: el.getAttribute('style') } : null;
    }, startX, startY);
    console.log('Clicked element at start position:', clickedElement);

    const initialTransform = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div'));
      const canvasEl = elements.find(el => el.style.border && el.style.border.includes('dashed'));
      return canvasEl ? canvasEl.style.transform : 'NOT FOUND';
    });
    console.log('Initial transform:', initialTransform);

    console.log(`Dragging from (${startX}, ${startY}) to (${startX + 200}, ${startY + 200})...`);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await new Promise(r => setTimeout(r, 100));
    await page.mouse.move(startX + 200, startY + 200, { steps: 20 });
    await page.mouse.up();

    // Wait for pan updates
    await new Promise(r => setTimeout(r, 500));

    const newTransform = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div'));
      const canvasEl = elements.find(el => el.style.border && el.style.border.includes('dashed'));
      return canvasEl ? canvasEl.style.transform : 'NOT FOUND';
    });
    console.log('Transform after drag:', newTransform);
  } else {
    console.log('Viewport rect not found.');
  }

  await browser.close();
})();
