// check-cast.js
// Validates if the Langfuse library actually has the methods defined in our custom interface.
// Run with: node --experimental-vm-modules bug-fix/check-cast.js (or just node if package.json is type:module)

import { Langfuse } from 'langfuse';

const requiredMethods = ['trace', 'span', 'generation', 'score', 'shutdownAsync'];
const optionalMethods = ['flushAsync'];

console.log("Checking Langfuse Library Interface...");

try {
    // Create a dummy instance (won't connect, just checks structure)
    const dummyClient = new Langfuse({
        publicKey: 'pk-lf-test',
        secretKey: 'sk-lf-test',
        baseUrl: 'http://localhost:3000'
    });

    let missing = [];
    
    // Check required methods
    for (const method of requiredMethods) {
        if (typeof dummyClient[method] !== 'function') {
            missing.push(method);
        }
    }

    if (missing.length > 0) {
        console.error(`❌ BUG CONFIRMED: Required methods missing in Langfuse lib: ${missing.join(', ')}`);
        process.exit(1);
    } else {
        console.log("✅ All required methods exist in Langfuse library.");
    }

    // Check optional methods
    for (const method of optionalMethods) {
        if (dummyClient[method] && typeof dummyClient[method] !== 'function') {
            console.warn(`⚠️ WARNING: Optional method ${method} exists but is not a function.`);
        }
    }

    // Cleanup
    await dummyClient.shutdownAsync();
    process.exit(0);

} catch (e) {
    console.error("❌ Error initializing Langfuse:", e.message);
    process.exit(1);
}
