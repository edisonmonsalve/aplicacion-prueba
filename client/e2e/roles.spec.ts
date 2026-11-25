import { webBaseURL } from "./env";
import { expect, test, unique } from "./fixtures";

test("el operador no ve usuarios ni finanzas y no puede abrir esas rutas", async ({
  page,
  adminApi,
}) => {
  const sufijo = unique("operador").replace(/[^a-z0-9]/gi, "").slice(-10);
  const email = `${sufijo}@demo.com`;
  const creado = await adminApi.post("/api/users", {
    data: { nombre: "Operador E2E", email, password: "Demo1234!", rol: "operador" },
  });
  expect(creado.ok(), "No se pudo crear el operador de prueba").toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill("Demo1234!");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.getByRole("menuitem", { name: /Usuarios/ })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /Finanzas/ })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /Productos/ })).toBeVisible();

  await page.goto("/users");
  await expect(page).toHaveURL(`${webBaseURL}/`);
  await page.goto("/finanzas");
  await expect(page).toHaveURL(`${webBaseURL}/`);
});
