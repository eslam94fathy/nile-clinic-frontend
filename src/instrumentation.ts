export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateConfigurationOrExit } =
      await import("@/lib/config/validate-on-startup");
    validateConfigurationOrExit();
  }
}
