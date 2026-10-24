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
