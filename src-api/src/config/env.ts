// Load .env before any module that captures process.env in module scope.
// Keep this as the first import in src/index.ts; ESM evaluates dependencies
// before the importing module's body.
try {
  process.loadEnvFile();
} catch {
  try {
    process.loadEnvFile('../.env');
  } catch {
    // Production environments inject variables directly.
  }
}
