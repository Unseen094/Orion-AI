"""Module-level singletons for the tool registry + orchestrator."""

from .orchestrator import Orchestrator
from .clipboard_tools import ClipboardTools
from .system_info import SystemInfoTools
from .tools.base import ToolRegistry
from .tools.project_tools import ProjectTools
from .tools.search_tools import NotesTools, SearchTools
from .tools.system_tools import SystemTools
from .utility_tools import UtilityTools
from .yard_tools import CodingYardTools, ResearchYardTools

registry = ToolRegistry()
registry.register(ProjectTools())
registry.register(SearchTools())
registry.register(NotesTools())
registry.register(SystemTools())
registry.register(SystemInfoTools())
registry.register(ClipboardTools())
registry.register(UtilityTools())
registry.register(CodingYardTools())
registry.register(ResearchYardTools())

orchestrator = Orchestrator(registry)
