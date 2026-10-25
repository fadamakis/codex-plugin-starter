import { test, expect } from '@playwright/test';

for (const width of [1440, 768, 390]) {
  test(`notes can be created, edited, searched, and favorited at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your next idea starts here.' })).toBeVisible();
    const control = await page.getByRole('button', { name: 'New note', exact: true }).evaluate(element => {
      const style = getComputedStyle(element);
      return { padding: parseFloat(style.paddingInlineStart), radius: parseFloat(style.borderRadius) };
    });
    expect(control.padding).toBeGreaterThan(8);
    expect(control.radius).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'New note', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'New note', exact: true });
    await editor.getByLabel('Title', { exact: true }).fill('A fresh direction');
    await editor.getByLabel('Your note').fill('Make one small thing that feels useful.');
    await editor.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(editor).not.toBeVisible();
    await page.getByRole('button', { name: 'Add A fresh direction to favorites' }).click();
    await page.getByRole('button', { name: /^Favorites/ }).click();
    await expect(page.getByRole('heading', { name: 'A fresh direction', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit A fresh direction' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit note', exact: true });
    await edit.getByLabel('Title', { exact: true }).fill('A clearer direction');
    await edit.getByRole('button', { name: 'Save note', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search notes' }).fill('clearer');
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'A clearer direction' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Search notes' }).fill('does not exist');
    await expect(page.getByRole('heading', { name: 'No notes found' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('editor validates input, supports Escape, and returns focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'New note', exact: true });
  await trigger.click();
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', { name: 'Save note' }).click();
  await expect(editor.getByRole('alert')).toHaveText('Give your note a title.');
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('appearance follows the preview control without external requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4178') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Use dark appearance' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Your next idea starts here.' })).toBeVisible();
  await page.getByRole('button', { name: 'Use light appearance' }).click();
  expect(external).toEqual([]);
});

test('built UI receives its initial data through the official MCP AppBridge', async ({ page }) => {
  await page.goto('/tests/host.html');
  const app = page.frameLocator('#plugin');
  await expect(app.getByRole('heading', { name: 'Start with a small idea' })).toBeVisible();
  await app.getByRole('button', { name: 'Add Fewer things, done thoughtfully to favorites' }).click();
  await expect(app.getByRole('button', { name: 'Remove Fewer things, done thoughtfully from favorites' })).toHaveAttribute('aria-pressed', 'true');
  const calls = await page.evaluate(() => (window as unknown as { toolCalls: string[] }).toolCalls);
  expect(calls).toEqual(['notebook_favorite']);
});

for (const width of [1440, 390]) {
  test(`selected note is handed to Codex through the real AppBridge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/tests/host.html');
    const app = page.frameLocator('#plugin');
    await app.getByRole('button', { name: 'Work on Fewer things, done thoughtfully with Codex', exact: true }).click();
    await expect(app.getByRole('status').filter({ hasText: 'Sent to Codex.' })).toBeVisible();
    const messages = await page.evaluate(() => (window as unknown as { hostMessages: { role: string; content: { text: string }[] }[] }).hostMessages);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    const prompt = messages[0].content[0].text;
    const note = JSON.parse(prompt.slice(prompt.indexOf('{')));
    expect(note).toMatchObject({ id: 'fewer-things', title: 'Fewer things, done thoughtfully', kind: 'draft' });
    expect(note.body).toContain('One useful interaction.');
    expect(prompt).toContain('Keep the original note unchanged.');
    expect(await page.evaluate(() => (window as unknown as { toolCalls: string[] }).toolCalls)).toEqual([]);
    await expect(app.getByRole('article')).toHaveCount(3);
    expect(await app.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test('browser preview offers the selected prompt for copying without claiming AI ran', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Work on Start with a small idea with Codex', exact: true }).click();
  const prompt = page.getByRole('textbox', { name: 'Prompt for Start with a small idea' });
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveValue(/"id": "small-idea"/);
  await expect(page.getByText('Sent to Codex.', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Copy prompt', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Prompt copied.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await prompt.inputValue());
});

for (const mode of ['unsupported', 'reject']) {
  test(`host ${mode} leaves a usable prompt and the original note intact`, async ({ page }) => {
    await page.goto(`/tests/host.html?messages=${mode}`);
    const app = page.frameLocator('#plugin');
    const action = app.getByRole('button', { name: 'Work on Start with a small idea with Codex', exact: true });
    await action.click();
    await expect(app.getByRole('textbox', { name: 'Prompt for Start with a small idea' })).toBeVisible();
    await expect(app.getByRole('button', { name: 'Copy prompt', exact: true })).toBeVisible();
    await expect(action).toBeEnabled();
    await expect(app.getByText('Sent to Codex.', { exact: false })).toHaveCount(0);
    if (mode === 'reject') await expect(app.getByRole('alert')).toContainText('Could not send to Codex.');
    const messages = await page.evaluate(() => (window as unknown as { hostMessages: unknown[] }).hostMessages);
    expect(messages).toHaveLength(mode === 'unsupported' ? 0 : 1);
    expect(await page.evaluate(() => (window as unknown as { toolCalls: string[] }).toolCalls)).toEqual([]);
  });
}

test('OpenAI message extension works without a separate standard message capability', async ({ page }) => {
  await page.goto('/tests/host.html?messages=extended');
  const app = page.frameLocator('#plugin');
  await app.getByRole('button', { name: 'Work on Start with a small idea with Codex', exact: true }).click();
  await expect(app.getByRole('status').filter({ hasText: 'Sent to Codex.' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { hostMessages: unknown[] }).hostMessages)).toHaveLength(1);
});

test('notes saved outside the panel appear when the user refreshes', async ({ page }) => {
  await page.goto('/tests/host.html');
  const app = page.frameLocator('#plugin');
  await expect(app.getByRole('article')).toHaveCount(3);
  await page.evaluate(() => (window as unknown as { addHostNote: () => void }).addHostNote());
  await expect(app.getByRole('heading', { name: 'A plan saved from the conversation' })).toHaveCount(0);
  await app.getByRole('button', { name: 'Refresh notes', exact: true }).click();
  await expect(app.getByRole('heading', { name: 'A plan saved from the conversation' })).toBeVisible();
  await expect(app.getByRole('article')).toHaveCount(4);
});

test('browser preview keeps a saved note and favorite after a page reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New note', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Survives a refresh');
  await page.getByLabel('Your note', { exact: true }).fill('Stored only in this browser preview.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('button', { name: 'Add Survives a refresh to favorites', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Survives a refresh', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Survives a refresh from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Browser preview. Saved in this browser.', { exact: true })).toBeVisible();
});
