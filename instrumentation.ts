/** Server startup hook — hydrate ERISA index from Neon without blocking requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { kickoffErisaIndexHydration } = await import(
      "./lib/import/erisa/hydrateIndex"
    );
    kickoffErisaIndexHydration();
  }
}
