# Apuntes de contabilidad y finanzas

> Guía de estudio basada en la lógica real de esta aplicación. Cada concepto
> explica **qué hace el sistema**, **por qué** y **cómo se vería en la
> contabilidad de una empresa real**. Sirve como material de repaso: se puede
> leer de corrido o usar las tablas y fórmulas como chuleta.
>
> Estado del código: rama `main`, commit `06efa60` (17/11/2026). Moneda: COP.

---

## Índice

1. [La aplicación en una página](#1-la-aplicación-en-una-página)
2. [Los seis conceptos que sostienen todo](#2-los-seis-conceptos-que-sostienen-todo)
3. [Cómo modela el sistema la contabilidad](#3-cómo-modela-el-sistema-la-contabilidad)
4. [Plan de cuentas del sistema](#4-plan-de-cuentas-del-sistema)
5. [Ciclo de venta](#5-ciclo-de-venta)
6. [Ciclo de compra](#6-ciclo-de-compra)
7. [Inventario y costo](#7-inventario-y-costo)
8. [Cartera: cuentas por cobrar y por pagar](#8-cartera-cuentas-por-cobrar-y-por-pagar)
9. [Estados financieros](#9-estados-financieros)
10. [Impuestos y retenciones en Colombia](#10-impuestos-y-retenciones-en-colombia)
11. [Presupuestos](#11-presupuestos)
12. [Cierres y conciliación bancaria](#12-cierres-y-conciliación-bancaria)
13. [Analítica y reportes](#13-analítica-y-reportes)
14. [Indicadores y fórmulas (chuleta)](#14-indicadores-y-fórmulas-chuleta)
15. [Reglas de oro del sistema](#15-reglas-de-oro-del-sistema)
16. [Mitos y errores frecuentes](#16-mitos-y-errores-frecuentes)
17. [Caso práctico completo de un mes](#17-caso-práctico-completo-de-un-mes)
18. [Casos de decisión empresarial](#18-casos-de-decisión-empresarial)
19. [Glosario](#19-glosario)
20. [Mapa aplicación ↔ concepto](#20-mapa-aplicación--concepto)
21. [Preguntas de repaso](#21-preguntas-de-repaso)

---

## 1. La aplicación en una página

La aplicación es un ERP ligero: inventario + ciclo comercial + finanzas. La
idea central es que **cada hecho económico deje un rastro documental y un
asiento**, y que los reportes se deriven de esos asientos, no de cálculos
paralelos.

| Módulo | Qué administra | Qué produce |
|---|---|---|
| **Productos y categorías** | SKU, precio, costo de referencia, stock mínimo, stock actual | Catálogo y alertas de stock bajo |
| **Movimientos** | Entradas y salidas de inventario con motivo y origen | Costo histórico de cada salida |
| **Cotizaciones** | Propuesta comercial: cliente, líneas, validez, estado | Documento no contable; embudo comercial |
| **Facturas** | Venta o compra, contado o crédito, impuestos y retenciones | Asientos contables, stock, cartera |
| **Terceros** | Clientes y proveedores con documento y condición de pago | Reutilización y análisis por cliente |
| **Finanzas** | Categorías, cuentas, transacciones, presupuestos, cartera, conciliación, cierres | Estados financieros y control |
| **Auditoría / Salud de datos** | Bitácora de cambios y chequeos de integridad | Trazabilidad y detección de errores |
| **Empresa / Usuarios** | Identidad del emisor y roles | Documentos impresos y permisos |

### El flujo documental

```
Cotización ──(aprobar)──► Factura borrador ──(confirmar)──► Factura confirmada
     │                          │                              │
     │                          │                              ├──► Stock (venta sale / compra entra)
     │                          │                              ├──► Asientos contables
     │                          │                              └──► Cartera (si es a crédito)
     │                          │
     └── propuesta comercial    └── todavía NO contabiliza     Pago/cobro ──► Caja
                                                               Nota crédito/débito ──► Ajuste
```

Reglas clave del flujo:

- Una **cotización no contabiliza**: es una promesa comercial. Se puede
  rechazar, vencer o quedar sin facturar.
- Una **factura en borrador tampoco contabiliza** ni mueve stock. Todo ocurre
  al **confirmar**.
- La factura es el documento legal; la cotización solo es referencia. Sus montos
  pueden diferir (RN-45).
- Una factura confirmada **no se edita ni se borra**: se anula con contrapartida
  o se ajusta con nota crédito/débito.
- El **pago o cobro** es un hecho posterior y separado: mueve caja y reduce
  cartera, pero no vuelve a reconocer ingreso.

---

## 2. Los seis conceptos que sostienen todo

### 2.1 Ecuación contable

```
ACTIVO = PASIVO + PATRIMONIO
```

- **Activo**: lo que la empresa tiene o le deben (caja, inventario, cartera,
  IVA a favor).
- **Pasivo**: lo que la empresa debe (proveedores, IVA por pagar, retenciones
  por pagar).
- **Patrimonio**: lo que queda para los dueños. En este sistema se **deriva**
  como `activo − pasivo`; no se escribe a mano.

Si la ecuación no cuadra, hay un error de registro. El balance de la aplicación
incluye una verificación explícita (`ecuacion.cuadra`).

### 2.2 Naturaleza de las cuentas

Cada asiento del sistema tiene una **naturaleza** (`tipo`):

| Tipo | Qué representa | Efecto en caja | Efecto en resultado |
|---|---|---|---|
| `ingreso` | Dinero que entra por la operación | Suma | Suma |
| `gasto` | Dinero que se consume para operar | Resta | Resta |
| `activo` | Bien o derecho que se convierte en beneficio futuro | Resta (si se paga) | No |
| `pasivo` | Obligación con terceros o con el fisco | Suma (si se recibe) | No |

La lógica parece invertida al principio: **un pasivo que aumenta suma a la
caja** porque significa que alguien te financió (te dio dinero o te prestó un
servicio que aún no pagas). En el sistema, la caja se calcula así:

```
saldo de caja = saldo inicial
              + ingresos y pasivos que afectan caja
              − gastos y activos que afectan caja
```

### 2.3 Devengo vs. caja

Son dos preguntas distintas:

- **Devengo (resultado)**: ¿cuándo se ganó o se consumió el valor? Una venta a
  crédito ya es ingreso aunque no haya entrado dinero.
- **Caja**: ¿cuándo entró o salió dinero de verdad?

El sistema separa ambas con dos banderas por asiento:

- `afecta_resultado = 1` → entra al estado de resultados.
- `afecta_caja = 1` → mueve el saldo de caja/banco.

Una venta a crédito es un ingreso con `afecta_caja = 0`. Un cobro posterior es
un ingreso con `afecta_resultado = 0` y `afecta_caja = 1`. **Nunca se cuenta dos
veces el mismo ingreso.**

### 2.4 Partida doble simplificada

La contabilidad real registra dos patas por operación (débito y crédito). Este
sistema guarda **una sola pata explícita** por asiento (`transactions`) y deja la
contrapartida implícita en la naturaleza: si registras un ingreso de 180.000,
implícitamente aumenta el activo (caja o cartera). Los reportes reconstruyen la
otra pata.

Ventaja: el modelo es simple y legible. Límite: no sustituye un libro diario
formal; para auditoría externa habría que exportar y mapear a un plan de cuentas
completo.

### 2.5 El IVA no es dinero propio

El IVA que cobras a un cliente **no es ingreso tuyo**: lo recaudas para el
Estado. El IVA que pagas a un proveedor **no es gasto tuyo**: es un crédito
fiscal. Por eso el sistema lo separa:

- Venta → **IVA por pagar** (pasivo).
- Compra → **IVA descontable** (activo).
- En los reportes se **netea**: `IVA por pagar − IVA descontable = IVA neto`.
  Si es positivo, debes pagar; si es negativo, tienes saldo a favor.

### 2.6 Costo, gasto e inversión

| Concepto | Ejemplo | Dónde va | Cuándo afecta utilidad |
|---|---|---|---|
| **Inversión / activo** | Comprar mercancía | Inventario (activo) | No al comprar; sí al vender como costo |
| **Gasto** | Arriendo, nómina, servicios | Resultado | En el periodo en que se consume |
| **Costo de ventas** | Mercancía que salió | Resultado | Al confirmar la venta |

Comprar inventario **no es gasto**: es cambiar un activo (dinero) por otro
(mercancía). El gasto aparece cuando vendes, como **costo de ventas**. Este es
uno de los errores más comunes al leer una empresa.

---

## 3. Cómo modela el sistema la contabilidad

### 3.1 La tabla `transactions`

Cada fila es un asiento con:

| Campo | Función |
|---|---|
| `tipo` | `ingreso`, `gasto`, `activo` o `pasivo` |
| `monto` | Valor (positivo; las notas crédito usan signo negativo) |
| `fecha` | Fecha contable; un periodo cerrado la rechaza |
| `finance_category_id` | Categoría del plan de cuentas |
| `account_id` | Cuenta de caja o banco que se mueve |
| `afecta_caja` | `NULL` = lo decide la categoría; `0/1` = override del asiento |
| `invoice_id`, `invoice_adjustment_id` | Documento que lo originó |
| `anulada_de` | Si es contrapartida de anulación, apunta al asiento original |

### 3.2 Las dos banderas que explican todo

La categoría trae valores por defecto; el asiento puede sobrescribirlos. Así una
misma categoría sirve para contado y crédito.

| Operación | Tipo | Categoría | `afecta_caja` | `afecta_resultado` | Efecto |
|---|---|---|---|---|---|
| Venta contado | ingreso | Ventas | 1 (categoría) | 1 | + caja, + ingreso |
| Venta crédito | ingreso | Ventas | **0 (asiento)** | 1 | + cartera, + ingreso |
| Cobro de cartera | ingreso | Cobro de cartera | 1 | **0 (categoría)** | + caja, sin nuevo ingreso |
| Compra contado | activo | Inventario | 1 (asiento de salida) | 0 | − caja, + inventario |
| Compra crédito | activo | Inventario | 0 (asiento) | 0 | + inventario, + cuenta por pagar |
| Pago a proveedor | gasto | Pago de cartera | 1 | 0 | − caja, − cuenta por pagar |
| Costo de ventas | gasto | Costo de ventas | 0 | 1 | − utilidad, sin caja |

### 3.3 Anulaciones

Nunca se borra un asiento. Se crea otro con `anulada_de` apuntando al original y
signo contrario. Los reportes usan la constante `VALID_TRANSACTION`, que excluye
los anulados y los que ya tienen contrapartida. Eso preserva la historia y hace
auditable cualquier corrección.

---

## 4. Plan de cuentas del sistema

Estas son las categorías que el código usa por su **código estable**, no por el
nombre visible (renombrar “Ventas” no rompe nada).

| Código | Nombre | Tipo | Afecta caja | Afecta resultado | Uso |
|---|---|---|---|---|---|
| `ventas` | Ventas | ingreso | Sí | Sí | Base de la factura de venta |
| `otros_ingresos` | Otros ingresos | ingreso | Sí | Sí | Ingresos manuales |
| `descuentos_obtenidos` | Descuentos obtenidos | ingreso | No | Sí | Descuento de compras |
| `costo_ventas` | Costo de ventas | gasto | No | Sí | Salida de inventario vendido |
| `servicios` | Servicios | gasto | Sí | Sí | Gastos operativos |
| `nomina` | Nómina | gasto | Sí | Sí | Gastos operativos |
| `arriendo` | Arriendo | gasto | Sí | Sí | Gastos operativos |
| `impuestos` | Impuestos | gasto | Sí | Sí | Gasto distinto de IVA |
| `otros_gastos` | Otros gastos | gasto | Sí | Sí | Gastos operativos |
| `inventario` | Inventario | activo | Según asiento | No | Entrada y salida de mercancía |
| `iva_descontable` | IVA descontable | activo | No | No | IVA pagado en compras |
| `retenciones_a_favor` | Retenciones a favor | activo | Según asiento | No | Retenciones que te practicaron |
| `cobro_cartera` | Cobro de cartera | ingreso | Sí | No | Cobro de una factura a crédito |
| `iva_por_pagar` | IVA por pagar | pasivo | No | No | IVA cobrado en ventas |
| `retenciones_por_pagar` | Retenciones por pagar | pasivo | Según asiento | No | Retenciones que practicaste |
| `pago_cartera` | Pago de cartera | gasto | Sí | No | Pago de una factura a crédito |

> **Por qué importa el código:** si un usuario renombra “Costo de ventas” a
> “Costo de mercancía vendida”, los reportes siguen funcionando porque buscan
> `costo_ventas`. Es una lección de diseño: **los identificadores estables no se
> renombran**.

---

## 5. Ciclo de venta

### 5.1 Fórmulas de una línea

```
bruto      = cantidad × precio_unitario
descuento  = bruto × (descuento_pct / 100)
base       = bruto − descuento
IVA        = base × (impuesto_pct / 100)
total      = base + IVA
total_neto = total − retención_fuente − retención_ica − retención_iva
```

Ejemplo: 2 unidades a 100.000, descuento 10 %, IVA 19 %.

| Concepto | Valor |
|---|---|
| Bruto | 200.000 |
| Descuento (10 %) | 20.000 |
| Base | 180.000 |
| IVA (19 %) | 34.200 |
| **Total factura** | **214.200** |

### 5.2 Venta de contado

Asientos al confirmar (costo unitario del producto: 60.000):

| Asiento | Tipo | Monto | ¿Caja? | ¿Resultado? |
|---|---|---|---|---|
| Ventas | ingreso | 180.000 | Sí | Sí |
| IVA por pagar | pasivo | 34.200 | No | No |
| Costo de ventas | gasto | 120.000 | No | Sí |

- **Resultado**: 180.000 − 120.000 = **60.000** de utilidad bruta.
- **Caja del sistema**: +180.000 (el IVA se registra aparte).
- **Inventario**: −2 unidades; el costo histórico queda en el movimiento.

Margen bruto = 60.000 / 180.000 = **33,3 %**.

### 5.3 Venta a crédito

Mismos asientos, pero el de ventas lleva `afecta_caja = 0`:

| Momento | Efecto |
|---|---|
| Confirmar factura | + ingreso 180.000, + IVA por pagar 34.200, + CxC 214.200, − inventario |
| Cobrar | + caja 214.200, − CxC 214.200, **sin nuevo ingreso** |

La cuenta por cobrar es por el **total neto** (total − retenciones), no por la
base. Si el cliente practica retenciones, el saldo y el dinero recibido bajan.

### 5.4 Retenciones

Son anticipos de impuestos que el pagador descuenta:

- En una **venta**, son un **activo a favor** de la empresa que vende.
- En una **compra**, son un **pasivo por pagar** de la empresa que compra.

Ejemplo de venta con retención de fuente 6.300 e ICA 1.800:

```
total factura       214.200
− retenciones         8.100
= total neto        206.100   ← lo que realmente cobra
```

La retención de IVA no mueve caja porque el IVA tampoco forma parte del capital
operativo del sistema. En el resultado, las retenciones **no reducen el
ingreso**: el ingreso sigue siendo la base completa (180.000). Las reglas
colombianas, tarifas y declaraciones se explican en la sección 10.

### 5.5 Notas crédito y débito

- **Nota crédito**: reduce la factura (devolución, descuento posterior, error).
  Devuelve stock y revierte el costo de ventas.
- **Nota débito**: aumenta la factura (cargo adicional). Solo mueve stock si se
  marca `afecta_stock`.
- Se registran con el **mismo asiento en negativo** para que todos los reportes
  (resultado, caja, balance, cartera, presupuestos) neteen solos.
- No se borran: se anulan con contrapartida.
- Una nota crédito no puede superar el total de la factura ni devolver más
  cantidad de la facturada.

---

## 6. Ciclo de compra

### 6.1 El ejemplo de la factura con descuento

Subtotal 480.000, descuento 40 % (192.000), IVA 19 %, total 342.720. La decisión
del sistema es:

- **Inventario se valora al precio bruto**: 480.000.
- **La caja sale por el neto de la base**: 288.000.
- **El descuento se reconoce como ingreso**: 192.000 (“Descuentos obtenidos”).
- **El IVA es un activo**: 54.720 (“IVA descontable”).

Asientos al confirmar (compra de contado):

| Asiento | Tipo | Monto | ¿Caja? | ¿Resultado? |
|---|---|---|---|---|
| Inventario (valor bruto) | activo | 480.000 | No | No |
| Salida de caja (base neta) | activo | 288.000 | Sí (resta) | No |
| Descuentos obtenidos | ingreso | 192.000 | No | Sí |
| IVA descontable | activo | 54.720 | No | No |

**¿Por qué no bajar el inventario a 288.000?** Porque el costo de referencia del
producto debe reflejar el precio de lista, y el descuento es un **resultado de
la gestión de compras**, no una propiedad del artículo. Así se puede medir
“cuánto ahorré comprando” sin distorsionar el costo de venta. Es una decisión
discutible: la otra escuela valora el inventario al neto y no separa el ingreso.
Las dos son válidas si se aplican de forma consistente.

### 6.2 Compra a crédito

| Momento | Efecto |
|---|---|
| Confirmar | + inventario 480.000, + IVA descontable 54.720, + descuento 192.000, + CxP 342.720; **caja 0** |
| Pagar | − caja 342.720, − CxP 342.720 |

La cuenta por pagar es por el total neto de retenciones. Si la empresa practica
retenciones al proveedor, paga menos dinero y registra un pasivo con el fisco.

### 6.3 Contado vs. crédito en una tabla

| Concepto | Contado | Crédito |
|---|---|---|
| Inventario | + 480.000 | + 480.000 |
| IVA descontable | + 54.720 | + 54.720 |
| Descuento obtenido | + 192.000 | + 192.000 |
| Caja | − 288.000 | 0 |
| Cuenta por pagar | 0 | + 342.720 |
| Efecto en utilidad | + 192.000 | + 192.000 |

Curiosidad contable: el descuento **mejora la utilidad** aunque no entre dinero.
La utilidad no es caja; es el valor creado en la operación.

### 6.4 Devolución de compra

Una nota crédito de compra saca stock (o lo devuelve, según el flujo), revierte
el IVA descontable y reduce la cuenta por pagar. Nunca se edita la factura
original.

---

## 7. Inventario y costo

### 7.1 Tres costos que conviene no confundir

| Costo | Dónde vive | Para qué sirve |
|---|---|---|
| **Costo de referencia** | `products.costo` | Valorar el inventario en el balance y calcular márgenes estimados |
| **Costo histórico** | `stock_movements.costo_unitario` | Costo real de la salida; base del costo de ventas |
| **Costo neto de compra** | `precio × (1 − descuento)` | Referencia de negociación (no se usa para el asiento) |

Regla del sistema (M1): **una compra no sobrescribe `products.costo`**. Solo se
cambia editando el producto. Eso evita que el costo de los productos viejos
“salte” con cada compra y permite comparar el costo planeado con el real.

### 7.2 Costo de ventas

El costo de ventas usa el **costo histórico del movimiento de salida**:

- Venta directa: `products.costo` en el momento de la salida.
- Factura desde cotización ya entregada: el costo guardado en la entrega.
- Si la factura ajusta cantidades, se prorratea el costo entre lo cubierto y el
  excedente.

El descuento de compra **no reduce el costo de ventas**: el costo unitario sigue
siendo el precio del artículo. El ahorro ya se reconoció como “Descuentos
obtenidos”.

### 7.3 Valoración del inventario en el balance

```
valor inventario = Σ (stock_actual × products.costo)
```

Se toma del maestro de productos, no del asiento de inventario. Consecuencia: si
el costo del producto está desactualizado o en cero, el balance se aleja de la
realidad. El panel de **Salud de datos** marca los productos con stock y costo
cero.

### 7.4 Lo que falta: costo promedio ponderado

Hoy el costo es un valor fijo por producto. Si compras el mismo artículo a
10.000 y luego a 12.000, el costo de venta no se mezcla: sigue el que tenga el
producto. El promedio ponderado (o FIFO) resolvería esto, pero cambia cálculos
históricos y exige un kardex valorado. Está deliberadamente pospuesto.

**Efecto práctico actual:** cuando los precios de compra cambian mucho, el margen
por producto puede quedar distorsionado. Para detectarlo, compara el costo de
referencia con el último costo de compra.

### 7.5 Métricas de inventario

```
rotación            = costo de ventas del periodo / valor del inventario
días de inventario  = días del periodo / rotación
stock muerto        = stock > 0 y sin ventas en los últimos N días (por defecto 90)
ABC                 = acumulado de ingresos: A ≤ 80 %, B ≤ 95 %, C el resto
```

Interpretación:

- Rotación alta: vendes rápido; menos dinero inmovilizado (pero cuidado con
  quedarte sin stock).
- Días de inventario altos: capital atrapado en bodega.
- ABC: pocos productos explican la mayoría de los ingresos; prioriza su
  disponibilidad y control.

---

## 8. Cartera: cuentas por cobrar y por pagar

### 8.1 Saldo de una factura

```
saldo = total_neto + notas_débito − notas_crédito − pagos_válidos
```

- Solo las facturas **confirmadas a crédito** generan cartera.
- Los pagos anulados no cuentan; se conservan para la historia.
- El saldo nunca baja de cero.

### 8.2 Estados

| Estado | Cuándo |
|---|---|
| `pendiente` | Saldo > 0, sin pagos y aún no vence |
| `parcial` | Hay algún pago, pero queda saldo |
| `pagada` | Saldo = 0 |
| `vencida` | Saldo > 0 y la fecha de vencimiento ya pasó |
| `no_aplica` | Borrador o anulada |

### 8.3 Aging (antigüedad de la deuda)

Se mide desde la fecha de vencimiento:

| Tramo | Lectura |
|---|---|
| Corriente | Aún no vence |
| 1–30 días | Mora leve |
| 31–60 días | Mora media |
| 61–90 días | Mora alta |
| +90 días | Crítica; probable incobrable |

El aging es la base de las alertas de cartera. Una factura abierta genera **una
sola alerta** según su peor condición, no varias.

### 8.4 DSO (días de cartera)

```
DSO = (cartera por cobrar / ventas a crédito del periodo) × días del periodo
```

Responde: “¿cuántos días de ventas a crédito tengo atrapados en cartera?”. Si el
DSO sube, o estás vendiendo más a crédito o estás cobrando más lento; hay que
separar las dos causas.

### 8.5 Pagos y cobros

- Un pago no puede superar el saldo ni registrarse en un borrador o anulada.
- Cada pago crea un asiento de caja (`cobro_cartera` o `pago_cartera`) con
  `afecta_resultado = 0`.
- Anular un pago genera contrapartida y deja el pago marcado como anulado.
- Para anular una factura, primero hay que revertir sus pagos.

---

## 9. Estados financieros

### 9.1 Estado de resultados (P&L)

Se construye con **devengo**: todo asiento con `afecta_resultado = 1`.

```
ingresos
− costo de ventas
= margen bruto
− gastos operativos
= utilidad
```

Porcentajes:

```
margen bruto % = margen bruto / ingresos × 100
utilidad %     = utilidad / ingresos × 100
```

Ejemplo:

| Línea | Valor | % ingresos |
|---|---|---|
| Ingresos | 1.000.000 | 100 % |
| Costo de ventas | 600.000 | 60 % |
| **Margen bruto** | **400.000** | **40 %** |
| Gastos operativos | 250.000 | 25 % |
| **Utilidad** | **150.000** | **15 %** |

Lecturas útiles:

- Una venta a crédito **sí** aparece aquí, aunque no haya entrado dinero.
- Un cobro de cartera **no** aparece aquí: solo mueve caja.
- El costo de ventas se separa de los gastos para ver la rentabilidad de la
  operación antes de la estructura.
- Las notas crédito restan y las débito suman automáticamente.
- Los impuestos anuales (renta, ICA) **no se causan solos**: la app no los
  registra. Si quieres utilidad después de impuestos, agrega el gasto en la
  categoría `impuestos` o haz el ajuste en tu análisis.

### 9.2 Balance

Foto a una fecha (devengo acumulado):

| Activo | Pasivo |
|---|---|
| Caja y bancos | Cartera por pagar |
| Inventario (stock × costo) | IVA por pagar (neto) |
| Cartera por cobrar | Retenciones por pagar |
| IVA a favor | |
| Retenciones a favor | **Patrimonio = Activo − Pasivo** |

Detalles del sistema:

- La caja se calcula con los asientos que afectan caja; **no** es el saldo del
  banco si hay IVA o partidas en tránsito.
- El inventario se toma del maestro (`stock × costo`), no del asiento.
- El IVA se netea: `IVA por pagar − IVA descontable`. Si el resultado es
  positivo, es pasivo; si es negativo, activo a favor.
- La cartera se calcula con pagos válidos y notas.
- La ecuación se verifica al final: `activo = pasivo + patrimonio`.

### 9.3 Flujo de caja

Método directo, por cuenta y por mes:

```
entradas = ingresos + pasivos que afectan caja
salidas  = gastos + activos que afectan caja
neto     = entradas − salidas
saldo    = saldo inicial + neto
```

Solo entran asientos con `afecta_caja = 1`. Por eso:

- Una venta a crédito **no** aparece hasta el cobro.
- Una compra de inventario **sí** aparece como salida (es un activo que se paga).
- El costo de ventas **no** aparece (ya salió el dinero al comprar).
- El IVA no aparece como movimiento propio.

### 9.4 Por qué utilidad ≠ caja

| Hecho | Utilidad | Caja |
|---|---|---|
| Venta a crédito | + | 0 |
| Cobro de esa venta | 0 | + |
| Compra de inventario | 0 | − |
| Venta del inventario | + margen | 0 |
| Costo de ventas | − | 0 |
| Pago de una deuda | 0 | − |
| IVA | 0 | 0 (se registra aparte) |

Reconciliación indirecta:

```
utilidad
+ gastos que no movieron caja (costo de ventas)
− aumento de inventario
− aumento de cartera
+ aumento de cuentas por pagar
= cambio de caja
```

### 9.5 La convención de caja y el IVA (importante)

El sistema toma una decisión explícita: **el IVA no forma parte del capital de
caja** que muestran los reportes operativos.

- En una factura **de contado**, la caja se mueve por la base (sin IVA).
- En una factura **a crédito**, el cobro o pago mueve el **total neto**, que
  incluye el IVA.

Esto tiene dos consecuencias al estudiar los reportes:

1. El “capital disponible” no equivale al saldo del banco cuando hay IVA
   pendiente. El IVA vive aparte como activo o pasivo.
2. Al conciliar el banco, una compra de contado puede mostrar una diferencia
   igual al IVA: el extracto trae el pago completo y el sistema solo registró la
   base como movimiento de caja. Es una **diferencia explicada**, no
   necesariamente un error.

En una empresa real, el IVA sí sale y entra del banco. La forma de mantener la
coherencia es registrar el pago del IVA como un movimiento propio (pasivo contra
caja). Esta aplicación lo deja fuera a propósito para que la utilidad y el
margen no se contaminen con impuestos; es una simplificación útil para gestión,
pero insuficiente para una contabilidad tributaria formal.

---

## 10. Impuestos y retenciones en Colombia

> Esta sección conecta los campos de la factura con la realidad tributaria
> colombiana. Las tarifas son **referencia 2026** (UVT: $52.374) y cambian por
> decreto o reforma. La aplicación **no calcula ni valida** tarifas: los valores
> se digitan a mano. Antes de facturar, confirma con tu contador.

### 10.1 Cuatro figuras que no son lo mismo

| Figura | Qué es | Quién lo recibe | Base | Tarifa de referencia 2026 |
|---|---|---|---|---|
| **IVA** | Impuesto al consumo | DIAN | Base de la línea (sin IVA) | 19 % general; 5 % y bienes excluidos o exentos según el caso |
| **Retefuente** | Anticipo del impuesto de renta | DIAN | Valor antes de IVA | Compras 2,5 % (proveedor declarante) o 3,5 % (no declarante); servicios 4 % o 6 %; honorarios 10–11 %; arriendo de inmuebles 3,5 % |
| **ReteICA** | Anticipo del ICA municipal | Municipio | Valor antes de IVA | Tarifa por mil de la actividad, definida por cada municipio |
| **ReteIVA** | Anticipo del IVA | DIAN | **Valor del IVA**, no la base | 15 % del IVA; 100 % en casos especiales |

Dos ideas ordenan todo lo demás:

- **El IVA se traslada.** Lo paga el consumidor final; la empresa solo lo
  recauda (ventas) o lo soporta como crédito fiscal (compras) y lo declara.
- **La retención es un anticipo.** No es un impuesto nuevo ni un gasto: es
  dinero que quien paga descuenta y consigna a nombre de quien recibe.

### 10.2 Quién retiene a quién

No toda empresa es agente de retención; serlo depende de la ley, no de la
voluntad:

| Retención | Quién la practica | Detalle |
|---|---|---|
| Retefuente | Agentes designados por el art. 368 del E.T. (en la práctica, casi toda persona jurídica) | Aplica a pagos por compras, servicios, honorarios, arriendos, rendimientos, etc. |
| ReteICA | Los agentes que designe cada municipio | Es facultativa por municipio; la tarifa sigue la actividad del vendedor |
| ReteIVA | Solo los agentes del art. 437-2 del E.T.: Estado, grandes contribuyentes, designados por la DIAN y compras a Régimen Simple | Una pyme normal **no** retiene IVA en compras locales |
| Autorretención | El propio contribuyente se retiene | La autorretención especial de renta se liquida por actividad económica; no la practica un tercero |

Consecuencia práctica: antes de digitar una retención, revisa el **RUT** de las
dos partes (régimen, responsabilidades, calidades) y las reglas del municipio.
Retener de más es tan problemático como retener de menos: se le quita dinero al
proveedor sin respaldo legal.

### 10.3 Cómo se calculan (ejemplo completo)

Venta de servicios por 1.000.000 + IVA 19 %, a un cliente que es agente
retenedor:

| Concepto | Cálculo | Valor |
|---|---|---|
| Base | — | 1.000.000 |
| IVA | 1.000.000 × 19 % | 190.000 |
| Retefuente | 1.000.000 × 4 % (servicios, declarante) | 40.000 |
| ReteICA | 1.000.000 × 1 % (ejemplo) | 10.000 |
| ReteIVA | 190.000 × 15 % | 28.500 |
| **Total factura** | 1.000.000 + 190.000 | **1.190.000** |
| **Retenciones** | 40.000 + 10.000 + 28.500 | **78.500** |
| **Total neto** | 1.190.000 − 78.500 | **1.111.500** |

Ahora compara las tres “cajas”:

| Vista | Valor | Por qué |
|---|---|---|
| Extracto bancario (contado) | 1.111.500 | El cliente paga el total menos todo lo retenido |
| Caja del sistema | 950.000 | Registra la base menos fuente e ICA; el IVA vive aparte (9.5) |
| Diferencia | 161.500 | Exactamente el IVA neto: 190.000 − 28.500 |
| Cartera (si es a crédito) | 1.111.500 | Se cobra el total neto, con IVA incluido, al vencer |

Y en el resultado: el ingreso sigue siendo **1.000.000**. Las retenciones no lo
reducen; solo cambian el momento y el monto del dinero.

### 10.4 Dónde queda cada retención

| Situación | Cuenta | Tipo | Efecto |
|---|---|---|---|
| Te practican retención en una venta | `retenciones_a_favor` | activo | Saldo a favor contra la DIAN o el municipio |
| Practicas retención en una compra | `retenciones_por_pagar` | pasivo | Deuda con la DIAN o el municipio |
| ReteIVA en venta | `retenciones_a_favor` | activo | Se resta en la declaración de IVA |
| ReteIVA en compra | `retenciones_por_pagar` | pasivo | Se declara en el formulario 350 |

Ejemplo de compra por 1.000.000 + IVA 190.000, practicando 2,5 % de retefuente:

```
total factura        1.190.000
− retefuente            25.000
= pago al proveedor   1.165.000
```

Si además fueras agente de reteIVA, retendrías 28.500 (15 % de 190.000) y
pagarías 1.136.500. En ambos casos el inventario entra por 1.000.000, el IVA
descontable por 190.000 y las retenciones quedan como pasivo.

**La retención no es gasto.** El gasto es el impuesto real cuando se causa
(renta, ICA). La app registra la retención como activo o pasivo y deja el
impuesto anual por fuera: si quieres ver utilidad después de impuestos, registra
un gasto manual en la categoría `impuestos` o haz el ajuste en tu análisis.

### 10.5 Qué se declara y cuándo

| Obligación | Formulario | Periodicidad | Plazo típico |
|---|---|---|---|
| Retenciones (renta, IVA, timbre) | 350 | Mensual | Día hábil 7 al 16 del mes siguiente, según el último dígito del NIT |
| IVA | 300 | Bimestral si los ingresos del año anterior alcanzan 92.000 UVT; si no, cuatrimestral | Día hábil 7 al 16, según el NIT |
| ICA | Municipal | Bimestral o anual, según el municipio | Calendario de la secretaría de hacienda |
| Renta | 110 (personas jurídicas) | Anual | Calendario DIAN del año siguiente |
| Información exógena | Formatos de la resolución vigente | Anual | Según resolución |

Detalles que evitan errores:

- Si en el mes no hubo retenciones, no se presenta el 350.
- Los **certificados de retención** se emiten cada año y son el soporte del saldo
  a favor.
- Las **bases mínimas** se miden sobre el valor antes de IVA: 2 UVT en servicios
  (~$104.748) y 10 UVT en compras (~$523.740) con la UVT de 2026. Por debajo de
  la base no se retiene, y cada operación se mira por separado (no se suman
  compras del mismo proveedor).
- La tarifa general de renta para personas jurídicas es 35 % (verifica reformas
  vigentes); la app no la causa automáticamente.
- La facturación electrónica es obligatoria. Esta app **imprime** el documento,
  pero no lo transmite a la DIAN ni genera el CUFE.

### 10.6 Régimen Simple (SIMPLE)

- Sustituye renta e ICA por un impuesto único y, por regla general, no se le
  practica retefuente (art. 911 del E.T.).
- Pero **sí** se le practica reteIVA cuando el comprador es responsable de IVA
  (numeral 9 del art. 437-2), aunque no sea gran contribuyente. Es el caso que
  más se pasa por alto.
- No es lo mismo que el antiguo “régimen simplificado”, que desapareció con la
  Ley 1819 de 2016.

### 10.7 Qué hace y qué no hace la aplicación

**Sí hace:**

- Guarda `retencion_fuente`, `retencion_iva` y `retencion_ica` por factura.
- Calcula `total_neto = total − retenciones`.
- Genera los asientos de activo o pasivo y descuenta fuente e ICA del efectivo
  esperado.
- Usa el total neto en cartera y en la proyección de caja.

**No hace:**

- No calcula tarifas ni valida si la empresa es agente de retención.
- No emite certificados, no declara ni transmite a la DIAN.
- No causa renta ni ICA como gasto automático.
- No separa reteIVA de retefuente en el plan de cuentas: fuente + ICA van en un
  asiento y reteIVA en otro, ambos dentro de la misma cuenta de retenciones.

Errores frecuentes:

| Error | Corrección |
|---|---|
| Aplicar 2,5 % sobre el total con IVA | La base es el valor antes de IVA |
| Tratar la retención como descuento comercial | No reduce el ingreso; es un anticipo |
| Retener IVA sin ser agente | Revisa el art. 437-2 y tu RUT |
| Sumar compras para superar la base mínima | Cada pago se evalúa solo |
| Olvidar la reteICA | Es municipal y depende de la actividad del vendedor |
| Cuadrar caja contra el banco sin separar el IVA | La diferencia es el IVA neto (ver 9.5) |

---

## 11. Presupuestos

Un presupuesto es un plan por **periodo** y **categoría** (o producto/categoría
de producto) con:

| Campo | Significado |
|---|---|
| `monto_planeado` | Cuánto se espera gastar (o ingresar) en la categoría |
| `real` | Suma de asientos de esa categoría en el periodo |
| `disponible` | `planeado − real` |
| `ejecución %` | `real / planeado × 100` |
| `alerta_pct` | Umbral a partir del cual se marca “alerta” (por defecto 80 %) |
| `ingreso_meta` | Meta global de ingresos del periodo |

Estados de una línea:

- `ok`: ejecución por debajo del umbral.
- `alerta`: superó el umbral pero no el 100 %.
- `excedido`: gastó más de lo planeado.

Matiz importante: en **gastos**, superar el 100 % es malo; en **ingresos**,
superar la meta es bueno. El sistema cambia el color y el texto según la
naturaleza de la categoría.

El presupuesto **no bloquea** la operación: informa y alerta. Lo que bloquea es
el **cierre del periodo**.

---

## 12. Cierres y conciliación bancaria

### 12.1 Cierre de periodo

- Cubre un rango de fechas (normalmente un mes).
- Guarda un **snapshot** inmutable: resumen, facturas, cartera y retenciones.
- Mientras está vigente, **no se pueden registrar transacciones** con fecha
  dentro del rango (ni manuales ni automáticas).
- Reabrir exige motivo y queda auditado; no borra el cierre anterior.
- Volver a cerrar crea un registro nuevo.

### 12.2 Cierre de ejercicio

- Cubre el año completo (1 de enero a 31 de diciembre).
- Congela el resultado del año y el balance al 31 de diciembre.
- **No genera asientos de cierre ni de apertura**: el patrimonio se sigue
  derivando de `activo − pasivo`.
- Puede convivir con cierres mensuales; reabrir el año no reabre los meses.
- Años permitidos: 2000 hasta el año actual.

### 12.3 Conciliación bancaria

Compara dos fuentes:

- **Sistema**: asientos que afectan caja en una cuenta y periodo.
- **Extracto**: líneas que informa el banco, con signo (positivo entra,
  negativo sale).

Proceso:

1. Se elige cuenta y periodo, con saldos inicial y final del extracto.
2. Se cargan las líneas del extracto.
3. El sistema sugiere cruces por **mismo importe firmado** y tolerancia de
   fechas.
4. Las líneas que no tienen asiento se marcan como **partida conciliatoria** o
   se ignoran con una nota.
5. Se cierra cuando todas las líneas están resueltas y el saldo final cuadra.

Regla de oro: **conciliar no contabiliza**. Si falta un asiento (una comisión
bancaria, por ejemplo), se registra aparte como transacción; la conciliación
solo deja evidencia del cruce.

Diferencias típicas en la vida real:

- Cheques emitidos y no cobrados.
- Transferencias en tránsito.
- Comisiones y rendimientos que el banco cobra o abona sin avisar.
- Errores de digitación.
- Diferencias por IVA (ver 9.5).

---

## 13. Analítica y reportes

### 13.1 Rentabilidad por producto, categoría o cliente

Al confirmar una venta, el ingreso y el costo de ventas se reparten por línea en
`transaction_allocations`. Así se puede calcular:

```
margen = ingresos − costo de ventas
margen % = margen / ingresos × 100
participación = ingresos del grupo / ingresos totales × 100
```

Ventaja: el margen usa el **costo histórico** del momento de la venta, no el
costo actual. Si el producto cambió de costo después, el reporte histórico no se
distorsiona.

Lecturas:

- Un cliente con mucha facturación y margen bajo puede ser menos rentable que
  uno pequeño con buen margen.
- Un producto “estrella” en ventas puede estar subsidiando a otros si su margen
  es negativo.
- La categoría agrupa el comportamiento del catálogo.

### 13.2 Embudo de cotizaciones

Etapas: **creadas → enviadas → aprobadas → entregadas**.

```
tasa de conversión = etapa actual / etapa anterior × 100
tasa global        = etapa actual / creadas × 100
días de aprobación = fecha aprobación − fecha creación
días de entrega    = fecha entrega − fecha aprobación
días de ciclo      = fecha entrega − fecha creación
```

Sirve para responder: ¿el problema es que no enviamos suficientes propuestas, que
no las aprueban o que tardamos en entregar? Cada etapa tiene una palanca
distinta.

### 13.3 Tendencias

Serie mensual con ingresos, costo de ventas, margen, gastos, utilidad, entradas,
salidas, neto y saldo de caja. Incluye variación mes a mes.

Cuidado con las comparaciones: un mes con menos días hábiles o con una compra
grande de inventario puede distorsionar la lectura. Separa **resultado** de
**caja**.

### 13.4 Comparación de periodos

El resumen financiero compara contra el periodo calendario anterior (o un bloque
de igual duración si el rango es libre). Regla: si la base es cero, no se muestra
un porcentaje infinito; se indica “sin base de comparación”.

### 13.5 Exportación y auditoría

- CSV con valores numéricos sin formato, para sumar en Excel.
- PDF como vista imprimible del navegador.
- Toda operación sensible (pagos, cierres, conciliaciones, presupuestos,
  empresa) queda en `audit_log` con usuario, antes y después.

---

## 14. Indicadores y fórmulas (chuleta)

| Indicador | Fórmula | Qué mide |
|---|---|---|
| Margen bruto | `ingresos − costo de ventas` | Rentabilidad de la operación |
| Margen bruto % | `margen bruto / ingresos × 100` | Eficiencia antes de gastos |
| Utilidad | `margen bruto − gastos` | Resultado final del periodo |
| Utilidad % | `utilidad / ingresos × 100` | Rentabilidad neta |
| Rotación de inventario | `costo de ventas / valor inventario` | Veces que el inventario se renueva |
| Días de inventario | `días del periodo / rotación` | Días que tarda en venderse |
| DSO | `(cartera / ventas a crédito) × días` | Días promedio de cobro |
| Aging | saldo por tramos de mora | Calidad de la cartera |
| Ejecución de presupuesto | `real / planeado × 100` | Avance vs. plan |
| Participación | `parte / total × 100` | Peso relativo |
| Variación | `(actual − anterior) / abs(anterior) × 100` | Cambio porcentual |
| Contribución marginal | `precio − costos variables` | Aporte de cada venta a los costos fijos |
| Punto de equilibrio | `costos fijos / margen de contribución %` | Ventas mínimas para no perder |
| Costo anual del crédito | `(d / (1 − d)) × (365 / días)` | Comparar un descuento con la tasa propia |
| Capital de caja | saldos iniciales + movimientos de caja | Dinero disponible operativo |
| IVA neto | `IVA por pagar − IVA descontable` | Posición fiscal del periodo |

---

## 15. Reglas de oro del sistema

1. Una factura a crédito **no aumenta la caja** al confirmarse; genera cartera.
2. Una compra a crédito **no reduce la caja** al confirmarse; genera cuenta por
   pagar.
3. Un pago o cobro **no supera el saldo** ni se registra en borradores o
   anuladas.
4. Anular un pago genera **contrapartida**; no se borra.
5. Anular una factura exige **revertir sus pagos** primero.
6. Las retenciones reducen el **valor neto** a cobrar/pagar; no reducen el
   ingreso.
7. El P&L usa `afecta_resultado`; el flujo de caja usa `afecta_caja`.
8. Los **códigos de sistema** no se renombran.
9. El costo de ventas **no mueve caja** dos veces.
10. Las compras de inventario son **activo**, no gasto.
11. Los reportes se exportan con los **filtros activos**.
12. La conciliación **no modifica** la contabilidad.
13. Un cierre **congela**: no se registran asientos dentro del periodo cerrado.
14. Reabrir **no borra**: deja historial y motivo.
15. Toda operación sensible queda en **auditoría**.

---

## 16. Mitos y errores frecuentes

| Mito | Realidad |
|---|---|
| “Utilidad = dinero en el banco” | La utilidad es devengo; la caja es liquidez. Una venta a crédito da utilidad sin caja. |
| “Facturar es cobrar” | Facturar reconoce el ingreso; cobrar mueve caja y baja cartera. |
| “El IVA es ingreso” | Es dinero de terceros: pasivo (ventas) o activo (compras). |
| “Comprar mercancía es gasto” | Es un activo; el gasto llega al vender (costo de ventas). |
| “Pagar una deuda es gasto” | Es un movimiento de caja que baja un pasivo; el gasto ya se reconoció al comprar. |
| “Un descuento siempre baja el costo” | En este sistema el inventario se mantiene al bruto y el descuento es ingreso. Es una decisión, no una ley. |
| “El saldo del banco es la utilidad” | El banco incluye IVA, préstamos y movimientos de capital. |
| “Anular es borrar” | Se conserva la historia con una contrapartida. |
| “El stock es dinero disponible” | Es un activo; para convertirlo en caja hay que venderlo. |
| “El precio de venta es el margen” | El margen es precio − costo; el precio solo es el ingreso. |

---

## 17. Caso práctico completo de un mes

Supongamos una empresa que arranca el mes con:

- Caja: 1.000.000
- Inventario: 0
- Patrimonio: 1.000.000

Y hace estas operaciones:

1. Compra **100 unidades** a 6.000 brutos, descuento 10 %, IVA 19 %, a crédito
   30 días.
2. Vende **40 unidades** a 10.000, descuento 5 %, IVA 19 %, a crédito.
3. Paga al proveedor el total.
4. Cobra al cliente el total.
5. Paga arriendo por 100.000 en efectivo.

### Paso 1: compra

```
bruto        600.000
descuento     60.000
base         540.000
IVA          102.600
total        642.600
```

| Cuenta | Movimiento |
|---|---|
| Inventario | + 600.000 |
| Descuento obtenido | + 60.000 |
| IVA descontable | + 102.600 |
| Cuenta por pagar | + 642.600 |
| Caja | 0 |

### Paso 2: venta

```
bruto        400.000
descuento     20.000
base         380.000
IVA           72.200
total        452.200

costo de ventas = 40 × 6.000 = 240.000
```

| Cuenta | Movimiento |
|---|---|
| Ingreso por ventas | + 380.000 |
| IVA por pagar | + 72.200 |
| Cuenta por cobrar | + 452.200 |
| Inventario | − 240.000 |
| Costo de ventas | + 240.000 |

### Paso 3: pago al proveedor

Caja − 642.600; cuenta por pagar − 642.600.

### Paso 4: cobro al cliente

Caja + 452.200; cuenta por cobrar − 452.200.

### Paso 5: arriendo

Caja − 100.000; gasto por arriendo + 100.000.

### Resultado del mes (P&L)

| Línea | Valor |
|---|---|
| Ingresos por ventas | 380.000 |
| Descuentos obtenidos | 60.000 |
| **Ingresos totales** | **440.000** |
| Costo de ventas | − 240.000 |
| **Margen bruto** | **200.000** |
| Arriendo | − 100.000 |
| **Utilidad** | **100.000** |

### Caja del mes

| Movimiento | Valor |
|---|---|
| Caja inicial | 1.000.000 |
| Pago proveedor | − 642.600 |
| Cobro cliente | + 452.200 |
| Arriendo | − 100.000 |
| **Caja final** | **709.600** |

### Balance al cierre

| Activo | Valor |
|---|---|
| Caja | 709.600 |
| Inventario (60 × 6.000) | 360.000 |
| IVA a favor (102.600 − 72.200) | 30.400 |
| **Total activo** | **1.100.000** |

| Pasivo y patrimonio | Valor |
|---|---|
| Cuentas por pagar | 0 |
| IVA por pagar | 0 |
| **Patrimonio** | **1.100.000** |

Comprobación: `1.100.000 = 0 + 1.100.000`. ✔

### La lección del caso

- La utilidad fue **100.000**, pero la caja subió **−290.400** (de 1.000.000 a
  709.600).
- La diferencia se explica por **390.400** de activos no monetarios:

```
utilidad                          100.000
− aumento de inventario          − 360.000
− aumento de IVA a favor         −  30.400
= cambio de caja                 − 290.400
```

Ese es el corazón de la diferencia entre **resultado** y **liquidez**.

---

## 18. Casos de decisión empresarial

La contabilidad registra **lo que pasó**; las finanzas deciden **lo que va a
pasar**. Los reportes de la app son la materia prima, pero una decisión necesita
tres datos que ningún reporte trae por sí solo: la **tasa de oportunidad** del
dinero, la **probabilidad** de cada escenario y la **alternativa** que se deja de
lado.

### 18.1 El marco en cinco preguntas

1. ¿Cuál es el **flujo incremental**? Solo cuenta lo que cambia con la decisión.
2. ¿Cuánto cuesta el dinero? Esa es la **tasa de oportunidad** (deuda, capital
   propio o ambos).
3. ¿Cuándo vuelve el dinero? Plazo, DSO, rotación.
4. ¿Qué puede salir mal y con qué probabilidad? Riesgo.
5. ¿Cuál es la **mejor alternativa**? El costo de oportunidad es un costo real.

Regla práctica: si el rendimiento de la decisión no supera la tasa de
oportunidad **ajustada por riesgo**, no conviene, aunque la utilidad contable sea
positiva.

### 18.2 ¿Vender a crédito a este cliente?

Datos: venta 10.000.000, costo 7.000.000 (margen 3.000.000, 30 %), plazo 60
días, tasa de oportunidad 24 % anual, probabilidad estimada de pago 85 %.

```
costo financiero = 10.000.000 × 24 % × 60/365 ≈ 394.500
utilidad esperada = 85 % × 3.000.000 − 15 % × 7.000.000 − 394.500
                  = 2.550.000 − 1.050.000 − 394.500 = 1.105.500
```

La venta conviene **si el 85 % es real**. ¿Y si no? El punto de equilibrio de la
probabilidad de pago:

```
p × 3.000.000 − (1 − p) × 7.000.000 = 394.500
10.000.000 p = 7.394.500   →   p ≈ 73,9 %
```

Necesitas al menos ~74 % de certeza de cobro. Por debajo, el riesgo de pérdida
se come el margen. El costo financiero se calcula sobre el **valor de la venta
inmovilizado en cartera**, no sobre el margen.

Dónde mirar: **Cartera → aging, DSO y top deudores**. La app no tiene tasa de
capital ni probabilidad: se estiman por fuera y se documentan.

### 18.3 ¿Tomar el descuento por pronto pago?

El proveedor ofrece **2/10 neto 30**: 2 % de descuento si pagas a 10 días en
lugar de 30.

```
costo anual del crédito del proveedor = (0,02 / 0,98) × (365 / 20) ≈ 37,2 %
```

Si tu capital cuesta 24 %, **conviene tomar el descuento**: financiarte con el
proveedor es más caro que financiarte con tu propia estructura. Si tu capital
costara 40 %, no.

Fórmula general:

```
costo anual = (d / (1 − d)) × (365 / (plazo − días de descuento))
```

Ojo con el flujo de caja: tomar el descuento exige pagar antes; si el dinero no
está disponible, el ahorro puede convertirse en un problema mayor.

### 18.4 ¿Comprar volumen con descuento?

Datos: demanda 100 unidades/mes a 10.000; oferta de 10 % comprando 3 meses (300
unidades). Ahorro: 300.000. Costo de mantener inventario: 24 % de capital + 8 %
de bodegaje y obsolescencia = 32 % anual.

```
inventario extra promedio = 300 / 2 = 150 unidades × 10.000 = 1.500.000
costo de mantener = 1.500.000 × 32 % × 3/12 = 120.000
beneficio neto = 300.000 − 120.000 = 180.000
```

Conviene, salvo que el producto sea perecedero o de moda. El punto de equilibrio
del costo de mantener es altísimo: `300.000 / (1.500.000 × 0,25) = 80 % anual`.
La decisión se rompe por **caja**, no por rentabilidad: pagas 2.700.000 hoy en
lugar de 1.000.000 mensuales.

### 18.5 ¿Bajar el precio para vender más?

Precio 100, costo variable 60 → contribución 40 (40 %). Si bajas 10 % (precio
90), la contribución cae a 30. Para mantener la misma contribución total:

```
volumen necesario = 40 / 30 = 1,333  →  necesitas 33 % más unidades
```

Si el mercado solo responde 15 %, pierdes. Y hay un costo estratégico: el
descuento enseña al cliente a esperar la próxima rebaja.

Cuidado con la palabra “margen”: en la app el margen bruto usa el costo de
ventas; la contribución real debe restar también comisiones, fletes y empaque.

### 18.6 ¿Contratar un vendedor o abrir un canal?

Costo fijo nuevo: 4.000.000/mes. Margen de contribución: 30 %.

```
ventas de equilibrio = 4.000.000 / 0,30 = 13.333.333 al mes
```

Si el vendedor puede traer 10.000.000, destruye valor; si trae 20.000.000, lo
crea. El punto de equilibrio no es “cubrir el sueldo”: es cubrir el sueldo **y**
mantener la rentabilidad de la estructura.

Dónde mirar: **Presupuestos** para planear y **Resultados** para comparar el
real. La app no clasifica costo fijo y variable: hay que decidir qué categorías
son variables antes de calcular.

### 18.7 ¿Cuánto crédito darle a un cliente?

Un límite de crédito no se fija por “confianza”, sino por la pérdida que puedes
absorber. Si el cliente deja un margen anual esperado de 6.000.000 y en un
incumplimiento recuperas el 50 %:

```
exposición máxima ≈ margen anual esperado / (1 − recuperación)
                  = 6.000.000 / 0,50 = 12.000.000
```

Verificación por rotación: si compra 2.000.000/mes y el DSO objetivo es 60 días,
la exposición típica es `2.000.000 × 60/30 = 4.000.000`, holgada frente al
límite.

Dónde mirar: **Cartera → top deudores y aging**. La app no tiene campo de cupo
de crédito; el límite se controla con política y seguimiento manual.

### 18.8 ¿Anular la factura o emitir nota crédito?

| Situación | Decisión | Por qué |
|---|---|---|
| Error detectado antes de confirmar | Editar el borrador | Todavía no hay asientos ni stock |
| Factura confirmada, sin pagos, error total | Anular | Genera contrapartida y revierte todo |
| Factura confirmada con pagos | Revertir pagos y luego anular | No se puede anular con cartera viva |
| Devolución parcial o ajuste de precio | Nota crédito | Devuelve stock y revierte costo e IVA |
| Cargo adicional o mayor cantidad | Nota débito | Aumenta la factura; mueve stock solo si se marca |
| Cliente quiere “borrar” la factura | Nunca | La historia contable no se borra |

Regla de la app: una factura confirmada **no se edita ni se elimina**. Todo
cambio posterior es un documento nuevo con trazabilidad.

### 18.9 Errores de decisión que cuestan dinero

| Error | Qué pasa | Cómo evitarlo |
|---|---|---|
| Incluir costos hundidos | “Ya invertí 5 millones, no puedo parar” | Solo los flujos futuros son relevantes |
| Decidir con promedios | El promedio oculta el producto que pierde | Analiza por línea, cliente o canal |
| Ignorar el capital de trabajo | Crecer sin caja quiebra empresas rentables | Proyecta cartera e inventario junto con ventas |
| Confundir margen con markup | `markup = (P−C)/C`; `margen = (P−C)/P` | Con C=60 y P=100, markup 66,7 % y margen 40 % |
| Decidir por utilidad sin caja | La utilidad no paga nómina | Revisa siempre el flujo de caja |
| Anclarse en el costo de compra | “No vendo bajo 100 porque me costó 100” | El costo hundido no define el precio futuro |
| No medir el resultado | La misma decisión se repite mal | Compara el plan contra el real en Presupuestos |
| Mezclar caja de la empresa y personal | El patrimonio se distorsiona | Registra retiros como movimiento de patrimonio, no como gasto |

**Markup vs. margen:** si al costo de 60 le aplicas “40 % de markup”, vendes a
84 y tu margen real es 28,6 %, no 40 %. Para llegar a un margen del 40 % sobre
precio, el precio debe ser `60 / (1 − 0,40) = 100`.

### 18.10 Checklist antes de decidir

1. ¿Qué cambia en el flujo de caja si digo sí? ¿Y si digo no?
2. ¿Cuál es la tasa de oportunidad y el plazo?
3. ¿Cuál es el peor escenario y cuánto puedo perder?
4. ¿Qué dato de la app respalda la estimación? ¿Está actualizado?
5. ¿La decisión cambia el riesgo de concentración (cliente, producto, proveedor)?
6. ¿Cómo voy a medir en 30, 90 y 180 días si acerté?

> La app te da los datos; la decisión exige tres cosas que no están en ningún
> reporte: **tasa de oportunidad, probabilidad y alternativa**.

---

## 19. Glosario

- **Activo**: recurso con valor futuro (caja, inventario, cartera).
- **Agente de retención**: empresa obligada por ley a descontar y consignar
  impuestos a nombre de quien recibe el pago.
- **Aging**: clasificación de la cartera por días de mora.
- **Asiento**: registro contable de una operación.
- **Autorretención**: retención que el propio contribuyente se practica y
  declara; no la hace un tercero.
- **Base**: valor de la línea después del descuento y antes de impuestos.
- **Base gravable**: valor sobre el que se calcula un impuesto. En retenciones
  suele ser el valor antes de IVA.
- **Capital de caja**: saldo operativo disponible según los movimientos que
  afectan caja.
- **Cartera**: conjunto de cuentas por cobrar y por pagar.
- **Certificado de retención**: documento anual que acredita las retenciones
  practicadas; soporta el saldo a favor.
- **Contribución marginal**: precio menos costos variables; es lo que cada venta
  aporta para cubrir los costos fijos.
- **Costo de oportunidad**: rendimiento que se sacrifica al elegir una
  alternativa en lugar de otra.
- **Costo hundido**: dinero ya gastado que no cambia con la decisión; no debe
  entrar en el análisis.
- **Costo de ventas (COGS)**: costo del inventario que se vendió.
- **CxP / CxC**: cuenta por pagar / cuenta por cobrar.
- **Devengo**: reconocer el hecho cuando ocurre, no cuando se paga.
- **DSO**: días promedio de cobro.
- **Estado de resultados (P&L)**: ingresos, costos y gastos de un periodo.
- **Flujo de caja**: entradas y salidas reales de dinero.
- **Formulario 300 / 350 / 110**: declaraciones de IVA, retenciones y renta,
  respectivamente.
- **Margen bruto**: ingresos menos costo de ventas.
- **Markup**: porcentaje que se suma al costo para fijar el precio
  (`(P − C) / C`); no es lo mismo que el margen sobre precio.
- **Nota crédito**: documento que reduce una factura.
- **Nota débito**: documento que aumenta una factura.
- **Partida doble**: todo asiento tiene una contrapartida.
- **Pasivo**: obligación con terceros o con el fisco.
- **Patrimonio**: activo menos pasivo.
- **Punto de equilibrio**: ventas necesarias para cubrir los costos;
  `costos fijos / margen de contribución %`.
- **Régimen Simple (SIMPLE)**: régimen que sustituye renta e ICA por un impuesto
  único; no es el antiguo régimen simplificado.
- **Retefuente**: retención en la fuente a título de renta; anticipo del
  impuesto de renta.
- **ReteICA**: retención del impuesto municipal de industria y comercio.
- **ReteIVA**: retención del 15 % del IVA facturado (100 % en casos especiales).
- **Retención**: descuento de impuesto que practica quien paga.
- **Rotación**: veces que el inventario se renueva en un periodo.
- **RUT**: registro único tributario; allí constan régimen y responsabilidades
  de la empresa.
- **Snapshot**: copia congelada de los totales en un cierre.
- **Tasa de oportunidad**: rendimiento mínimo que se exige a una decisión para
  que valga la pena frente a la alternativa.
- **Total neto**: total de la factura menos retenciones.
- **UVT**: unidad de valor tributario; se usa para expresar bases y topes
  (2026: $52.374).
- **Vencimiento**: fecha límite de pago o cobro.

---

## 20. Mapa aplicación ↔ concepto

| Pantalla | Concepto contable | Para aprender |
|---|---|---|
| Productos | Costo, precio, stock | Diferencia entre costo y precio |
| Movimientos | Costo histórico, kardex | Cómo se valoran las salidas |
| Cotizaciones | Documento no contable | Devengo vs. intención comercial |
| Facturas | Asientos, IVA, retenciones, cartera | Ciclo completo de venta y compra |
| Facturas → Retenciones | Anticipos tributarios | Base sin IVA y reteIVA sobre el IVA |
| Finanzas → Resumen | Caja vs. resultado | Las dos miradas de la empresa |
| Finanzas → Resultados | P&L | Margen y utilidad |
| Finanzas → Balance | Ecuación contable | Activo, pasivo y patrimonio |
| Finanzas → Flujo de caja | Liquidez | Por qué la utilidad no es caja |
| Finanzas → Cartera | CxC/CxP, aging, DSO | Gestión de cobro y pago |
| Finanzas → Presupuestos | Control | Planeado vs. real |
| Finanzas → Conciliación | Libro vs. banco | Partidas conciliatorias |
| Finanzas → Cierres | Corte contable | Snapshots y bloqueo |
| Finanzas → Rentabilidad | Margen por producto/cliente | Analítica de resultados |
| Finanzas → Rotación | Inventario | Eficiencia del capital de trabajo |
| Finanzas → Embudo | Comercial | Conversión de propuestas |
| Finanzas → Tendencias | Series y variaciones | Comparación de periodos |
| Decisiones con datos de Finanzas | Flujos incrementales | Evaluar crédito, descuentos y precios |
| Auditoría | Trazabilidad | Control interno |

---

## 21. Preguntas de repaso

1. ¿Por qué una venta a crédito aumenta la utilidad pero no la caja?
2. ¿Qué pasa con el IVA cuando vendes de contado? ¿Y cuando compras?
3. ¿Por qué comprar inventario no es un gasto?
4. ¿Qué diferencia hay entre costo de referencia y costo histórico?
5. ¿Por qué el descuento de compra se registra como ingreso y no como menor
   inventario? ¿Qué alternativa existe?
6. ¿Cómo se calcula el saldo de una factura a crédito con notas y pagos?
7. ¿Qué significa un DSO de 45 días? ¿Es bueno o malo?
8. ¿Qué es una partida conciliatoria y cómo se resuelve?
9. ¿Por qué el balance puede no coincidir con el saldo del banco?
10. ¿Qué congela un cierre de ejercicio y qué no?
11. ¿Por qué el costo de ventas no reduce la caja?
12. ¿Cómo se calcula el margen bruto y en qué se diferencia de la utilidad?
13. ¿Qué pasa si el costo del producto está en cero?
14. ¿Por qué el sistema no deja editar una factura confirmada?
15. ¿Qué decisión de diseño permite renombrar “Ventas” sin romper los reportes?
16. ¿Por qué una retención no reduce el ingreso en el estado de resultados?
17. ¿Sobre qué base se calcula la reteIVA y por qué no es sobre el total?
18. ¿En qué casos una empresa **no** debe practicar reteIVA?
19. ¿Cuál es el costo anualizado de un descuento 2/10 neto 30? ¿Con qué se compara?
20. ¿Cuántas ventas adicionales se necesitan para pagar un gasto fijo de
    4.000.000 si el margen de contribución es 30 %?
21. ¿Por qué el costo hundido no debe entrar en una decisión?

> **Ejercicio sugerido:** reproduce el caso de la sección 17 cambiando la venta a
> contado. Calcula P&L, caja del sistema, caja bancaria real y balance. La
> diferencia entre las dos últimas es exactamente el IVA del periodo.
>
> **Ejercicio 2:** al mismo caso aplícale retefuente 2,5 %, reteICA 1 % y reteIVA
> 15 %. Calcula total neto, caja del sistema y la diferencia contra el extracto
> bancario. ¿Cuánto vale esa diferencia y por qué?

---

*Documento de estudio generado a partir del código y de la documentación del
proyecto (`docs/PLAN-CONTABILIDAD-ANALITICA.md`,
`docs/MEJORAS-FACTURACION-CONTABILIDAD.md`, `docs/REQUISITOS-FINANZAS.md` y
`docs/MANUAL-USUARIO.md`). Las referencias tributarias de la sección 10 se
apoyan en el Estatuto Tributario (arts. 368, 437-1 y 437-2), el Decreto 572 de
2025 y las tablas de retención vigentes en 2026; verifica siempre la norma
aplicable antes de facturar.*
