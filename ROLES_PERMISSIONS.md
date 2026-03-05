# rødën - Guía de Roles y Permisos (Actualizada)



Este documento define la matriz de acceso para asegurar la integridad de la información y la trazabilidad de la producción.



## 1. Administrador (Admin)

- **Acceso:** Total y sin restricciones.

- **Acciones:** Lectura, creación, edición y eliminación en todos los módulos.



## 2. Gerente de Taller (Workshop Manager)

- **Proyectos:** Solo lectura (Estados: `"en producción"`, `"listo para entregar"`). No crea obras.

- **Taller:** Edición de avance de etapas y creación de notas técnicas.

- **Tareas:** Acceso total, excepto eliminar.

- **Informes:** Acceso total, excepto eliminar historial.

- **Proveedores:** Lectura limitada a pagos al proveedor `"Taller"`.



## 3. Operario de Taller (Workshop Operator)

Rol enfocado estrictamente en la ejecución y visualización de trabajo activo.

- **Proyectos:** Solo lectura (Estados: `"en producción"`, `"listo para entregar"`).

- **Restricción Proyectos:** No puede crear obras nuevas.

- **Taller:** Solo lectura (Visualización de órdenes de producción y especificaciones). No puede editar avances.

- **Tareas:** Acceso total para gestionar sus labores, excepto eliminar tareas.

- **Informes:** Acceso total a métricas de rendimiento, excepto eliminar.

- **Restricción Global:** NO tiene acceso a otros módulos (Proveedores, Finanzas, Presupuestos, etc.). generar un archivo roles_permissions.md