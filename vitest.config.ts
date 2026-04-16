export default {
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.js"],
    testTimeout: 30000,
    fileParallelism: false,
    watchExclude: ["coverage/**", "dist/**", ".agent-workflow/**", "tmp/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "json-summary", "lcov"],
      all: true,
      // Keep the threshold on the focused library modules with stable unit coverage;
      // dashboard surfaces and broader task-ledger flows continue to rely on smoke/integration checks.
      include: ["src/lib/**/*.js"],
      exclude: [
        "src/lib/dashboard-execution.js",
        "src/lib/mcp-install.js",
        "src/lib/mcp-tools.js",
        "src/lib/schema-validator.js",
        "src/lib/task-service.js",
        "src/lib/fs-utils.ts",
        "test/**",
        "scripts/**",
        "dist/**",
      ],
      thresholds: {
        lines: 85,
      },
    },
  },
};
