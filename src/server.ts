import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { registerApiShutdown } from "./infra/shutdown.ts";

const port = config.PORT;
const app = createApp();
const server = app.listen(port, "0.0.0.0", () => console.log(`Eventify on :${port}`));
registerApiShutdown(server);
