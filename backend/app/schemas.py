from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = Field(default_factory=list)
    model: str = "gemini-2.5-flash"
    offline: bool = False


class ApiKeyRequest(BaseModel):
    api_key: str


class ModelRequest(BaseModel):
    model: str


class SettingsUpdate(BaseModel):
    offline_mode: bool | None = None
    sim_mode: bool | None = None
    tts_enabled: bool | None = None
    tts_voice: str | None = None
    tts_engine: str | None = None
    tts_gemini_voice: str | None = None
    stt_lang: str | None = None


class ProvidersUpdate(BaseModel):
    providers: list[dict] = Field(default_factory=list)


class ProviderTest(BaseModel):
    provider: dict = Field(default_factory=dict)


class CreateProjectRequest(BaseModel):
    name: str
    template: str | None = None


class FilePayload(BaseModel):
    path: str
    content: str


class SummaryRequest(BaseModel):
    query: str
    results: list[dict] = Field(default_factory=list)
    model: str = "gemini-2.5-flash"
    offline: bool = False


class NoteCreate(BaseModel):
    text: str
    tags: list[str] = Field(default_factory=list)


class SystemActionRequest(BaseModel):
    text: str | None = None
    x: int | None = None
    y: int | None = None
    button: str = "left"
    keys: str | None = None
    delay: float = 0.0


class TtsRequest(BaseModel):
    text: str
    voice: str | None = None


class McpExecuteRequest(BaseModel):
    server: str
    tool: str
    args: dict = Field(default_factory=dict)


class EventsRequest(BaseModel):
    subscribe: bool = True
