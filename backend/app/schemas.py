from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class StartSimRequest(BaseModel):
    topic: str = "Water crisis policy"
    rounds: int = 2
    model: str = "llama3"
    temperature: float = 0.4
    scenario: Dict = Field(default_factory=dict)

class WSOutEvent(BaseModel):
    type: str
    role: Optional[str] = None
    text: Optional[str] = None
    message: Optional[str] = None
    data: Optional[Dict] = None
