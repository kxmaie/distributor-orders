import { buildApp } from "./app";
import { config } from "./config";

buildApp()
  .then((app) => app.listen({ port: config.PORT, host: "0.0.0.0" }))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
