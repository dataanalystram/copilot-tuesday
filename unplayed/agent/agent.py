"""
Unplayed — multi-agent LangGraph that invents and plays a novel 2-player game.

Agent architecture (3 specialized LLM personas):
  Chronicler  (temp 0.95, creative)  → invents game rules + board + visual identity
  Arbiter     (temp 0.05, precise)   → validates + explains rules
  Oracle      (temp 0.35, strategic) → makes AI moves

Graph flow:
  START → invent_rules → validate_rules → init_game
        → (loop) route_turn
                 ├─ ai_move_node → check_winner_node → route_turn
                 └─ (human turn: wait for next user message)
        → END
"""

import json
import os
import random
import uuid
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from copilotkit.langgraph import copilotkit_emit_state

from .state import GameState
from .prompts import (
    ARBITER_SYSTEM,
    CHRONICLER_SYSTEM,
    MOVE_VALIDATOR_SYSTEM,
    ORACLE_SYSTEM,
    WINNER_CHECK_SYSTEM,
)

# ── LLM factory ───────────────────────────────────────────────────────────────

_OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:14b")
_OLLAMA_BASE  = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

def _llm(temperature: float) -> ChatOllama:
    return ChatOllama(
        model=_OLLAMA_MODEL,
        base_url=_OLLAMA_BASE,
        temperature=temperature,
        format="json",
        num_predict=4096,
    )

# ── Expansive flavor palette ───────────────────────────────────────────────────

_MECHANICS = [
    "territorial-capture",
    "chain-reaction cascade",
    "racing-advance",
    "bridge-building",
    "encirclement siege",
    "element-conversion",
    "displacement combat",
    "line-of-sight control",
    "sacrifice gambit",
    "flood-fill spread",
    "sentinel defense",
    "orbital swap",
    "trap-and-spring",
    "resource harvesting",
    "mirror reflection",
]

_THEMES = [
    "neon cyberpunk hacking",
    "ancient mythological gods",
    "deep space warfare",
    "underground gladiatorial combat",
    "volatile elemental alchemy",
    "viral outbreak containment",
    "pirate naval conquest",
    "quantum physics entanglement",
    "volcanic tectonic eruption",
    "arctic survival expedition",
    "medieval siege warfare",
    "neural network storm",
    "abyssal deep-sea horror",
    "lightning storm racing",
    "bio-mechanical evolution",
    "shadow assassin espionage",
    "crystal cave mining",
    "time-fracture manipulation",
]

_ARCHETYPES = [
    "Two rival AIs battle for total dominion over a fractured server grid",
    "Ancient war gods place divine tokens across a sacred battlefield to claim supremacy",
    "Elite hackers exploit zero-day vulnerabilities across an enemy network in real time",
    "Warriors build walls and deadly traps to corner and eliminate a dangerous foe",
    "Rival alchemists transmute cells into volatile reactive elements that chain-explode",
    "Two viral strains compete for cellular dominance inside a host organism",
    "Storm generals unleash precision lightning strikes across a war-torn landscape",
    "Rival pirate admirals claim sea routes and blockade enemy harbors",
    "Rival mages cast cascading spells that flip, burn, or freeze adjacent tiles",
    "Tunnel miners race to claim ore veins while collapsing rival shafts",
    "Starship captains navigate treacherous asteroid fields to reach the enemy core",
    "Shadow assassins claim territory invisibly while setting ambushes for detection",
    "Crystal golem commanders direct mineral growth to surround enemy formations",
    "Time-fracture scientists place unstable temporal mines across a collapsing timeline",
]

_SIZES = [4, 5, 6]


def _parse_json(text: str) -> dict:
    """Extract the first JSON object from an LLM response."""
    text = text.strip()
    start = text.find("{")
    end   = text.rfind("}") + 1
    if start == -1 or end == 0:
        return {}
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {}


