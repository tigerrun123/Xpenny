from google.adk import Agent

from .openclaw_tools import call_openclaw


root_agent = Agent(
    name="openclaw_bridge_agent",
    model="gemini-2.5-flash",
    description="Bridges Google ADK conversations to an OpenClaw HTTP endpoint.",
    instruction=(
        "You are an OpenClaw bridge agent. "
        "For user requests that should be handled by OpenClaw, call call_openclaw "
        "with the user's message and the requested OpenClaw agent name when provided. "
        "When the user says 'ask openclaw' or 'ask OpenClaw', remove that routing phrase "
        "from the message before calling the tool. "
        "For restaurant lookup or restaurant location questions, call call_openclaw "
        "with agent='restaurant_main'. "
        "If the user does not specify an OpenClaw agent name, use the default agent. "
        "Return the OpenClaw reply directly and clearly to the user. "
        "Do not invent OpenClaw responses when the tool reports an error; explain the error instead."
    ),
    tools=[call_openclaw],
)
