/** Server startup hook — hydrate warehouse indexes from Neon without blocking requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { kickoffErisaIndexHydration } = await import(
      "./lib/import/erisa/hydrateIndex"
    );
    kickoffErisaIndexHydration();

    const { kickoffOrganizationWarehouseHydration, isOrganizationWarehouseEnabled } =
      await import("./lib/import/warehouse");
    if (isOrganizationWarehouseEnabled()) {
      kickoffOrganizationWarehouseHydration();
    }
  }
}
