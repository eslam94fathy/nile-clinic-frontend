import { z } from "zod";

// The security policy forbids `eval` (ADR 0021), and Zod otherwise probes for it once with `Function("")`, which
// the browser reports as a violation. Zod then takes its slower path anyway, so this only skips the probe.
z.config({ jitless: true });
