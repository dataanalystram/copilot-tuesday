from copilotkit import CopilotKitState


class GameState(CopilotKitState):
    """Full game state shared between Python agents and React UI."""

    # Game lifecycle
    phase: str = "idle"
    # idle → inventing → validating → explaining → playing → ended

    # Game identity
    game_name: str = ""
    tagline: str = ""
    flavor: dict = {}
    # {mechanic, theme, topology, size, archetype, seed}

    # Visual identity — set by Chronicler, rendered by UI
    piece_icon_human: str = "⚪"
    piece_icon_ai: str = "🔵"
    board_palette: str = "void"
    # palette: fire | ice | forest | void | gold | cyber | blood | neon

    # Rules — invented by Chronicler, validated by Arbiter
    rules: list = []
    rules_explanation: str = ""
    victory_condition: str = ""

    # Board — flexible dict keyed by cell id
    board: dict = {}
    # {cells: {"A1": {"value": "", "label": "A1", "special": ""}}, size: int}

    # Play
    turn: str = "none"       # none | ai | human
    history: list = []       # [{player, move, reasoning}]
    legal_moves: list = []   # [{id, label, description}]
    winner: str = ""         # "" | "ai" | "human" | "draw"
    move_count: int = 0

    # Streaming hints
    ai_reasoning: str = ""
    agent_activity: str = ""
