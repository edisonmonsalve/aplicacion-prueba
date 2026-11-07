# Requisitos: módulo de presupuestos y finanzas

## Glosario

- Cotización: oferta a un cliente (módulo quotes existente).
- Presupuesto: plan de dinero de un periodo (día, semana, mes o año).
- Línea de presupuesto: monto planeado para una categoría o producto.
- Transacción: ingreso o egreso real. Es lo que se compara contra el plan.
- Capital: saldo de caja y bancos (saldo inicial + ingresos - egresos).
- Ejecución: lo real gastado/ingresado frente a lo planeado, en %.

## Modelo de datos (resumen)

- finance_accounts: caja/banco, saldo_inicial.
- finance_categories: nombre, tipo (ingreso | gasto).
- budgets: nombre, tipo de periodo, fecha_inicio, fecha_fin, ingreso_meta, alerta_pct (def. 80), estado (borrador | activo | cerrado).
- budget_lines: budget_id, finance_category_id, product_id opcional, monto_planeado.
- transactions: tipo, monto, fecha, finance_category_id, account_id, product_id opcional, quote_id opcional, stock_movement_id opcional, descripcion, anulada_de opcional.
- products: nuevo campo costo.
- stock_movements: nuevo campo costo_unitario (en entradas).
- audit_log: usuario, entidad, entidad_id, acción, antes, después, fecha.

## Requisitos funcionales

- RF-01: Crear presupuestos por día, semana, mes o año con meta de ingresos.
- RF-02: Asignar monto por categoría y por producto (cuánto puedo gastar en cada uno).
- RF-03: Registrar ingresos y egresos reales; las entradas de stock generan un egreso automático.
- RF-04: Al entregar una cotización se registra el ingreso y el costo de lo vendido.
- RF-05: Ver ejecución por línea y total: planeado, real, disponible y %.
- RF-06: Alertas al llegar al % de alerta y al excederse.
- RF-07: Proyección de cierre del periodo según el ritmo actual.
- RF-08: Trazabilidad: comparar día, semana, mes y año; detalle de las transacciones de cada línea.
- RF-09: Indicadores: ingresos, egresos, utilidad, margen bruto y %, capital disponible.
- RF-10: Sugerencias de mejora basadas en reglas (ver RN-09).
- RF-11: Exportar reportes a CSV.

## Reglas de negocio

- RN-01: Montos en COP con DECIMAL(18,2); nunca FLOAT. Margen calculado sobre valores sin IVA.
- RN-02: Las transacciones no se editan ni se borran; se anulan con una contrapartida.
- RN-03: Un solo presupuesto activo por periodo.
- RN-04: Ejecución % = real / planeado x 100. Estado: ok (< alerta_pct), alerta (>= alerta_pct), excedido (>= 100).
- RN-05: Disponible = planeado - real.
- RN-06: Margen bruto = ingresos - costo de ventas; margen % = margen / ingresos.
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
