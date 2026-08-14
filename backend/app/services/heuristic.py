"""Fast, synchronous intent classifier. The safety net that guarantees
Orion always picks a Yard, even if the model call fails."""

CODING_WORDS = [
    "code", "coding", "build", "create an app", "create a", "make me", "develop", "program",
    "react", "dashboard", "website", "web app", "api", "python", "javascript", "typescript",
    "project", "app", "frontend", "backend", "monaco", "editor", "script", "function",
    "todo app", "to-do", "component", "npm", "debug", "fix", "refactor", "ui", "feature",
    "deploy", "write code", "programming", "software", "clone", "scaffold", "template",
]

RESEARCH_WORDS = [
    "research", "investigate", "quantum", "physics", "science", "paper", "study",
    "find out", "look up", "summary", "summarize", "compare", "analyze", "analysis",
    "history", "what is", "who is", "explain", "why", "how does", "learn", "facts",
    "knowledge", "news", "article", "sources", "biology", "astronomy", "philosophy",
    "economics", "medicine", "climate", "space", "ai research",
]

SYSTEM_WORDS = [
    "type", "notepad", "open notepad", "keyboard", "mouse", "click", "move mouse",
    "press", "open app", "launch", "calculator", "write in", "type out", "open a file",
    "scroll", "open the browser", "browser", "open url", "go to ", "open ",
    "clipboard", "copy that", "copy this", "to clipboard", "notify", "popup",
    "screenshot", "what's on my screen", "system info", "system information",
    "show system info", "what's open", "open windows", "how much ram", "cpu",
    "disk space", "free disk", "uptime",
]

CLOSING_WORDS = ["goodbye", "thanks", "thank you", "close the yard", "close yard", "go home", "back to home"]

YARD_WEIGHTS = {
    "coding": CODING_WORDS,
    "research": RESEARCH_WORDS,
    "system": SYSTEM_WORDS,
}


def classify(message: str) -> dict:
    """Returns {yard: 'coding'|'research'|'system'|'home'|None, confidence: 0..1}"""
    text = message.lower().strip()
    if not text:
        return {"yard": None, "confidence": 0.0}

    if any(w in text for w in CLOSING_WORDS):
        return {"yard": "home", "confidence": 0.9}

    scores: dict[str, int] = {}
    for yard, words in YARD_WEIGHTS.items():
        scores[yard] = sum(1 for w in words if w in text)

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return {"yard": None, "confidence": 0.0}

    total = sum(scores.values())
    confidence = round(scores[best] / max(total, 1), 2)
    
    # Boost confidence for strong signals
    if scores[best] >= 2:
        confidence = min(confidence + 0.2, 1.0)
    
    return {"yard": best, "confidence": confidence}