def _board_to_text(board: dict) -> str:
    cells = board.get("cells", {})
    size  = board.get("size", 5)
    lines = []
    for r in range(size):
        row_label = chr(65 + r)
        row = []
        for c in range(1, size + 1):
            cid = f"{row_label}{c}"
            val = cells.get(cid, {}).get("value", "")
            row.append(f"{cid}:{val or '.'}")
        lines.append("  ".join(row))
    return "\n".join(lines)


def _empty_cells(board: dict) -> list[dict]:
    cells = board.get("cells", {})
    return [
        {"id": cid, "label": cid, "description": "available"}
        for cid, cell in cells.items()
        if not cell.get("value")
    ]

# ── Node 1: Chronicler invents the game ───────────────────────────────────────

async def invent_rules_node(state: GameState, config) -> dict[str, Any]:
    size     = random.choice(_SIZES)
    flavor   = {
        "seed"      : str(uuid.uuid4())[:8].upper(),
        "mechanic"  : random.choice(_MECHANICS),
        "theme"     : random.choice(_THEMES),
        "topology"  : "grid",
        "size"      : size,
        "total"     : size * size,
        "last_row"  : chr(64 + size),
        "archetype" : random.choice(_ARCHETYPES),
    }
    await copilotkit_emit_state(config, {
        **state,
        "phase": "inventing",
        "flavor": flavor,
        "agent_activity": f"Chronicler is forging a {flavor['theme']} game…",
        "rules": [],
        "game_name": "",
        "tagline": "",
    })

    prompt = CHRONICLER_SYSTEM.format(**flavor)
    model  = _llm(temperature=0.95)
    resp   = await model.ainvoke([SystemMessage(content=prompt)])
    data   = _parse_json(resp.content)

    rules = data.get("rules", [])
    board = data.get("board", {})

    # Ensure all cells are populated
    if not board.get("cells") or len(board.get("cells", {})) < size * size:
        cells = {}
        for r in range(size):
            for c in range(1, size + 1):
                cid = f"{chr(65+r)}{c}"
                cells[cid] = {"value": "", "label": cid, "special": ""}
        board = {"topology": "grid", "size": size, "cells": cells}
    else:
        # Normalize — clear any stray values
        for cid in board["cells"]:
            board["cells"][cid]["value"] = ""

    return {
        "phase"            : "validating",
        "flavor"           : flavor,
        "game_name"        : data.get("game_name", "Unnamed Conflict"),
        "tagline"          : data.get("tagline", ""),
        "rules"            : rules,
        "board"            : board,
        "victory_condition": data.get("victory_condition", rules[-1] if rules else ""),
        "piece_icon_human" : data.get("piece_icon_human", "⚡"),
        "piece_icon_ai"    : data.get("piece_icon_ai", "☯"),
        "board_palette"    : data.get("board_palette", "void"),
        "agent_activity"   : "Arbiter is stress-testing the rules…",
        "winner"           : "",
        "move_count"       : 0,
        "history"          : [],
    }

# ── Node 2: Arbiter validates & explains ──────────────────────────────────────

async def validate_rules_node(state: GameState, config) -> dict[str, Any]:
    await copilotkit_emit_state(config, {
        **state,
        "phase": "validating",
        "agent_activity": "Arbiter is checking rule consistency…",
    })

    payload = {
        "game_name"        : state["game_name"],
        "rules"            : state["rules"],
        "board"            : state["board"],
        "victory_condition": state.get("victory_condition", ""),
    }
    model = _llm(temperature=0.05)
    resp  = await model.ainvoke([
        SystemMessage(content=ARBITER_SYSTEM),
        HumanMessage(content=json.dumps(payload)),
    ])
    data = _parse_json(resp.content)

    validated_rules    = data.get("rules", state["rules"])
    explanation        = data.get("explanation", "")
    victory_condition  = data.get("victory_condition", state.get("victory_condition", ""))
    legal              = _empty_cells(state["board"])

    return {
        "phase"            : "explaining",
        "rules"            : validated_rules,
        "victory_condition": victory_condition,
        "rules_explanation": explanation,
        "legal_moves"      : legal,
        "turn"             : "human",
        "agent_activity"   : "",
    }

# ── Node 3: route whose turn it is ────────────────────────────────────────────

