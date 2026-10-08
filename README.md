# Montana Agenda

Agenda local de Sombreros Montana, en español. React + TypeScript + Tailwind CSS, escritorio Tauri 2 y SQLite. No necesita cuentas ni servicios de pago. La interfaz abre directamente **Mi día**.

Esta es una implementación inicial funcional con pruebas de lógica, persistencia y navegador. **Todavía no es una versión Windows validada para uso diario:** falta ejecutar la aplicación nativa y probar el instalador, los recordatorios con ventana minimizada y el funcionamiento sin conexión en Windows.

## Ejecutar

### Windows: escritorio

Requisitos: Node.js 24, Rust 1.99.0, Visual Studio Build Tools con la carga «Desarrollo para escritorio con C++», Windows SDK y WebView2. La instalación de dependencias y la compilación requieren Internet; la aplicación instalada utiliza recursos y datos locales.

```powershell
npm ci
npm run desktop:dev
```

Para generar el instalador NSIS:

```powershell
npm run desktop:build
```

El `.exe` se genera en `src-tauri/target/release/bundle/nsis/`. La configuración incluye el instalador WebView2 sin conexión y el idioma español. **No se generó ni ejecutó un instalador Windows en esta máquina Linux.** El workflow `.github/workflows/windows.yml` permite compilarlo en un runner Windows al enviar los cambios al repositorio o ejecutarlo manualmente; no se ha enviado código ni iniciado ese workflow.

### Entorno cloud: desarrollo y pruebas

```bash
cd /workspace/agenda_1
bash scripts/cloud-setup.sh
source scripts/cloud-env.sh
npm run dev
```

El servidor de desarrollo utiliza el puerto 1420. No requiere backend HTTP ni una base de datos externa. La vista de navegador emplea SQLite WebAssembly con persistencia en IndexedDB para permitir desarrollo y pruebas en Linux. Es una base independiente de la que utiliza el escritorio. Borrar los datos del sitio borra esta base; exporta respaldos para trasladar información.

Las dependencias Linux se descargan desde índices Debian firmados y se extraen en `/workspace/.montana-tools`, sin instalar paquetes del sistema. Esto permite **compilar** Tauri. El arranque gráfico está bloqueado en esta máquina: WebKit busca `WebKitNetworkProcess` y otros auxiliares en `/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/`, pero esa ruta no está instalada y el entorno impide crear un montaje de usuario. Para probar el escritorio Linux se necesita una imagen con `libwebkit2gtk-4.1-0` y sus dependencias instaladas en el sistema y una pantalla/Xvfb. No se debe desactivar el sandbox de WebKit como solución.

```bash
source scripts/cloud-env.sh
cargo build --locked --manifest-path src-tauri/Cargo.toml --features desktop -j 2
```

Cada tarea cloud ya está aislada. Utiliza el checkout existente; no crees un Git worktree salvo petición explícita.

## Qué incluye cada fase

| Fase              | Implementación                                                                                                                                                                                                                                                                         | Validación y pendientes                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Base          | Navegación, agenda diaria, cuatro proyectos iniciales, alta/edición/eliminación y estados de tareas, subtareas y SQLite local                                                                                                                                                          | Compilación web y Tauri Linux; pruebas Rust de reapertura y escrituras inválidas; navegador comprueba guardado tras recarga. Falta arranque nativo Windows.                                                         |
| 2 · Planificación | Jornada editable, bloques recurrentes de lunes a viernes, una hora Shopify los lunes, ajuste proporcional hasta las 14:00, calendario diario/semanal/mensual, reprogramación con fecha original, asignación de tareas a bloques, arrastre, tareas recurrentes y cronómetro persistente | Pruebas de horarios, lunes, recurrencia independiente, cronómetro y navegador. El arrastre cambia el orden; para cambiar duración utiliza Reprogramar o Ajustes. Falta comprobar estos flujos en la ventana nativa. |
| 3 · Productividad | Estadísticas de tiempo, proyectos y cumplimiento; comparación prevista/real e interrupciones; filtros; exportación JSON/CSV y restauración validada; recordatorios locales con permiso                                                                                                 | Navegador verifica filtros, exportación y restauración. Recordatorios nativos y minimización pendientes de prueba en Windows.                                                                                       |
| 4 · Refinamiento  | Diseño crema/oliva, modo oscuro, interfaz adaptable, accesibilidad básica, bloqueo de respaldos inválidos, permisos mínimos y workflow Windows                                                                                                                                         | Compilación y pruebas automatizadas disponibles. Faltan pruebas manuales Windows, empaquetado, instalación, reinicio y comprobación sin Internet.                                                                   |

