/** Server startup hook — hydrate ERISA index from Neon without blocking requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { kickoffErisaIndexHydration } = await import(
      "./lib/import/erisa/hydrateIndex"
    );
    kickoffErisaIndexHydration();

    if (process.env.HEALTH_PLAN_PERSISTENT_SOURCE === "1") {
      const { kickoffHealthPlanIndexHydration } = await import(
        "./lib/import/healthPlans/hydrateIndex"
      );
      kickoffHealthPlanIndexHydration();
    }
  }
}
