"""
Test configuration — auto-clean state files between tests
to prevent inter-test pollution from persistence layer.
"""
import os
import pytest
from pathlib import Path


STATE_FILES = [
    "data/miner_registry.json",
    "data/task_manager.json",
    "data/poi_state.json",
]


@pytest.fixture(autouse=True)
def clean_state_files():
    """Remove state files before and after each test to ensure isolation."""
    project_root = Path(__file__).parent.parent

    # Clean before test
    for sf in STATE_FILES:
        fp = project_root / sf
        if fp.exists():
            fp.unlink()

    yield

    # Clean after test
    for sf in STATE_FILES:
        fp = project_root / sf
        if fp.exists():
            fp.unlink()