La recurrencia genera ocurrencias independientes cuando se abre una fecha o vista, aunque las anteriores sigan pendientes. Al completar una tarea se prepara la siguiente sin duplicarla. Las tareas diarias incluyen fines de semana; los bloques laborales no. La bandeja de reprogramación muestra tareas vencidas sin alterar automáticamente sus fechas.

Los bloques se completan manualmente; el porcentaje de jornada representa bloques completados, no únicamente el paso del reloj. El tiempo real proviene de sesiones finalizadas; Mi día también incluye el cronómetro activo. Finalizar guarda el tiempo; Completar guarda el tiempo y marca el bloque. Pausar registra una interrupción. El cierre normal del escritorio guarda el cronómetro pausado; ese cierre nativo todavía requiere validación. Tras un cierre forzado, un cronómetro activo recupera el tiempo transcurrido desde su última marca.

Los recordatorios se activan en Ajustes: inicio y fin de bloque, prioridades al comenzar y cierre de jornada. La aplicación debe permanecer ejecutándose. No hay servicio en segundo plano después de cerrar.

## Datos y respaldo

En escritorio, `montana.sqlite` se guarda en el directorio de datos de aplicación de Tauri para `com.sombrerosmontana.agenda` (habitualmente bajo `%APPDATA%` en Windows). Cada actualización reemplaza un documento JSON versionado dentro de una transacción SQLite; WAL y sincronización FULL protegen la escritura. La escala de una agenda individual permite mantener un modelo simple y portable sin introducir un servidor.

En Ajustes, **Copia JSON** exporta proyectos, tareas, bloques, configuración, cronómetro e historial. **Restaurar copia** valida el formato, pide confirmación antes de reemplazar datos y pausa el cronómetro restaurado. **Exportar CSV** incluye proyectos, tareas y registros de tiempo. Los respaldos se guardan donde indique la descarga del sistema. Conserva copias antes de restaurar o borrar datos del sitio.

## Pruebas

```bash
npm run build
npm test
npm run test:e2e
cargo test --locked --manifest-path src-tauri/Cargo.toml --no-default-features -j 2
```

En cloud, ejecuta primero `source scripts/cloud-env.sh`. Playwright usa `/usr/bin/chromium` en Linux. En otras máquinas, instala Chromium con `npx playwright install chromium`; se puede indicar su ejecutable con `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

La suite de dominio prueba horarios, Shopify, límites de jornada, fechas, recurrencia sin duplicados, cronómetro e historial. Rust prueba SQLite real al reabrir la conexión y verifica que escrituras inválidas no borren datos anteriores. Playwright recorre creación/completado/edición de tareas, proyectos, persistencia, cronómetro, filtros, calendario, tema, subtareas, bloques, exportación y restauración.

## Estructura

- `src/domain.ts`: modelo versionado, planificación, recurrencia y registros.
- `src/storage.ts`: SQLite nativo y SQLite WebAssembly/IndexedDB para desarrollo.
- `src/components/`: editor y lista de tareas, proyectos y estadísticas.
- `src/App.tsx`: agenda, calendario, ajustes y coordinación de guardado/cronómetro.
- `src-tauri/src/lib.rs`: persistencia transaccional y comandos del escritorio.
- `tests/`: pruebas de dominio y flujos en navegador.
- `scripts/`: preparación reproducible del entorno cloud y recurso WASM local.
- `docs/BRIEF.md`: brief original.

La configuración reusable del entorno se guarda como borrador (`install_script` y `start_skill`). Revisar/guardar y publicar en la configuración del entorno son pasos separados; el borrador no equivale a una publicación ni a validar una nueva máquina.