def route_turn_node(state: GameState) -> str:
    if state.get("winner"):
        return "end_game_node"
    if state.get("turn") == "ai":
        return "ai_move_node"
    return END

# ── Node 4: Oracle makes AI move ──────────────────────────────────────────────

async def ai_move_node(state: GameState, config) -> dict[str, Any]:
    await copilotkit_emit_state(config, {
        **state,
        "agent_activity": "Oracle is calculating optimal position…",
    })

    rules_text   = "\n".join(f"{i+1}. {r}" for i, r in enumerate(state["rules"]))
    history_text = json.dumps(state["history"][-6:], indent=2) if state["history"] else "No moves yet."
    vic_cond     = state.get("victory_condition") or (state["rules"][-1] if state["rules"] else "Fill the board.")

    prompt = ORACLE_SYSTEM.format(
        game_name=state["game_name"],
        rules_text=rules_text,
        victory_condition=vic_cond,
        board_text=_board_to_text(state["board"]),
        history_text=history_text,
    )
    model = _llm(temperature=0.35)
    resp  = await model.ainvoke([SystemMessage(content=prompt)])
    data  = _parse_json(resp.content)

    move        = data.get("move", {})
    reasoning   = data.get("reasoning", "")
    board_after = data.get("board_after", {})

    updated_board = dict(state["board"])
    if board_after:
        updated_board["cells"] = {**updated_board.get("cells", {}), **board_after}
    elif move.get("id"):
        cid   = move["id"]
        cells = dict(updated_board.get("cells", {}))
        if cid in cells:
            cells[cid] = {**cells[cid], "value": "ai"}
        updated_board["cells"] = cells

    new_history = list(state["history"]) + [{
        "player"   : "ai",
        "move"     : move,
        "reasoning": reasoning,
    }]

    legal = _empty_cells(updated_board)
    return {
        "board"        : updated_board,
        "history"      : new_history,
        "ai_reasoning" : reasoning,
        "turn"         : "human",
        "legal_moves"  : legal,
        "agent_activity": "",
        "move_count"   : state.get("move_count", 0) + 1,
    }

# ── Node 5: check winner after AI move ────────────────────────────────────────

async def check_winner_after_ai(state: GameState, config) -> dict[str, Any]:
    rules_text = "\n".join(f"{i+1}. {r}" for i, r in enumerate(state["rules"]))
    vic_cond   = state.get("victory_condition") or (state["rules"][-1] if state["rules"] else "Fill the board.")

    prompt = WINNER_CHECK_SYSTEM.format(
        rules_text=rules_text,
        victory_condition=vic_cond,
        board_text=_board_to_text(state["board"]),
        history_text=json.dumps(state["history"][-4:]),
    )
    model = _llm(temperature=0.0)
    resp  = await model.ainvoke([SystemMessage(content=prompt)])
    data  = _parse_json(resp.content)

    winner      = data.get("winner", "")
    legal_moves = data.get("legal_moves_for_human", _empty_cells(state["board"]))

    phase  = "ended" if winner else "playing"
    result = {"winner": winner, "phase": phase, "legal_moves": legal_moves}
    if winner:
        await copilotkit_emit_state(config, {**state, **result, "agent_activity": ""})
    return result

# ── Node 6: process human move ────────────────────────────────────────────────

