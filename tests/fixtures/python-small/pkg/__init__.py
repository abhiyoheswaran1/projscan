"""Test fixture package: minimal Python project projscan uses to exercise
the language adapter end-to-end. Not runnable code - intended for parsing."""

from .core import greet
from .utils import PREFIX

__all__ = ['greet', 'PREFIX']
