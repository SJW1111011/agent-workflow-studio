// Re-export the CommonJS entry so import and require share one module instance.
import cjs from "./index.js";

export const workspace = cjs.workspace;
export default cjs;
