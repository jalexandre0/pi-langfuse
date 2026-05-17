import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resolveConfig } from "../src/config.js";
import {
	flushClient,
	getClient,
	shutdownClient,
} from "../src/langfuse-client.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env.test if exists
const envPath = path.resolve(process.cwd(), '.env.test');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

interface LangfuseTraceResponse {
	name: string;
	id: string;
	tags: string[];
	input?: unknown;
	output?: unknown;
	metadata?: Record<string, unknown>;
	observations: Array<{
		name: string;
		input?: unknown;
		output?: unknown;
		model?: string;
		usage?: {
			total?: number;
		};
	}>;
}

const LANGFUSE_HOST = process.env.LANGFUSE_HOST || "http://192.168.45.2:3100";
const LANGFUSE_PUBLIC_KEY = process.env.LANGFUSE_PUBLIC_KEY;
const LANGFUSE_SECRET_KEY = process.env.LANGFUSE_SECRET_KEY;

const TEST_MODEL = process.env.TEST_MODEL || "gpt-3.5-turbo";
const TEST_PROMPT = process.env.TEST_PROMPT || "What is the capital of Brazil?";
const TEST_EXPECTED_OUTPUT = process.env.TEST_EXPECTED_OUTPUT || "Brasília";
const TEST_INPUT_CONTEXT = process.env.TEST_INPUT_CONTEXT || "geography";

const skipE2E =
	process.env.RUN_LANGFUSE_E2E !== "1" ||
	!LANGFUSE_PUBLIC_KEY ||
	!LANGFUSE_SECRET_KEY;

describe.runIf(!skipE2E)("Langfuse E2E Integration (Real)", () => {
	const config = resolveConfig({});
	const testId = "e2e-verification-" + randomUUID(); console.log("TRACE_ID:", testId);

	beforeEach(async () => {
		await shutdownClient();
	});

	it("should ingest trace and verify payload via API", async () => {
		// 1. Setup client (uses keys from config / env)
		const lf = await getClient(config);

		// 2. Create Trace with specific payload
		const traceInput = { prompt: TEST_PROMPT, context: TEST_INPUT_CONTEXT };
		const traceOutput = { answer: TEST_EXPECTED_OUTPUT, confidence: 0.99 };

		const trace = lf.trace({
			name: "e2e-real-pi-test",
			id: testId,
			tags: ["env:e2e-real", "test:payload-verification"],
			input: traceInput,
			output: traceOutput,
			metadata: { testRunner: "vitest", purpose: "validate payload" },
		});

		// 3. Create Generation (simulating LLM call)
		const generation = lf.generation({
			name: "e2e-real-generation",
			traceId: trace.id,
			model: TEST_MODEL,
			input: TEST_PROMPT,
			metadata: { source: "test-script" },
		});

		// Simulate output
		generation.end({
			output: TEST_EXPECTED_OUTPUT,
			usage: { total: 20, input: 10, output: 10 },
		});

		// 4. Force flush to server
		await flushClient();

		// 5. Verify via API (GET /api/public/traces/:id)
		const auth = Buffer.from(
			`${config.publicKey}:${config.secretKey}`,
		).toString("base64");
		const apiUrl = `${LANGFUSE_HOST}/api/public/traces/${testId}`;

		let retrievedTrace: LangfuseTraceResponse | null = null;
		let attempts = 0;
		const maxAttempts = 10;

		while (attempts < maxAttempts) {
			const response = await fetch(apiUrl, {
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/json",
				},
			});

			if (response.ok) {
				retrievedTrace = (await response.json()) as LangfuseTraceResponse;
				break;
			}

			attempts++;
			await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s
		}

		// 6. Assertions (Business Logic)
		expect(retrievedTrace).toBeDefined();
		if (!retrievedTrace) throw new Error(`Trace ${testId} was not retrieved`);

		// Check Trace Payload
		expect(retrievedTrace.name).toBe("e2e-real-pi-test");
		expect(retrievedTrace.id).toBe(testId);
		expect(retrievedTrace.tags).toContain("env:e2e-real");
		expect(retrievedTrace.input).toEqual(traceInput); // <-- REAL PAYLOAD CHECK
		expect(retrievedTrace.output).toEqual(traceOutput); // <-- REAL PAYLOAD CHECK

		// Check Observation (Generation) Payload
		expect(retrievedTrace.observations).toBeDefined();
		expect(retrievedTrace.observations.length).toBeGreaterThanOrEqual(1);

		const genObs = retrievedTrace.observations.find(
			(o) => o.name === "e2e-real-generation",
		);
		expect(genObs).toBeDefined();
		if (!genObs) throw new Error("Generation observation was not retrieved");
		
		expect(genObs.model).toBe(TEST_MODEL);
		expect(genObs.input).toBe(TEST_PROMPT);
		expect(genObs.output).toBe(TEST_EXPECTED_OUTPUT);
		expect(genObs?.usage?.total).toBe(20);

	}, 30000); // 30s timeout for E2E
});
