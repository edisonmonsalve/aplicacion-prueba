import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * Auditoría automatizada de accesibilidad sobre las pantallas más usadas.
 * `wcag2a/aa` cubre los criterios WCAG 2.1 A y AA; las violaciones se listan
 * en el mensaje de fallo con su nodo afectado para poder corregirlas.
 */
async function audit(page: import("@playwright/test").Page, pantalla: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const detalle = results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact ?? "sin impacto"}): ${v.help}\n` +
        v.nodes.map((n) => `  - ${n.target.join(" ")}: ${n.failureSummary ?? ""}`).join("\n")
    )
    .join("\n\n");

  expect(results.violations, `${pantalla} tiene violaciones de accesibilidad:\n${detalle}`).toEqual([]);
}

test("login accesible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Bienvenido" })).toBeVisible();
  await audit(page, "Login");
});

test("productos accesibles", async ({ adminPage }) => {
  await adminPage.goto("/products");
  await expect(adminPage.getByRole("button", { name: "Nuevo producto" })).toBeVisible();
  await audit(adminPage, "Productos");
});

test("dashboard accesible", async ({ adminPage }) => {
  await adminPage.goto("/");
  await expect(adminPage.getByRole("menuitem", { name: /Inicio/ })).toBeVisible();
  await audit(adminPage, "Inicio");
});

test("finanzas accesibles", async ({ adminPage }) => {
  await adminPage.goto("/finanzas");
  await expect(adminPage.getByRole("navigation", { name: "Navegación del resumen financiero" })).toBeVisible();
  await audit(adminPage, "Finanzas");
});

test("formulario de factura accesible", async ({ adminPage }) => {
  await adminPage.goto("/facturas/nuevo?tipo=venta");
  await expect(adminPage.getByRole("button", { name: "Guardar" })).toBeVisible();
  await audit(adminPage, "Nueva factura");
});
