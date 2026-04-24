from .utils import PREFIX
from .sub.deep import deep_helper


def greet(name: str) -> str:
    return PREFIX + name + deep_helper()


def _internal():
    pass


VERSION = "0.1.0"
