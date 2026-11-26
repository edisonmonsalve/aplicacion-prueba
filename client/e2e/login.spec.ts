import { adminCredentials } from "./env";
import { expect, test } from "./fixtures";

test("redirige al login cuando no hay sesión", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
});

test("muestra el error del servidor con credenciales incorrectas", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(adminCredentials.email);
  await page.getByLabel("Contraseña").fill("ClaveIncorrecta123");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByText("Credenciales incorrectas")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("inicia sesión y abre el panel con la sesión guardada", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(adminCredentials.email);
  await page.getByLabel("Contraseña").fill(adminCredentials.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.getByRole("menuitem", { name: /Inicio/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("token"))).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem("refreshToken"))).toBeTruthy();
});
