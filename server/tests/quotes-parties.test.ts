import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { bearer, resetDb } from "./helpers.js";
import { createQuote, draft, setup } from "./quote-helpers.js";

async function createParty(
  token: string,
  overrides: Record<string, unknown> = {}
): Promise<number> {
  const res = await request(app)
    .post("/api/third-parties")
    .set(bearer(token))
    .send({
      tipo: "cliente",
      tipo_documento: "NIT",
      documento: `900-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nombre: "Cliente Registrado SAS",
      email: "cliente@registrado.com",
      condicion_pago: "contado",
      dias_credito: 0,
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.id as number;
}

const getQuote = (token: string, id: number) =>
  request(app).get(`/api/quotes/${id}`).set(bearer(token));

describe("Presupuestos: tercero vinculado", () => {
  beforeEach(resetDb);

  it("guarda el party_id y expone el nombre del tercero en el detalle y el listado", async () => {
    const { admin, a } = await setup();
    const partyId = await createParty(admin.token);

    const created = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], {
        party_id: partyId,
        customer_nombre: "Nombre editado en la cotización",
      })
    );
    expect(created.status).toBe(201);

    const detail = await getQuote(admin.token, created.body.id);
    expect(detail.status).toBe(200);
    expect(detail.body.party_id).toBe(partyId);
    expect(detail.body.party_nombre).toBe("Cliente Registrado SAS");
    // El snapshot editable de la cotización manda en el documento.
    expect(detail.body.customer_nombre).toBe("Nombre editado en la cotización");

    const list = await request(app).get("/api/quotes").set(bearer(admin.token));
    expect(list.body.data[0]).toMatchObject({
      party_id: partyId,
      party_nombre: "Cliente Registrado SAS",
    });
  });

  it("rechaza un tercero que no es cliente", async () => {
    const { admin, a } = await setup();
    const proveedorId = await createParty(admin.token, {
      tipo: "proveedor",
      nombre: "Proveedor SAS",
    });

    const res = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { party_id: proveedorId })
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("no está registrado como cliente");
  });

  it("rechaza un tercero inactivo", async () => {
    const { admin, a } = await setup();
    const partyId = await createParty(admin.token);
    await request(app)
      .put(`/api/third-parties/${partyId}`)
      .set(bearer(admin.token))
      .send({ activo: false });

    const res = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { party_id: partyId })
    );
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("inactivo");
  });

  it("permite editar el snapshot y quitar el vínculo sin perder la cotización", async () => {
    const { admin, a } = await setup();
    const partyId = await createParty(admin.token);
    const created = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { party_id: partyId })
    );

    const updated = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(admin.token))
      .send(
        draft([{ product_id: a, cantidad: 2 }], {
          party_id: null,
          customer_nombre: "Cliente Manual",
        })
      );
    expect(updated.status).toBe(200);

    const detail = await getQuote(admin.token, created.body.id);
    expect(detail.body.party_id).toBeNull();
    expect(detail.body.customer_nombre).toBe("Cliente Manual");
  });

  it("duplica la cotización conservando el tercero", async () => {
    const { admin, a } = await setup();
    const partyId = await createParty(admin.token);
    const created = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { party_id: partyId })
    );

    const dup = await request(app)
      .post(`/api/quotes/${created.body.id}/duplicate`)
      .set(bearer(admin.token));
    expect(dup.status).toBe(201);

    const detail = await getQuote(admin.token, dup.body.id);
    expect(detail.body.party_id).toBe(partyId);
  });

  it("deja editar un borrador ya vinculado aunque el tercero se desactive después", async () => {
    const { admin, a } = await setup();
    const partyId = await createParty(admin.token);
    const created = await createQuote(
      admin.token,
      draft([{ product_id: a, cantidad: 1 }], { party_id: partyId })
    );

    await request(app)
      .put(`/api/third-parties/${partyId}`)
      .set(bearer(admin.token))
      .send({ activo: false });

    const updated = await request(app)
      .put(`/api/quotes/${created.body.id}`)
      .set(bearer(admin.token))
      .send(draft([{ product_id: a, cantidad: 3 }], { party_id: partyId }));

    expect(updated.status).toBe(200);
    const detail = await getQuote(admin.token, created.body.id);
    expect(detail.body.party_id).toBe(partyId);
    expect(detail.body.total).toBe(3570);
  });
});
