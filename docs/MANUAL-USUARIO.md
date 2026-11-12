# Manual de Usuario — Inventario y Finanzas

Aplicación web para gestionar el inventario, las cotizaciones y las finanzas de una
empresa de obra civil y sistemas. Este manual describe la experiencia de usuario y los
flujos principales.

## 1. Acceso y roles

- **URL de desarrollo:** `http://localhost:5173` (cliente) sobre el servidor en `http://localhost:3000`.
- **Credenciales demo:**
  - Administrador: `demo@demo.com` / `Demo1234!`
  - Contador: `contador@demo.com` / `Demo1234!`
  - Operador: `operador@demo.com` / `Demo1234!`
  - Consulta: `consulta@demo.com` / `Demo1234!`

Roles y permisos:

| Rol | Inventario | Cotizaciones | Finanzas | Usuarios |
|-----|-----------|--------------|----------|----------|
| admin | Completo | Completo | Completo | Gestión |
| contador | Lectura | Lectura | Completo | — |
| operador | Operación | Operación | Lectura | — |
| consulta | Lectura | Lectura | Lectura | — |

- El menú lateral se adapta al rol: solo el administrador ve “Usuarios” y “Finanzas → transacciones”.
- El tema claro/oscuro se alterna con el interruptor de la barra superior.

## 2. Navegación

- **Menú lateral** (colapsable, con soporte móvil): Inicio, Productos, Movimientos, Categorías,
  Cotizaciones y Finanzas (Resumen, Presupuestos, Transacciones).
- **Barra superior**: cambio de tema, avatar con menú (cambiar contraseña, cerrar sesión).
- **Breadcrumbs visuales**: cada página muestra título, subtítulo y filtros.

## 3. Inicio (Dashboard)

Resumen del estado de la empresa:

- **Métricas**: productos activos, stock bajo, movimientos hoy, valor del inventario.
- **Alerta de stock bajo** con enlace a Productos.
- **Gráficos**: movimientos de los últimos 7 días, cotizaciones por estado, top productos cotizados.
- **Tablas**: productos con stock bajo y últimos movimientos, con enlaces “Ver todos”.

## 4. Productos

- **Filtros**: búsqueda por nombre/SKU, categoría, estado y “solo stock bajo”. Botón “Limpiar filtros”.
- **Acciones por producto**: Movimiento (registrar entrada/salida), Historial, Editar, Activar/Desactivar.
- **Indicador visual** “Bajo” en rojo cuando el stock está por debajo del mínimo.
- **Empty state**: invita a crear el primer producto cuando no hay datos.

## 5. Movimientos de stock

- Historial de entradas y salidas con fecha, producto, tipo, origen, cantidad, costo histórico, precio de venta y motivo.
- **Filtros**: producto, tipo, origen y, si se llega desde una factura/cotización, por ese documento.
- La columna **Documento** enlaza a la factura o cotización que originó el movimiento.
- El costo histórico y el precio de venta solo se muestran a admin, contador y consulta (el operador no los ve).
- Registrar un movimiento desde Productos → “Movimiento”:
  - Entrada suma stock; salida lo descuenta y valida stock suficiente.
  - Si hay presupuesto activo, muestra el disponible y avisa si la compra lo excede.
  - Si hoy está en un periodo cerrado, se bloquea el egreso automático de entradas con costo.

## 6. Categorías

- Organiza el catálogo. Solo administradores crean/editan/eliminan.
- No se puede eliminar una categoría con productos asociados.

## 7. Cotizaciones

Flujo de estados: **Borrador → Enviado → Aprobado → Entregado** (también Rechazado y Vencido).

- **Lista**: filtros por texto, estado y rango de fechas; exportar CSV.
- **Nueva cotización**: cliente, fecha de validez, líneas de producto con descuento e impuesto por línea.
  - El precio se toma del catálogo (solo lectura); se muestra el total por línea y un resumen.
  - Alerta si la cantidad supera el stock disponible.
- **Detalle**: pasos del flujo, datos del cliente, totales, líneas, historial de estados.
  - Acciones contextuales: Enviar, Aprobar, Rechazar, Entregar, Editar, Duplicar, Imprimir.
  - “Entregar” descuenta el stock y **no genera contabilidad**: la cotización es pre-contractual. La salida queda como origen “entrega”.
- **Vencimiento**: alerta cuando quedan 3 días o menos, o si ya venció.

## 8. Facturación

- **Lista**: filtros por texto, tipo (venta/compra), estado y rango de fechas.
- **Nueva factura**: tipo, fecha, contraparte, documento, **cuenta (caja o banco)**, orden de compra (referencia), email y notas.
  - La cuenta define si el dinero sale o entra por caja (efectivo) o por banco (transferencia) al confirmar.
  - Líneas con producto, cantidad, precio/costo unitario, descuento % e IVA %. El selector muestra el stock disponible.
  - En ventas se puede **vincular una cotización** aprobada o entregada para no reconocer dos veces el ingreso.
  - Retenciones (fuente, IVA, ICA) informativas: reducen el total neto a pagar pero no generan asientos.
