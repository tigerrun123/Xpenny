const initialState = {
  totalXpen: 24800,
  agents: 48,
  actions: 1240,
  cycles: 0,
  yieldRate: 12.8,
};

const state = { ...initialState };

const events = [
  "A post cluster pushed fresh XPEN emissions into the pool.",
  "Call agents found a high-conviction signal and boosted yield.",
  "Like agents raised reputation scores across the network.",
  "Reply agents amplified the social loop and minted new XPEN.",
  "Sites agents packaged raw content into a shareable interactive app.",
  "Annotation agents circled a target change and patched it in place.",
  "The treasury recycled inactive yield back into active agents.",
];

const elements = {
  totalXpen: document.querySelector("#total-xpen"),
  agents: document.querySelector("#agents"),
  actions: document.querySelector("#actions"),
  cycles: document.querySelector("#cycles"),
  yieldRate: document.querySelector("#yield-rate"),
  yieldMeter: document.querySelector("#yield-meter"),
  cycleStatus: document.querySelector("#cycle-status"),
  activityList: document.querySelector("#activity-list"),
  runCycle: document.querySelector("#run-cycle"),
  reset: document.querySelector("#reset"),
  openclawForm: document.querySelector("#openclaw-form"),
  openclawInput: document.querySelector("#openclaw-input"),
  openclawLog: document.querySelector("#openclaw-log"),
  openclawStatus: document.querySelector("#openclaw-status"),
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function render() {
  elements.totalXpen.textContent = formatNumber(state.totalXpen);
  elements.agents.textContent = formatNumber(state.agents);
  elements.actions.textContent = formatNumber(state.actions);
  elements.cycles.textContent = formatNumber(state.cycles);
  elements.yieldRate.textContent = `${state.yieldRate.toFixed(1)}%`;
  elements.yieldMeter.style.width = `${Math.min(100, state.yieldRate * 3.8)}%`;
}

function addActivity(message) {
  const item = document.createElement("li");
  item.className = "is-new";
  item.innerHTML = `
    <span>${String(state.cycles).padStart(2, "0")}</span>
    <p>${message}</p>
  `;

  elements.activityList.prepend(item);

  while (elements.activityList.children.length > 3) {
    elements.activityList.lastElementChild.remove();
  }
}

function runCycle() {
  const activityGain = 80 + Math.random() * 220;
  const tokenGain = activityGain * (4 + Math.random() * 3);
  const yieldGain = (Math.random() - 0.35) * 1.4;
  const agentGain = Math.random() > 0.68 ? 1 : 0;

  state.cycles += 1;
  state.actions += activityGain;
  state.totalXpen += tokenGain;
  state.agents += agentGain;
  state.yieldRate = Math.max(6, Math.min(26, state.yieldRate + yieldGain));

  const message = events[Math.floor(Math.random() * events.length)];
  elements.cycleStatus.textContent = `Cycle ${state.cycles} complete. ${message}`;
  addActivity(message);
  render();
}

function reset() {
  Object.assign(state, initialState);
  elements.activityList.innerHTML = `
    <li>
      <span>01</span>
      <p>Xpenny agents scan X for fresh social momentum.</p>
    </li>
    <li>
      <span>02</span>
      <p>High-signal posts and calls trigger XPEN emissions.</p>
    </li>
    <li>
      <span>03</span>
      <p>Likes and replies increase reputation for active agents.</p>
    </li>
  `;
  elements.cycleStatus.textContent = "Agents are warming up for the first cycle.";
  render();
}

function appendAgentMessage(kind, label, text) {
  const item = document.createElement("article");
  item.className = kind === "user" ? "user-message" : "agent-message";

  const name = document.createElement("span");
  name.textContent = label;

  const body = document.createElement("p");
  body.textContent = text;

  item.append(name, body);
  elements.openclawLog.append(item);
  item.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function extractReply(payload) {
  return (
    payload?.reply ||
    payload?.message ||
    payload?.output_text ||
    payload?.output ||
    payload?.text ||
    payload?.data?.reply ||
    payload?.data?.message ||
    ""
  );
}

async function askOpenClaw(event) {
  event.preventDefault();

  const message = elements.openclawInput.value.trim();

  if (!message) {
    return;
  }

  const button = elements.openclawForm.querySelector("button");
  elements.openclawInput.value = "";
  elements.openclawInput.disabled = true;
  button.disabled = true;
  elements.openclawStatus.textContent = "Contacting AWS OpenClaw...";
  appendAgentMessage("user", "You", message);

  try {
    const response = await fetch("/api/openclaw/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        source: "xpenny-farcaster-miniapp",
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `OpenClaw bridge returned HTTP ${response.status}`);
    }

    appendAgentMessage("agent", "OpenClaw", extractReply(payload) || "No reply text returned.");
    elements.openclawStatus.textContent = payload.configured
      ? "Connected to AWS OpenClaw."
      : "Netlify bridge is live; AWS endpoint is not configured yet.";
  } catch (error) {
    appendAgentMessage("agent", "Bridge", error.message);
    elements.openclawStatus.textContent = "OpenClaw bridge needs attention.";
  } finally {
    elements.openclawInput.disabled = false;
    button.disabled = false;
    elements.openclawInput.focus();
  }
}

elements.runCycle.addEventListener("click", runCycle);
elements.reset.addEventListener("click", reset);
elements.openclawForm.addEventListener("submit", askOpenClaw);

render();

async function signalFarcasterReady() {
  try {
    const { sdk } = await import("https://esm.sh/@farcaster/miniapp-sdk");
    await sdk.actions.ready();
  } catch (error) {
    console.warn("Farcaster Mini App SDK ready signal skipped:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", signalFarcasterReady, { once: true });
} else {
  signalFarcasterReady();
}
