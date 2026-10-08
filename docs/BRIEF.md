# BRIEF DE DESARROLLO
## MONTANA AGENDA — Gestor de productividad y proyectos

**Proyecto:** Montana Agenda  
**Plataforma:** Windows — aplicación de escritorio  
**Tecnología sugerida:** Tauri + React + TypeScript + SQLite  
**Desarrollo:** Codex  
**Idioma:** Español  
**Usuario principal:** Administrador de Sombreros Montana

---

## 1. Objetivo del proyecto

Desarrollar una aplicación de escritorio moderna, intuitiva y visualmente atractiva para organizar las actividades laborales de Sombreros Montana.

La aplicación debe permitir:

- Planificar la jornada por bloques de tiempo.
- Administrar proyectos de desarrollo de software.
- Registrar tareas pendientes y completadas.
- Visualizar prioridades diarias y semanales.
- Medir el tiempo dedicado a cada actividad.
- Revisar avances y actividades atrasadas.
- Mantener una estructura de trabajo constante sin perder flexibilidad.

**Principio central:** La aplicación debe ayudar al usuario a trabajar, no convertirse en otra tarea administrativa.

## 2. Horario laboral

El horario habitual será de lunes a viernes, de 9:30 a. m. a 2:00 p. m.

Total disponible: 4 horas y 30 minutos diarios.

### Distribución inicial de lunes a viernes

| Horario | Actividad |
|---|---|
| 9:30 – 10:30 | Desarrollo App Fábrica 1 |
| 10:30 – 11:30 | Desarrollo App Fábrica 2 |
| 11:30 – 12:00 | Desarrollo App Tienda |
| 12:00 – 1:00 | Pedidos y operaciones |
| 1:00 – 2:00 | Contenido, WhatsApp y mejoras comerciales |

Los horarios son configurables y deben poder modificarse arrastrando los bloques.

### Regla especial de los lunes

Reservar obligatoriamente 1 hora para trabajar en la página web Shopify de Sombreros Montana.

El sistema debe reorganizar los demás bloques sin extender la jornada más allá de las 2:00 p. m.

## 3. Pantalla principal — Mi día

Esta será la pantalla más importante de la aplicación.

Debe mostrar:

- Fecha actual y saludo discreto.
- Porcentaje de jornada completada.
- Línea de tiempo de 9:30 a. m. a 2:00 p. m.
- Actividad actual claramente identificada.
- Próxima actividad.
- Tareas prioritarias del día.
- Temporizador de trabajo.
- Botón para marcar una tarea como completada.

Cada bloque tendrá las acciones: Iniciar, Pausar, Completar, Posponer y Reprogramar.

Al abrir la aplicación, debe mostrar inmediatamente la agenda del día, sin pantallas innecesarias.

## 4. Gestión de proyectos

Crear cuatro áreas principales:

**A. Fábrica — App 1**

- Programación
- Errores
- Nuevas funcionalidades
- Pruebas
- Mejoras
- Pendientes

**B. Fábrica — App 2**

Misma estructura, pero totalmente independiente de la primera aplicación.

**C. Tienda — App**

- Desarrollo
- Inventario
- Gestión de pedidos
- Automatizaciones
- Mejoras administrativas
- Integraciones futuras

**D. Sombreros Montana — Operaciones**

- Pedidos
- Generación de contenido
- Shopify
- WhatsApp Business
- Catálogo de productos
- Publicidad
- Mejoras comerciales

Los nombres de proyectos deben poder editarse. También debe ser posible crear nuevos proyectos.

## 5. Sistema de tareas

Cada tarea debe incluir:

- Nombre
- Descripción opcional
- Proyecto asociado
- Prioridad: alta, media o baja
- Fecha programada
- Duración estimada
- Estado: pendiente, en progreso, completada o bloqueada
- Notas adicionales
- Subtareas opcionales

### Funciones importantes

- Crear tareas rápidamente.
- Arrastrar tareas entre fechas y bloques.
- Repetir tareas diariamente o semanalmente.
- Mover pendientes automáticamente a una bandeja de reprogramación, sin cambiar las fechas originales del historial.
- Filtrar tareas por proyecto, prioridad y estado.
- Permitir tareas independientes de cualquier proyecto.

## 6. Temporizador de productividad

Incluir un cronómetro integrado en cada bloque de trabajo.

Características:

- Iniciar, pausar y finalizar.
- Registrar tiempo real invertido.
- Comparar duración prevista con duración real.
- Permitir continuar una actividad al día siguiente.
- Registrar interrupciones sin perder el progreso.

La aplicación debe guardar automáticamente el estado del cronómetro.

## 7. Calendario semanal

Crear una vista de lunes a domingo que permita identificar:

- Bloques de trabajo.
- Tareas terminadas.
- Actividades pendientes.
- Proyectos que necesitan atención.
- Espacios disponibles.

Permitir cambiar entre vista diaria, semanal y mensual.

