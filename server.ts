import app, { configureViteMiddleware } from "./src/serverApp";

const PORT = 3000;

async function run() {
  await configureViteMiddleware(app);
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

run();
