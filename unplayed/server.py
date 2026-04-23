"""
Unplayed agent server — FastAPI + AG-UI endpoint.

Run:
  cd unplayed
  pip install -r requirements.txt
  python server.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent

from agent.agent import graph

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

app = FastAPI(title="Unplayed Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "agent": "unplayed"}


add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="unplayed",
        description="Invents a never-before-seen 2-player game and plays you.",
        graph=graph,
    ),
    path="/",
)

if __name__ == "__main__":
    port = int(os.getenv("UNPLAYED_PORT", "8123"))
    print(f"[unplayed] starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=False)