Los bloques recurrentes deben aparecer automáticamente en las fechas correspondientes.

## 8. Panel de estadísticas

Desarrollar indicadores sencillos:

- Horas trabajadas por día.
- Horas dedicadas a cada aplicación.
- Porcentaje de tareas completadas.
- Cumplimiento de la agenda semanal.
- Tiempo dedicado a operaciones de la tienda.
- Tareas pendientes y vencidas.

Incluir gráficos discretos, claros y fáciles de interpretar.

No convertir esta sección en un dashboard financiero.

## 9. Diseño visual

El diseño debe ser premium, minimalista y moderno, inspirado en aplicaciones como Linear, Things 3 y Notion Calendar.

### Identidad

- Tonos crema y blanco cálido.
- Café oscuro y gris carbón.
- Verde oliva como color de acento.
- Tipografía moderna, clara y legible.
- Bordes suaves y sombras discretas.
- Iconografía minimalista.
- Espaciados generosos.

### Experiencia

- Interfaz rápida.
- Animaciones sutiles.
- Modo claro y oscuro.
- Menú lateral compacto.
- Navegación sencilla.
- Sin exceso de botones ni ventanas emergentes.

La agenda debe ser protagonista visual.

## 10. Notificaciones

Implementar recordatorios locales configurables para:

- Inicio de una actividad.
- Finalización del bloque programado.
- Tareas prioritarias pendientes.
- Cierre de jornada a las 2:00 p. m.

Las notificaciones deben funcionar mientras la aplicación está ejecutándose, incluso si la ventana está minimizada.

## 11. Persistencia y privacidad

- La aplicación debe funcionar sin conexión a internet.
- Guardar toda la información localmente mediante SQLite.
- Mantener los datos al cerrar y reiniciar la aplicación.
- Permitir exportar tareas, proyectos y registros en JSON o CSV.
- Permitir copias de seguridad y restauración.
- No depender de servicios de pago ni suscripciones.
- No requerir iniciar sesión para utilizarla.

## 12. Requisitos técnicos

Utilizar preferiblemente:

- Tauri 2 para la aplicación de escritorio.
- React con TypeScript.
- Tailwind CSS.
- SQLite para almacenamiento.
- Librería de componentes consistente y accesible.
- Arquitectura modular y mantenible.

Si existe una alternativa técnica más conveniente, justificarla antes de implementarla.

La aplicación debe ejecutarse en Windows y permitir generar un instalador.

## 13. Orden de desarrollo

**Fase 1 — Base funcional**

- Crear proyecto.
- Configurar base de datos.
- Implementar navegación principal.
- Construir agenda diaria.
- Añadir proyectos y tareas.
- Implementar guardado local.

**Fase 2 — Planificación**

- Bloques recurrentes.
- Reprogramación.
- Calendario semanal y mensual.
- Reglas especiales de los lunes.
- Temporizador por actividad.

**Fase 3 — Productividad**

- Estadísticas.
- Notificaciones locales.
- Filtros.
- Copias de seguridad.

**Fase 4 — Refinamiento**

- Mejoras visuales.
- Pruebas funcionales.
- Optimización.
- Corrección de errores.
- Generación del instalador de Windows.

## 14. Criterios de aceptación

El proyecto estará listo cuando:

1. Pueda abrir la agenda y saber inmediatamente qué debo hacer.
2. Pueda añadir, editar, completar y reprogramar tareas.
3. Se respeten mis bloques de tiempo y las reglas del lunes.
4. Los datos permanezcan después de cerrar y abrir la aplicación.
5. Pueda registrar el tiempo real de trabajo.
6. Pueda consultar el avance de las tres aplicaciones en desarrollo.
7. Pueda modificar horarios y proyectos sin tocar el código.
8. Pueda generar un instalador y usar la aplicación sin internet.
9. Las funciones principales cuenten con pruebas y no presenten errores conocidos que impidan su uso.

## 15. Instrucciones finales para Codex

Actúa como un ingeniero de software senior especializado en aplicaciones de escritorio y experiencia de usuario.

Desarrolla Montana Agenda siguiendo este brief.

Antes de programar, revisa el repositorio, identifica su estado y crea un plan técnico breve.

Después, implementa la aplicación progresivamente, comenzando por una versión mínima completamente funcional.

Prioriza la estabilidad, la persistencia de datos y la facilidad de uso por encima de funciones decorativas.

No agregues funcionalidades que no aparezcan en el brief sin justificar su utilidad.

Verifica el funcionamiento real de cada módulo mediante pruebas. No afirmes haber probado una función si no has podido ejecutarla.

Mantén el código modular, documentado y preparado para futuras ampliaciones.

Al terminar cada fase, informa qué implementaste, qué probaste, qué falta y cómo ejecutar la aplicación.

**Resultado esperado:** Una aplicación real de escritorio, instalable, funcional y lista para utilizarse diariamente, no solamente un prototipo visual.
