import { adminToken, api, liveAccounts } from "./support";

export default async function teardown() {
  if (!process.env.LIVE_ACCOUNTS) return;

  const token = await adminToken();
  for (const { id } of Object.values(liveAccounts())) {
    // Some are already deactivated by the tests, which the API refuses harmlessly.
    await api(`staff/${String(id)}/deactivate`, { method: "POST", token });
  }
  await api("auth/sign-out", { method: "POST", token });
}
