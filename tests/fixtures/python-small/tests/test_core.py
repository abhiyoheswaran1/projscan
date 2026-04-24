from pkg.core import greet


def test_greet():
    assert "hello" in greet("world").lower()
