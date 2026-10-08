import { test, expect } from "@playwright/test";
test("SQLite conserva tareas, proyectos, estado y temporizador tras recargar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tu día, con intención." }),
  ).toBeVisible();
  await page.getByLabel("Fecha de agenda").fill("2026-10-05");
  await expect(
    page.getByRole("heading", { name: "Página web Shopify" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Revisar inventario");
  await page
    .getByRole("combobox", { name: "Proyecto", exact: true })
    .selectOption("store");
  await page
    .getByRole("combobox", { name: "Prioridad", exact: true })
    .selectOption("alta");
  await page.getByRole("button", { name: "Guardar tarea" }).click();
  await expect(page.getByText("Guardado local", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Tareas/ }).click();
  await expect(
    page.getByRole("button", { name: /Revisar inventario/ }).first(),
  ).toBeVisible();
  await page.getByLabel("Completar Revisar inventario").first().click();
  await expect(page.getByText("Guardado local", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Tareas/ }).click();
  await expect(
    page.locator(".task-state").filter({ hasText: "completada" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Proyectos", exact: true }).click();
  page.once("dialog", (d) => d.accept("Proyecto de prueba"));
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(
    page.getByRole("heading", { name: "Proyecto de prueba" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mi día", exact: true }).click();
  await page.getByLabel("Fecha de agenda").fill("2026-10-06");
  await page
    .getByRole("button", {
      name: "Iniciar Desarrollo App Fábrica 1",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Pausar", exact: true }).last(),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.getByText("Guardado local", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pausar", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pausar", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Finalizar", exact: true }).click();
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copia JSON" })).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Copia JSON" }).click();
  expect((await downloading).suggestedFilename()).toMatch(/montana-.*\.json/);
});
test("reprogramación, filtros, calendario y tema", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Tarea vencida");
  await page.getByLabel("Fecha", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Guardar tarea" }).click();
  await page.getByRole("button", { name: /^Tareas/ }).click();
  await expect(
    page.getByRole("heading", { name: "Bandeja de reprogramación" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept("2027-01-01"));
  await page.getByLabel("Reprogramar Tarea vencida").first().click();
  await expect(page.getByText(/Original: 2026-01-01/)).toBeVisible();
  await page.getByLabel("Filtrar prioridad").selectOption("alta");
  await expect(page.getByRole("button", { name: /Tarea vencida/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Calendario", exact: true }).click();
  await page.getByLabel("Vista del calendario").selectOption("mes");
  await expect(page.locator(".calendar-day")).toHaveCount(31);
  await page.getByLabel("Cambiar tema").click();
  await expect(page.locator(".app")).toHaveClass("app dark");
  await expect(page.getByText("Guardado local", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".app")).toHaveClass("app dark");
});

test("subtareas, asignación a bloques, edición, respaldo y arrastre de bloques", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Fecha de agenda").fill("2026-10-06");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Probar fábrica");
  await dialog.getByLabel("Nueva subtarea").fill("Verificar datos");
  await dialog.getByRole("button", { name: "Añadir", exact: true }).click();
  await dialog.getByLabel("Bloque de agenda").selectOption("b1");
  await dialog.getByRole("button", { name: "Guardar tarea" }).click();
  await expect(
    page.locator(".block").first().getByText("Probar fábrica"),
  ).toBeVisible();
  await page
    .locator(".block")
    .first()
    .getByRole("button", { name: "Probar fábrica", exact: true })
    .click();
  await dialog.getByRole("checkbox", { name: /Verificar datos/ }).check();
  await dialog.getByLabel("Nombre", { exact: true }).fill("Fábrica validada");
  await dialog.getByRole("button", { name: "Guardar tarea" }).click();
  await expect(
    page.locator(".block").first().getByText("Fábrica validada"),
  ).toBeVisible();
  await page.locator(".block").nth(1).dragTo(page.locator(".block").first());
  await expect(page.locator(".block h3").first()).toHaveText(
    "Desarrollo App Fábrica 2",
  );
  await expect(page.getByText("Guardado local", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel("Fecha de agenda").fill("2026-10-06");
  await expect(page.locator(".block h3").first()).toHaveText(
    "Desarrollo App Fábrica 2",
  );
  await page.getByRole("button", { name: "Ajustes", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Copia JSON" }).click();
  const download = await downloading;
  const backup = await download.path();
  expect(backup).not.toBeNull();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "incorrecto.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":1}'),
    });
  await expect(page.getByRole("alert")).toContainText(
    "Formato de respaldo inválido",
  );
  await page.getByLabel("Cerrar error").click();
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles(backup!);
  await expect(page.getByRole("status")).toContainText("Copia restaurada");
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole("button", { name: /^Tareas/ }).click();
  await page
    .locator(".task-text")
    .filter({ hasText: "Fábrica validada" })
    .first()
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: /Verificar datos/ }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
});