async def process_human_move_node(state: GameState, config) -> dict[str, Any]:
    messages   = state.get("messages", [])
    last_human = next(
        (m for m in reversed(messages) if getattr(m, "type", "") == "human"),
        None,
    )
    human_text = last_human.content if last_human else ""

    rules_text = "\n".join(f"{i+1}. {r}" for i, r in enumerate(state["rules"]))
    vic_cond   = state.get("victory_condition") or (state["rules"][-1] if state["rules"] else "Fill the board.")

    prompt = MOVE_VALIDATOR_SYSTEM.format(
        rules_text=rules_text,
        victory_condition=vic_cond,
        board_text=_board_to_text(state["board"]),
        human_message=human_text,
        size=state["board"].get("size", 5),
    )
    model = _llm(temperature=0.0)
    resp  = await model.ainvoke([SystemMessage(content=prompt)])
    data  = _parse_json(resp.content)

    valid       = data.get("valid", False)
    move        = data.get("move", {})
    board_after = data.get("board_after", {})
    legal_moves = data.get("legal_moves", _empty_cells(state["board"]))

    if not valid:
        return {
            "turn"          : "human",
            "legal_moves"   : legal_moves,
            "agent_activity": f"⚠ {data.get('reason', 'Invalid move — try another cell.')}",
        }

    updated_board = dict(state["board"])
    if board_after:
        updated_board["cells"] = {**updated_board.get("cells", {}), **board_after}
    elif move.get("id"):
        cid   = move["id"]
        cells = dict(updated_board.get("cells", {}))
        if cid in cells:
            cells[cid] = {**cells[cid], "value": "human"}
        updated_board["cells"] = cells

    new_history = list(state["history"]) + [{"player": "human", "move": move}]

    # Quick winner check after human move
    check_prompt = WINNER_CHECK_SYSTEM.format(
        rules_text=rules_text,
        victory_condition=vic_cond,
        board_text=_board_to_text(updated_board),
        history_text=json.dumps(new_history[-4:]),
    )
    check_resp = await model.ainvoke([SystemMessage(content=check_prompt)])
    check_data = _parse_json(check_resp.content)
    winner     = check_data.get("winner", "")
    legal      = check_data.get("legal_moves_for_human", _empty_cells(updated_board))

    phase = "ended" if winner else "playing"
    return {
        "board"         : updated_board,
        "history"       : new_history,
        "winner"        : winner,
        "phase"         : phase,
        "turn"          : "ai" if not winner else "none",
        "legal_moves"   : legal,
        "agent_activity": "",
        "move_count"    : state.get("move_count", 0) + 1,
    }

# ── Node 7: end game ──────────────────────────────────────────────────────────

async def end_game_node(state: GameState, config) -> dict[str, Any]:
    await copilotkit_emit_state(config, {
        **state,
        "phase": "ended",
        "agent_activity": "",
    })
    return {"phase": "ended"}

# ── Routing edges ──────────────────────────────────────────────────────────────

def _should_continue(state: GameState) -> str:
    if state.get("winner"):
        return "end_game_node"
    if state.get("phase") in ("inventing", "validating"):
        return END
    if state.get("turn") == "ai":
        return "ai_move_node"
    return END


def _after_ai_move(state: GameState) -> str:
    if state.get("winner"):
        return "end_game_node"
    return END


def _is_new_game(state: GameState) -> str:
    phase = state.get("phase", "idle")
    if phase in ("idle", "inventing", "validating"):
        return "invent_rules_node"
    return "process_human_move_node"

# ── Build the graph ────────────────────────────────────────────────────────────

workflow = StateGraph(GameState)

workflow.add_node("invent_rules_node",      invent_rules_node)
workflow.add_node("validate_rules_node",    validate_rules_node)
workflow.add_node("process_human_move_node",process_human_move_node)
workflow.add_node("ai_move_node",           ai_move_node)
workflow.add_node("check_winner_after_ai",  check_winner_after_ai)
workflow.add_node("end_game_node",          end_game_node)

workflow.add_conditional_edges(START, _is_new_game, {
    "invent_rules_node"      : "invent_rules_node",
    "process_human_move_node": "process_human_move_node",
})

workflow.add_edge("invent_rules_node", "validate_rules_node")
workflow.add_edge("validate_rules_node", END)

workflow.add_conditional_edges("process_human_move_node", _should_continue, {
    "ai_move_node" : "ai_move_node",
    "end_game_node": "end_game_node",
    END            : END,
})

workflow.add_edge("ai_move_node", "check_winner_after_ai")
workflow.add_conditional_edges("check_winner_after_ai", _after_ai_move, {
    "end_game_node": "end_game_node",
    END            : END,
})

workflow.add_edge("end_game_node", END)

graph = workflow.compile(checkpointer=MemorySaver())