- **Confirmar**:
  - Venta directa: descuenta stock y crea asientos de cabecera (ingreso neto, IVA por pagar y costo de ventas).
  - Venta desde cotización aprobada: mueve stock una vez y deja la cotización entregada; si ya estaba entregada, no vuelve a mover stock.
  - Compra: suma stock, guarda el costo histórico del movimiento y crea **activo Inventario** (salida de caja) + IVA descontable. No modifica `products.costo` (solo edición manual).
- **Anular**: revierte el stock y todos los asientos con contrapartidas; no modifica el costo de referencia del producto.
- **Detalle**: desglose tributario, link a la cotización y tabla de asientos financieros vinculados.

## 9. Finanzas

### 9.1 Resumen financiero
- Tarjetas: ingresos, egresos de caja, utilidad, capital disponible, compras de inventario, costo de ventas, margen bruto, IVA por pagar e IVA descontable.
- La compra de inventario es salida de caja y activo; el costo de ventas reduce utilidad/margen pero no mueve caja.
- Los asientos informativos (costo de ventas, IVA) se marcan como «No afecta caja».
- Selector de rango de fechas.
- Sugerencias basadas en la ejecución del presupuesto activo.
- Tabla de cuentas con saldo inicial, ingresos, egresos y saldo actual; crear/editar/eliminar cuentas sin movimientos.
- Al iniciar con datos reales, crea primero las cuentas de **caja** y **banco** con su saldo inicial. Ese capital financia la primera compra de inventario (activo) y las demás transacciones.
- Totales por categoría.

### 9.2 Presupuestos
- Planifica por periodo (día, semana, mes, año). Solo un presupuesto activo por periodo.
- **Estados**: Borrador, Activo, Cerrado.
- **Líneas**: por categoría financiera con alcance general, producto o categoría de producto, con monto planeado. Se muestra el total planeado.
- **Activar**: comienza a comparar transacciones reales contra las líneas.
- **Cerrar**: el periodo deja de admitir transacciones.
- **Detalle**: ejecución por línea (planeado, real, disponible, %, alcance), alertas, proyección de cierre y cumplimiento de meta de ingresos.

### 9.3 Transacciones
- Registro de asientos reales: ingreso, gasto, activo y pasivo. No se editan ni borran: se **anulan** con una contrapartida.
- Los asientos de factura se generan al confirmar la factura y se anulan desde ella; la cotización no contabiliza.
- Filtros por tipo, categoría, cuenta y rango de fechas; exportar CSV.
- La columna **Documento** enlaza a la factura o cotización de origen.
- El saldo de caja solo cambia con ingresos y gastos; activo/pasivo (IVA) no lo afectan.

### 9.4 Reportes y exportación
- Reportes disponibles: resultados, flujo de caja, balance, cartera, tendencias, rentabilidad, rotación de inventario y embudo de cotizaciones.
- Cada reporte respeta sus filtros (fechas, cuenta, agrupación, umbral de stock muerto) y el botón **Exportar** ofrece:
  - **CSV**: todas las secciones del reporte, con números listos para sumar en Excel.
  - **PDF**: vista imprimible; en el diálogo del navegador elige *Guardar como PDF*.
- En **Cartera** se descargan todas las facturas del filtro, no solo la página visible, junto con el aging y los principales deudores.
- Si el navegador bloquea la ventana del PDF, permite las ventanas emergentes para este sitio y vuelve a intentarlo.

### 9.5 Conciliación bancaria
- **Nueva conciliación**: elige la cuenta (banco o caja), el periodo y los saldos inicial y final que informa el extracto.
- **Líneas del extracto**: agrega cada movimiento con su fecha, descripción, referencia e importe. Usa **monto positivo** para entradas y **negativo** para salidas.
- **Conciliar**: el sistema propone asientos de la misma cuenta y del mismo importe dentro de una tolerancia de fechas (±3, ±7, ±15 o ±30 días). Si no aparece la sugerencia esperada, amplía la tolerancia o revisa el importe; también puedes ignorar la línea con una nota.
- **Partidas conciliatorias**: el detalle separa las líneas del banco que aún no están en el sistema de los movimientos del sistema que el banco todavía no ha procesado. La **diferencia no explicada** debería ser cero cuando los saldos iniciales coinciden.
- **Cerrar**: solo se permite cuando todas las líneas están conciliadas o ignoradas y el saldo final del extracto cuadra con el inicial más sus líneas. El cierre congela una foto de los totales.
- **Reabrir**: deja el motivo, el usuario y la fecha en la auditoría; la conciliación no se borra.
- La conciliación **no modifica la contabilidad**: si detectas un cargo no registrado, regístralo como gasto o ingreso en Transacciones y vuelve a conciliar.
- Una línea conciliada no se puede editar ni eliminar; primero usa **Desconciliar**.

