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

- Historial de entradas y salidas con fecha, producto, tipo, cantidad, costo y motivo.
- **Filtros**: producto y tipo, con limpieza.
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
  - “Entregar” descuenta el stock y registra el ingreso en finanzas.
- **Vencimiento**: alerta cuando quedan 3 días o menos, o si ya venció.

## 8. Finanzas

### 8.1 Resumen financiero
- Tarjetas: ingresos, egresos, utilidad, capital disponible, costo de ventas, margen bruto.
- Selector de rango de fechas.
- Sugerencias basadas en la ejecución del presupuesto activo.
- Tablas de cuentas y totales por categoría.

### 8.2 Presupuestos
- Planifica por periodo (día, semana, mes, año). Solo un presupuesto activo por periodo.
- **Estados**: Borrador, Activo, Cerrado.
- **Líneas**: por categoría financiera y producto opcional, con monto planeado. Se muestra el total planeado.
- **Activar**: comienza a comparar transacciones reales contra las líneas.
- **Cerrar**: el periodo deja de admitir transacciones.
- **Detalle**: ejecución por línea (planeado, real, disponible, %), alertas, proyección de cierre y cumplimiento de meta de ingresos.

### 8.3 Transacciones
- Registro de ingresos y gastos reales. No se editan ni borran: se **anulan** con una contrapartida.
- Algunas se generan automáticamente (entradas de stock con costo, entrega de cotizaciones).
- Filtros por tipo, categoría, cuenta y rango de fechas; exportar CSV.
- El saldo de la cuenta se actualiza automáticamente.

## 9. Perfil

- Datos del usuario, cambio de contraseña y ajuste de tema (claro/oscuro).

## 10. Ayuda contextual y estados vacíos

- **Tooltips** en columnas, acciones y campos de formulario.
- **Estados vacíos** diferencian “sin datos” vs “sin resultados” y ofrecen crear el primer registro o limpiar filtros.
- **Alertas** para periodos cerrados, stock bajo, presupuesto excedido y vencimiento de cotizaciones.

## 11. Glosario

- **Disponible (presupuesto)**: monto planeado menos el ejecutado.
- **Ejecución**: porcentaje del monto planeado ya gastado.
- **Periodo cerrado**: no admite nuevas transacciones ni movimientos con costo.
- **Contrapartida**: transacción inversa que anula otra.

---
Generado como parte de las mejoras de UI/UX y datos de prueba del proyecto.