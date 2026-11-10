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
- **Nueva factura**: tipo, fecha, contraparte, documento, orden de compra (referencia), email y notas.
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

---
Generado como parte de las mejoras de UI/UX y datos de prueba del proyecto.