### 9.6 Alertas de cartera
- En **Cartera**, el panel **Alertas de cobro** (o de pago, si filtras compras) prioriza las facturas abiertas por severidad:
  - **Crítica**: más de 90 días de mora.
  - **Alta**: entre 31 y 90 días de mora.
  - **Media**: entre 1 y 30 días de mora, o factura a crédito sin fecha de vencimiento.
  - **Baja**: vence hoy o en los próximos 7 días.
- Cada alerta muestra la acción sugerida. Usa **Gestionar** para registrar el estado del cobro: sin gestionar, recordado, promesa de pago, escalado o resuelto, con nota y próximo contacto.
- Una **promesa de pago** exige fecha de próximo contacto. Si la fecha ya pasó, la alerta se marca como **contacto vencido**.
- Las alertas **resueltas** se ocultan por defecto; activa **Incluir resueltas** para verlas. El resumen superior mantiene los totales aunque filtres por severidad.
- El seguimiento no registra pagos ni cambia la factura: es solo gestión comercial y queda en **Auditoría** como *Seguimiento cartera*.
- Para registrar el dinero, abre la factura y usa **Registrar cobro** o **Registrar pago**; la alerta desaparecerá cuando el saldo llegue a cero.

### 9.7 Cierre de ejercicio
- En **Cierres**, la pestaña **Cierres de ejercicio** cierra el año completo (1 de enero a 31 de diciembre). No se pueden elegir años futuros ni anteriores a 2000.
- Pulsa **Cerrar ejercicio**, elige el año y revisa la vista previa: ingresos, utilidad, patrimonio, activo, pasivo, caja y meses cerrados. La vista previa no guarda nada.
- El cierre **no genera asientos** de cierre ni de apertura: congela en una foto el resultado del año y el balance al 31 de diciembre. El patrimonio se sigue calculando como activo menos pasivo.
- Mientras el año esté cerrado no se pueden registrar transacciones con fecha dentro de él. Los demás años siguen abiertos.
- Si el año ya tiene un cierre vigente, el botón se deshabilita. Usa **Reabrir** con un motivo, ajusta lo necesario y vuelve a cerrar.
- Reabrir **no borra** el cierre anterior: queda en el historial como reabierto, con usuario, fecha y motivo. Al volver a cerrar se crea un registro nuevo.
- El cierre anual puede convivir con los cierres mensuales. **Reabrir el ejercicio no reabre los meses**: cada cierre mensual conserva su estado y sus bloqueos.
- El detalle anual muestra el resultado (ingresos, costo de ventas, margen, gastos y utilidad), el balance completo, la ecuación de cuadre, la cartera, las facturas y los meses incluidos.
- El cierre y la reapertura quedan en **Auditoría** como *Cierre* con las acciones *Cerrar ejercicio* y *Reabrir*.

## 10. Perfil

- Datos del usuario, cambio de contraseña y ajuste de tema (claro/oscuro).

## 11. Ayuda contextual y estados vacíos

- **Tooltips** en columnas, acciones y campos de formulario.
- **Estados vacíos** diferencian “sin datos” vs “sin resultados” y ofrecen crear el primer registro o limpiar filtros.
- **Alertas** para periodos cerrados, stock bajo, presupuesto excedido y vencimiento de cotizaciones.

## 12. Glosario

- **Disponible (presupuesto)**: monto planeado menos el ejecutado.
- **Ejecución**: porcentaje del monto planeado ya gastado.
- **Periodo cerrado**: no admite nuevas transacciones ni movimientos con costo.
- **Contrapartida**: transacción inversa que anula otra.
- **IVA por pagar**: pasivo generado por el IVA de las ventas; no es dinero disponible.
- **IVA descontable**: activo generado por el IVA de las compras; no es dinero disponible.
- **Costo histórico**: costo del producto al momento de la salida; base del costo de ventas.
- **Asiento de cabecera**: fila financiera agrupada por factura (neto, IVA o costo de ventas).
- **Extracto bancario**: listado de movimientos que informa el banco; en el sistema se carga como líneas con signo.
- **Partida conciliatoria**: diferencia temporal entre el extracto y el sistema, como un cheque no cobrado o una comisión bancaria aún no registrada.
- **Conciliación bancaria**: control que cruza el extracto contra los asientos de caja de una cuenta y periodo, sin modificar la contabilidad.
- **Alerta de cartera**: aviso priorizado por mora o vencimiento próximo sobre una factura abierta; el seguimiento registra la gestión de cobro sin tocar la contabilidad.
- **Cierre de ejercicio**: foto inmutable del resultado y del balance del año (1 de enero a 31 de diciembre); bloquea transacciones del año y no genera asientos.
- **Recierre**: volver a cerrar un ejercicio que fue reabierto. Crea un registro nuevo y conserva el anterior como reabierto.

---
Generado como parte de las mejoras de UI/UX y datos de prueba del proyecto.