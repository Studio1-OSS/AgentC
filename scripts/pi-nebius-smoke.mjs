import {
  createAgentSession,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import {
  NEBIUS_PROVIDER_ID,
  buildNebiusPiProviderRegistration,
  resolveLlmProviderConfig,
} from "@agentc/protocol";

const llm = resolveLlmProviderConfig(process.env);
console.log("llm", { providerId: llm.providerId, modelId: llm.modelId, baseUrl: llm.baseUrl });

const agentDir = "/tmp/pi-spike-test/agent";
const cwd = "/tmp/pi-spike-test/project";
const runtime = await ModelRuntime.create({
  authPath: `${agentDir}/auth.json`,
  modelsPath: `${agentDir}/models.json`,
});
runtime.registerProvider(NEBIUS_PROVIDER_ID, buildNebiusPiProviderRegistration(llm));
await runtime.setRuntimeApiKey(NEBIUS_PROVIDER_ID, llm.apiKey);

const model = runtime.getModel(llm.providerId, llm.modelId);
console.log("model", model ? { id: model.id, provider: model.provider, api: model.api, baseUrl: model.baseUrl } : null);
if (!model) {
  console.error("available", runtime.getModels(llm.providerId).map(m => m.id));
  process.exit(1);
}

const { session } = await createAgentSession({
  cwd,
  agentDir,
  modelRuntime: runtime,
  model,
  sessionManager: SessionManager.inMemory(),
});

session.subscribe((event) => {
  if (event.type === "message_update") {
    console.log("UPDATE", event.assistantMessageEvent?.type, JSON.stringify(event.assistantMessageEvent).slice(0, 200));
  } else if (event.type === "message_end") {
    console.log("END", event.message?.role, JSON.stringify(event.message).slice(0, 400));
  } else if (event.type === "tool_execution_start") {
    console.log("TOOL", event.toolName);
  } else {
    console.log("EVENT", event.type);
  }
});

try {
  await session.prompt("Respond with only this exact token: <<SPIKE_OK>>");
  console.log("\nLAST", typeof session.getLastAssistantText === "function" ? session.getLastAssistantText() : "(n/a)");
} catch (e) {
  console.error("PROMPT_ERROR", e);
  process.exit(1);
} finally {
  session.dispose();
}
