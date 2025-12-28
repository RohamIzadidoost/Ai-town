from pydantic import BaseModel, Field
from typing import Dict, Optional, Literal, Any
from .game.actions import Action, RoleID
from .game.state import GameState

class StartSimRequest(BaseModel):
    topic: str = "Water crisis policy"
    rounds: int = Field(default=2, ge=1, le=10)
    model: str = "llama3"
    temperature: float = Field(default=0.4, ge=0.0, le=2.0)
    scenario: Dict = Field(default_factory=dict)

WSEventType = Literal[
    "session_start","turn_start","action_selected","delta","turn_end",
    "round_end","judge_scores","state_update","decision","payoffs",
    "done","stopped","error"
]

class WSEvent(BaseModel):
    type: WSEventType
    role: Optional[RoleID] = None
    action: Optional[Action] = None
    text: Optional[str] = None
    message: Optional[str] = None
    state: Optional[GameState] = None
    data: Optional[Dict[str, Any]] = None
