LOG_TOOLS: list[dict] = []


def registrar_tool(tool: str, **args):
    LOG_TOOLS.append({"tool": tool, "args": args})
