import { expect, test, unique } from "./fixtures";

test("crea un producto, registra una entrada y ve el stock actualizado", async ({
  adminPage,
  adminApi,
}) => {
  const suffix = unique("prod").replace(/[^a-z0-9]/gi, "").slice(-8);
  const categoria = `Categoría ${suffix}`;
  const sku = `E2E-${suffix.toUpperCase()}`;
  const nombre = `Producto ${suffix}`;

  const creada = await adminApi.post("/api/categories", {
    data: { nombre: categoria, codigo: `P${suffix.slice(-5)}` },
  });
  expect(creada.ok(), "No se pudo preparar la categoría").toBeTruthy();

  await adminPage.goto("/products");
  await adminPage.getByRole("button", { name: "Nuevo producto" }).click();

  const modal = adminPage.getByRole("dialog");
  await modal.getByLabel("SKU").fill(sku);
  await modal.getByLabel("Nombre", { exact: true }).fill(nombre);
  const categoriaSelect = modal.getByRole("combobox", { name: "Categoría" });
  await categoriaSelect.click();
  await categoriaSelect.fill(categoria);
  await categoriaSelect.press("Enter");
  await modal.getByLabel("Precio de venta").fill("100");
  await modal.getByRole("button", { name: "Crear producto" }).click();

  await expect(adminPage.getByText("Producto creado")).toBeVisible();
  const fila = adminPage.locator("tr").filter({ hasText: sku });
  await expect(fila).toContainText(nombre);

  await fila.getByRole("button", { name: "Movimiento" }).click();
  const movimiento = adminPage.getByRole("dialog");
  await movimiento.getByLabel("Cantidad").fill("5");
  await movimiento.getByRole("button", { name: "Registrar" }).click();

  await expect(adminPage.getByText("Movimiento registrado. Nuevo stock: 5")).toBeVisible();
  await expect(adminPage.locator("tr").filter({ hasText: sku })).toContainText("5");
});
