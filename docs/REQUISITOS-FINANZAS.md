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
- Resultado (P&L): ingresos y gastos del periodo, incluidos los que no mueven caja (costo de ventas, IVA, ventas a crédito). Se controla con `afecta_resultado`.
- Caja: entradas y salidas reales de dinero. Se controla con `afecta_caja`.
- Código de sistema: identificador estable de una categoría contable (`ventas`, `costo_ventas`, `iva_por_pagar`, ...). No cambia aunque se renombre la categoría.
- IVA neto: IVA por pagar menos IVA descontable del periodo. Si es negativo, es saldo a favor.

## Modelo de datos (resumen)

- finance_accounts: caja/banco, saldo_inicial. Cada asiento se registra en una cuenta; las facturas pueden indicar si el dinero sale/entra por caja (efectivo) o por banco (transferencia).
- finance_categories: nombre, `codigo` único de sistema (nullable), tipo (ingreso | gasto | activo | pasivo), `afecta_caja` (1 = mueve caja/bancos; 0 = asiento informativo) y `afecta_resultado` (1 = entra al estado de resultados; 0 = solo caja/balance).
- third_parties: tipo (cliente | proveedor | ambos), tipo_documento, documento único, nombre, email, teléfono, dirección, ciudad, condición de pago, días de crédito, notas y activo.
- invoices: además de los datos del documento, `party_id`, `condicion_pago`, `dias_credito` y `fecha_vencimiento`. `contraparte` y `documento` se conservan como snapshot.
- budgets: nombre, tipo de periodo, fecha_inicio, fecha_fin, ingreso_meta, alerta_pct (def. 80), estado (borrador | activo | cerrado).
- budget_lines: budget_id, finance_category_id, product_id opcional, monto_planeado.
- transactions: tipo, monto, `afecta_caja` opcional (NULL = usa la categoría; 0/1 = override del asiento), fecha, finance_category_id, account_id, product_id opcional, quote_id opcional, stock_movement_id opcional, descripcion, anulada_de opcional.
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
- RF-12: Elegir la cuenta de caja o banco al registrar una factura, para reflejar si el pago/cobro fue en efectivo o por transferencia. Si no se indica, se usa la primera cuenta activa.
- RF-13: El resumen financiero muestra el IVA neto del periodo (por pagar − descontable) e indica si es saldo a favor o a cargo.
- RF-14: El panel de Inicio muestra, para admin/contador/consulta, ingresos, egresos, utilidad, IVA neto y capital del mes, comparados con el mes anterior. El operador no ve información financiera.
- RF-15: El inventario se informa a precio de venta y al costo, y se advierte cuántos productos activos no tienen costo definido.
- RF-16: El rango de fechas del resumen financiero se conserva en la URL y se puede compartir por enlace.
- RF-17: Mantener un maestro de clientes y proveedores con documento, contacto, condición de pago y estado, reutilizable en facturas.
- RF-18: Vincular una factura a un tercero y definir su condición de pago (contado o crédito) y días de crédito. El vencimiento se calcula automáticamente.
- RF-19: Consultar los terceros por nombre, documento, email, tipo y estado. El operador puede leerlos para facturar; solo admin y contador los crean o modifican.
- RF-20: Consultar la cartera de cuentas por cobrar y por pagar con filtros por tipo, estado (pendiente, parcial, pagada, vencida), búsqueda y rango de fechas, y totales de por cobrar, por pagar, neto y vencido.
- RF-21: Registrar cobros y pagos (totales o parciales) sobre facturas a crédito confirmadas, eligiendo fecha, monto, cuenta y método. El monto no puede superar el saldo pendiente.
- RF-22: Anular un cobro o pago registrado, generando la contrapartida contable y devolviendo el saldo a la cartera. No se permite anular una factura con pagos válidos.
- RF-23: Ver en el detalle de la factura el total neto, lo pagado, el saldo pendiente, el estado de cartera y el historial de movimientos.
- RF-24: Ver el aging de la cartera por tramos (corriente, 1-30, 31-60, 61-90 y más de 90 días), el DSO, el saldo vencido, lo que vence en 7 días y los principales deudores.
- RF-25: Registrar retenciones de fuente, IVA e ICA en la factura. Al confirmar se reconocen como activo fiscal (venta) o pasivo (compra) y reducen el neto a cobrar o pagar. No se admiten retenciones mayores que el total de la factura.
- RF-26: Cerrar un periodo con una foto de sus totales (resumen, facturas, cartera, retenciones y transacciones) y bloquear nuevos asientos dentro del rango. Consultar los cierres y su detalle histórico.
- RF-27: Reabrir un cierre vigente indicando el motivo. La reapertura no borra el cierre: lo marca como reabierto con usuario y fecha, y vuelve a permitir movimientos.
- RF-28: Consultar el estado de resultados del periodo con ingresos, costo de ventas, margen bruto, gastos operativos y utilidad, desglosados por categoría y comparados contra el periodo anterior de igual duración, con variación porcentual por línea.

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
- RN-12: El saldo inicial de cada cuenta representa el capital disponible al abrir el periodo. Solo las transacciones con `afecta_caja = 1` lo modifican; la suma de saldos de cuentas activas es el capital disponible.
- RN-09: Sugerencias: línea con ejecución < 60% al 80% del periodo (reasignar), línea excedida dos periodos seguidos (subir), margen % bajo la meta (revisar precios).
- RN-10: Todo cambio queda en audit_log.
- RN-11: Un periodo cerrado no admite transacciones.
- RN-12: Roles: admin (todo), contador (finanzas y cierres), operador (registra movimientos y cotizaciones), consulta (solo lectura).
- RN-13: Una factura de venta a crédito reconoce el ingreso y el IVA al confirmarse, pero no mueve caja. El saldo queda en cartera por cobrar.
- RN-14: Una factura de compra a crédito reconoce el inventario y el IVA descontable, pero no reduce caja. El saldo queda en cartera por pagar.
- RN-15: El tercero se valida por tipo (cliente para venta, proveedor para compra, ambos para los dos). La factura guarda un snapshot editable de nombre y documento.
- RN-16: El vencimiento de una factura a crédito se calcula como fecha de factura + días de crédito, salvo que se indique una fecha explícita. Las facturas de contado vencen en su fecha.
- RN-17: No se elimina un tercero con facturas asociadas; se desactiva.
- RN-18: Las retenciones reducen el total neto de la factura y se reconocen como activo (venta) o pasivo (compra). Fuente e ICA reducen el dinero cobrado/pagado; la retención de IVA no mueve caja porque el IVA no forma parte del capital. No pueden superar el total de la factura.
- RN-19: Los informes de resultado usan `afecta_resultado`; los de caja usan `afecta_caja`, respetando el override del asiento (`transactions.afecta_caja`) cuando no es NULL.
- RN-20: Las categorías de sistema se buscan por `codigo`. Renombrar una categoría no cambia los asientos automáticos ni los informes.
- RN-21: El IVA no es dinero propio: nunca suma al capital disponible. Se netea por periodo para informar el saldo a favor o a cargo.
- RN-22: Un pago/cobro no puede superar el saldo pendiente ni registrarse en una factura anulada o en borrador. Solo aplica a facturas a crédito confirmadas.
- RN-23: Anular un pago o cobro genera una contrapartida de caja y deja el movimiento marcado como anulado; no se borra.
- RN-24: Una factura con pagos válidos no se anula hasta anular esos pagos.
- RN-25: La cartera se deriva de facturas confirmadas a crédito menos sus pagos válidos. El estado (pendiente, parcial, pagada, vencida) se calcula, no se guarda duplicado.
- RN-26: El aging mide los días desde `fecha_vencimiento` hasta hoy y solo considera saldo pendiente mayor que cero. El DSO es simple: cartera por cobrar / ventas a crédito del periodo × días del periodo; si no hubo ventas a crédito, no se informa.
- RN-27: Un cierre vigente (`cerrado`) bloquea cualquier asiento con fecha dentro de su rango, además de los presupuestos cerrados. No se permiten dos cierres vigentes superpuestos.
- RN-28: La reapertura exige motivo y queda auditada; el cierre pasa a `reabierto` y no se elimina. Los totales del snapshot son inmutables y reflejan el momento del cierre.
- RN-29: El estado de resultados usa solo asientos con `afecta_resultado = 1` (devengo). El costo de ventas se muestra separado de los gastos operativos para calcular el margen bruto; la utilidad es margen bruto − gastos. El comparativo usa el periodo inmediatamente anterior de igual número de días.

