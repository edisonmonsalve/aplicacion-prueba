import { expect, test, unique } from "./fixtures";

test("crea, edita y elimina una categoría", async ({ adminPage }) => {
  const suffix = unique("E2E").slice(-10).replace(/[^A-Za-z0-9]/g, "");
  const nombre = `Categoría ${suffix}`;
  const codigo = `E${suffix.slice(-6)}`;

  await adminPage.goto("/categories");

  const crear = adminPage.getByRole("button", { name: /Nueva categoría|Crear la primera/ });
  await expect(crear).toBeVisible();
  await crear.click();

  const modal = adminPage.getByRole("dialog");
  await modal.getByLabel("Nombre").fill(nombre);
  await modal.getByLabel("Código (prefijo de SKU)").fill(codigo);
  await modal.getByRole("button", { name: "Crear categoría" }).click();

  await expect(adminPage.getByText("Categoría creada")).toBeVisible();
  await expect(adminPage.locator("tr").filter({ hasText: nombre })).toBeVisible();

  await adminPage.locator("tr").filter({ hasText: nombre }).getByRole("button", { name: "Editar" }).click();
  const editar = adminPage.getByRole("dialog");
  await editar.getByLabel("Nombre").fill(`${nombre} editada`);
  await editar.getByRole("button", { name: "Guardar cambios" }).click();

  const editada = `${nombre} editada`;
  await expect(adminPage.locator("tr").filter({ hasText: editada })).toBeVisible();

  await adminPage.locator("tr").filter({ hasText: editada }).getByRole("button", { name: "Eliminar" }).click();
  await adminPage.locator(".ant-popconfirm").getByRole("button", { name: "Eliminar" }).click();

  await expect(adminPage.locator("tr").filter({ hasText: editada })).toHaveCount(0);
});
