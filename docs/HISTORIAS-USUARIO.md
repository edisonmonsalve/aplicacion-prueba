# Historias de Usuario — Inventario y Finanzas

Formato: **Como** [rol], **quiero** [acción], **para** [beneficio].
Criterios de aceptación (CA) incluidos.

---

## 1. Acceso y seguridad

- **HU-01** Como usuario, quiero iniciar sesión con correo y contraseña, para acceder a la aplicación.
  - CA: credenciales válidas otorgan sesión; inválidas muestran error; sesión expirada redirige a login.
- **HU-02** Como usuario, quiero cambiar mi contraseña, para mantener mi cuenta segura.
  - CA: requiere contraseña actual; valida longitud mínima; confirma coincidencia.
- **HU-03** Como administrador, quiero gestionar usuarios (crear, editar, activar/desactivar), para controlar accesos.
  - CA: no puede desactivarse a sí mismo ni quitar su rol; no se puede dejar el sistema sin admin activo.
- **HU-04** Como usuario, quiero cambiar entre tema claro y oscuro, para mayor comodidad visual.

## 2. Inventario

- **HU-05** Como operador, quiero registrar productos con SKU, nombre, categoría, precio, costo y stock mínimo, para mantener el catálogo.
  - CA: SKU único; precio y stock mínimo válidos; producto inactivo no admite movimientos.
- **HU-06** Como operador, quiero editar y activar/desactivar productos, para gestionar el ciclo de vida.
  - CA: no se desactiva si tiene stock o cotizaciones enviadas/aprobadas.
- **HU-07** Como operador, quiero organizar productos por categorías, para facilitar la búsqueda.
  - CA: no se elimina una categoría con productos asociados.
- **HU-08** Como operador, quiero registrar entradas de stock, para reflejar compras.
  - CA: suma stock; si tiene costo, genera egreso automático en finanzas; valida periodo cerrado.
- **HU-09** Como operador, quiero registrar salidas de stock, para reflejar entregas/ventas.
  - CA: resta stock; rechaza si supera el disponible; valida stock suficiente.
- **HU-10** Como usuario, quiero consultar el historial de movimientos por producto, para auditar el stock.
- **HU-11** Como usuario, quiero ver alertas de stock bajo, para reponer a tiempo.

## 3. Cotizaciones

- **HU-12** Como operador, quiero crear una cotización con cliente y líneas de producto, para enviar propuestas.
  - CA: precio tomado del catálogo; descuento e impuesto por línea; total calculado.
- **HU-13** Como operador, quiero editar una cotización en borrador, para ajustarla antes de enviar.
- **HU-14** Como operador, quiero enviar una cotización, para que el cliente la reciba.
  - CA: no se puede enviar si está vencida.
- **HU-15** Como operador, quiero aprobar o rechazar una cotización enviada, para reflejar la decisión del cliente.
  - CA: no se puede aprobar si está vencida.
- **HU-16** Como operador, quiero entregar una cotización aprobada, para descontar stock y registrar el ingreso.
  - CA: valida stock suficiente; bloquea si está vencida; genera transacción financiera.
- **HU-17** Como operador, quiero duplicar una cotización, para reutilizarla.
- **HU-18** Como usuario, quiero imprimir una cotización, para entregarla al cliente.
- **HU-19** Como usuario, quiero ver el historial de estados de una cotización, para auditar cambios.

## 4. Finanzas — Presupuestos

- **HU-20** Como contador, quiero crear un presupuesto por periodo con líneas por categoría/producto, para planificar gastos.
  - CA: valida líneas; calcula total planeado.
- **HU-21** Como contador, quiero activar un presupuesto, para comenzar el seguimiento.
  - CA: solo uno activo por periodo; bloquea solapamientos.
- **HU-22** Como contador, quiero cerrar un presupuesto, para finalizar el periodo.
  - CA: el periodo deja de admitir transacciones.
- **HU-23** Como contador, quiero consultar la ejecución del presupuesto, para controlar desvíos.
  - CA: muestra planeado, real, disponible, % y estado por línea.
- **HU-24** Como contador, quiero ver alertas y proyección de cierre, para tomar decisiones.

## 5. Finanzas — Transacciones

- **HU-25** Como contador, quiero registrar ingresos y gastos, para reflejar la operación real.
  - CA: actualiza el saldo de la cuenta; valida categoría según tipo.
- **HU-26** Como contador, quiero anular una transacción, para corregir errores.
  - CA: crea contrapartida; marca la original como anulada; no se puede anular dos veces ni asientos automáticos.
- **HU-27** Como contador, quiero consultar transacciones por filtros, para analizar la operación.
- **HU-28** Como contador, quiero exportar transacciones a CSV, para reportes externos.

## 6. Finanzas — Resumen

- **HU-29** Como contador, quiero ver el resumen financiero por rango de fechas, para evaluar la salud financiera.
  - CA: ingresos, egresos, utilidad, capital, margen, costo de ventas.
- **HU-30** Como contador, quiero ver sugerencias basadas en el presupuesto activo, para optimizar gastos.
- **HU-31** Como contador, quiero consultar saldos por cuenta, para controlar la caja.

## 7. Experiencia de usuario

- **HU-32** Como usuario, quiero filtros etiquetados y con limpieza, para encontrar información rápidamente.
- **HU-33** Como usuario, quiero estados vacíos con acción directa, para saber qué hacer cuando no hay datos.
- **HU-34** Como usuario, quiero tooltips y ayuda contextual, para entender cada campo y acción.
- **HU-35** Como usuario, quiero que la aplicación sea responsive, para usarla en móvil.
- **HU-36** Como usuario, quiero un menú colapsable con soporte móvil, para navegar con comodidad.