## Supuestos a confirmar

- El ingreso se reconoce al confirmar la factura (devengo). Los cobros y pagos parciales se registran sobre la cartera (C2) y mueven caja sin volver a afectar el resultado.
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

- tipo: ingreso | gasto, monto DECIMAL(18,2), `afecta_caja` opcional (NULL = usa la categoría; 0/1 = override del asiento), fecha, cuenta y categoría financiera.
- Vínculos opcionales a producto, cotización y movimiento de stock.
- anulada_de autorreferente: una transacción solo puede anularse una vez.
- Idempotencia: una cotización genera máximo un ingreso y un gasto; un movimiento de stock máximo un egreso.
- Las retenciones usan `retenciones_a_favor` (activo, venta) y `retenciones_por_pagar` (pasivo, compra); no afectan el resultado.

## third_parties — clientes y proveedores

- tipo: cliente | proveedor | ambos; tipo_documento y documento único (nullable).
- Condición de pago por defecto y días de crédito, que la factura puede sobrescribir.
- activo: un tercero con facturas no se elimina, se desactiva.
- Índices por nombre y por tipo/estado para búsquedas y filtros.

## invoices — condición de pago y cartera

- party_id opcional; la contraparte textual se conserva como snapshot.
- condicion_pago: contado | credito; dias_credito y fecha_vencimiento.
- A crédito no se mueve caja al confirmar: los asientos llevan `afecta_caja = 0` como override.
- La anulación copia el override a la contrapartida para no alterar el capital.

## invoice_payments — cobros y pagos de cartera

- invoice_id, fecha, monto DECIMAL(18,2), cuenta, método (efectivo, transferencia, tarjeta, otro), referencia y notas.
- transaction_id vincula el asiento de caja (`cobro_cartera` o `pago_cartera`, `afecta_caja = 1`, sin afectar resultado).
- estado: valido | anulado; la anulación guarda fecha y usuario y no borra el registro.
- El saldo pendiente y el estado de cartera se derivan; no se almacenan en la factura.
- Índices por factura/estado y por fecha para aging y conciliación.

## period_closures — cierre formal de periodos

- nombre, fecha_inicio y fecha_fin; el rango no puede superponerse con otro cierre vigente.
- estado: cerrado | reabierto. Un cierre vigente bloquea asientos dentro del rango.
- snapshot JSON con el resumen del periodo, conteo de facturas, transacciones, cartera y retenciones; es inmutable.
- cerrado_by/cerrado_at y, al reabrir, reabierto_by/reabierto_at y motivo_reapertura.
- Cada cierre y reapertura queda en `audit_log` con la entidad `period_closure`.
