# Requisitos: módulo de presupuestos y finanzas

## Glosario

- Cotización: oferta a un cliente (módulo quotes existente).
- Presupuesto: plan de dinero de un periodo (día, semana, mes o año).
- Línea de presupuesto: monto planeado para una categoría o producto.
- Transacción: asiento real. Es lo que se compara contra el plan.
- Asiento informativo: transacción contable que afecta utilidad/margen y presupuesto, pero no mueve caja (por ejemplo, costo de ventas o IVA).
- Inventario: activo que representa la mercancía comprada. La compra sí saca dinero de caja, pero no reduce la utilidad hasta que se vende.
- Capital: saldo acumulado de caja y bancos hasta una fecha (saldo inicial + ingresos de caja - egresos de caja, incluidas las compras de inventario). No incluye asientos informativos.
- Ejecución: lo real gastado/ingresado frente a lo planeado, en %.

## Modelo de datos (resumen)

- finance_accounts: caja/banco, saldo_inicial.
- finance_categories: nombre, tipo (ingreso | gasto | activo | pasivo), `afecta_caja` (1 = mueve caja/bancos; 0 = asiento informativo).
- budgets: nombre, tipo de periodo, fecha_inicio, fecha_fin, ingreso_meta, alerta_pct (def. 80), estado (borrador | activo | cerrado).
- budget_lines: budget_id, finance_category_id, product_id opcional, monto_planeado.
- transactions: tipo, monto, fecha, finance_category_id, account_id, product_id opcional, quote_id opcional, stock_movement_id opcional, descripcion, anulada_de opcional.
- products: nuevo campo costo.
- stock_movements: nuevo campo costo_unitario (en entradas).
- audit_log: usuario, entidad, entidad_id, acción, antes, después, fecha.

## Requisitos funcionales

- RF-01: Crear presupuestos por día, semana, mes o año con meta de ingresos.
- RF-02: Asignar monto por categoría y por producto (cuánto puedo gastar en cada uno).
- RF-03: Registrar ingresos y salidas reales de caja; las compras de inventario generan un egreso automático registrado como activo.
- RF-04: Al confirmar una factura de venta se registra el ingreso y el costo de venta; la cotización por sí sola no contabiliza.
- RF-05: Ver ejecución por línea y total: planeado, real, disponible y %.
- RF-06: Alertas al llegar al % de alerta y al excederse.
- RF-07: Proyección de cierre del periodo según el ritmo actual.
- RF-08: Trazabilidad: comparar día, semana, mes y año; detalle de las transacciones de cada línea.
- RF-09: Indicadores: ingresos, egresos de caja, gastos totales, utilidad, margen bruto y %, capital disponible.
- RF-10: Sugerencias de mejora basadas en reglas (ver RN-09).
- RF-11: Exportar reportes a CSV.

## Reglas de negocio

- RN-01: Montos en COP con DECIMAL(18,2); nunca FLOAT. Margen calculado sobre valores sin IVA.
- RN-02: Las transacciones no se editan ni se borran; se anulan con una contrapartida.
- RN-03: Un solo presupuesto activo por periodo.
- RN-04: Ejecución % = real / planeado x 100. Estado: ok (< alerta_pct), alerta (>= alerta_pct), excedido (>= 100). En categorías de ingreso, superar el 100 % es un resultado positivo (meta superada); solo los gastos/activos/pasivos se consideran excedidos.
- RN-04a: un presupuesto `activo` puede ajustarse (montos planificados); un presupuesto `cerrado` no. El ajuste recalcula la ejecución de las transacciones ya registradas.
- RN-05: Disponible = planeado - real.
- RN-06: Margen bruto = ingresos - costo de ventas; margen % = margen / ingresos. La utilidad descuenta todos los gastos, incluidos los informativos.
- RN-06a: Solo las categorías con `afecta_caja = 1` mueven ingresos, egresos y saldo de cuentas. Las compras de inventario son activo con `afecta_caja = 1`: salen de caja pero no reducen la utilidad. Las categorías informativas (`afecta_caja = 0`, p. ej. costo de ventas e IVA) afectan utilidad/margen y presupuesto, pero no caja.
- RN-06c: La utilidad descuenta todos los gastos (incluido el costo de ventas), pero no las compras de activos. La compra de inventario impacta la caja al comprar y la utilidad al vender, nunca dos veces en el mismo concepto.
- RN-06b: El capital disponible es un saldo acumulado a la fecha final del rango: incluye el histórico anterior a la fecha inicial y excluye movimientos posteriores a la fecha final.
- RN-07: Una compra que excede el disponible de su línea se advierte; solo admin puede confirmarla.
- RN-08: Proyección = real / días transcurridos x días del periodo. Si supera lo planeado, alerta.
- RN-09: Sugerencias: línea con ejecución < 60% al 80% del periodo (reasignar), línea excedida dos periodos seguidos (subir), margen % bajo la meta (revisar precios).
- RN-10: Todo cambio queda en audit_log.
- RN-11: Un periodo cerrado no admite transacciones.
- RN-12: Roles: admin (todo), contador (finanzas y cierres), operador (registra movimientos y cotizaciones), consulta (solo lectura).

## Supuestos a confirmar

- El ingreso se reconoce al entregar la cotización (cobros y cartera en fase 3).
- Una sola empresa por instalación.

# Tablas

## budgets — presupuesto por periodo

- tipo_periodo: dia | semana | mes | anio
- fecha_inicio, fecha_fin, ingreso_meta, alerta_pct (80 % por defecto)
- estado: borrador | activo | cerrado
- RN-03 garantizada en base de datos: columna generada activo_key con índice único, de modo que solo puede haber un presupuesto activo por periodo, pero sí varios borradores/cerrados.

## budget_lines — montos planeados

- Categoría financiera obligatoria, producto opcional, monto_planeado.
- Índice único por presupuesto + categoría + producto, incluso cuando product_id es NULL.
- Al borrar un presupuesto, sus líneas se eliminan en cascada.

## transactions — movimientos reales

- tipo: ingreso | gasto, monto DECIMAL(18,2), fecha, cuenta y categoría financiera.
- Vínculos opcionales a producto, cotización y movimiento de stock.
- anulada_de autorreferente: una transacción solo puede anularse una vez.
- Idempotencia: una cotización genera máximo un ingreso y un gasto; un movimiento de stock máximo un egreso.
