import os

PREFIX = os.environ.get("GREETER_PREFIX", "hello, ")


def format_line(s: str) -> str:
    return s.strip()
