"""
Monkey patches for the ERC7730 library to fix issues with field access and serialization.
Import this module before using any ERC7730 functions.
"""

import json
from typing import Any, Dict, List, Optional, Union
import importlib.util
import sys

# Check if the erc7730 module is available
erc7730_spec = importlib.util.find_spec("erc7730")
if erc7730_spec is None:
    raise ImportError("erc7730 module not found. Please install it with 'pip install erc7730'")

# Import necessary modules
from erc7730.model.input.display import InputFieldDescription
from erc7730.generate import generate

# Safe attribute access function
def safe_get_field_attr(field: Any, attr_name: str, default: Any = None) -> Any:
    """
    Safely access attributes of field objects, handling various object types.
    This is used to fix issues with accessing attributes on frozen Pydantic models.
    """
    if hasattr(field, attr_name):
        return getattr(field, attr_name)
    
    # Handle dict-like objects
    if hasattr(field, "get") and callable(field.get):
        return field.get(attr_name, default)
    
    # Handle InputFieldDescription/InputFieldBase
    if hasattr(field, "field_description") and field.field_description:
        if hasattr(field.field_description, attr_name):
            return getattr(field.field_description, attr_name)
        if hasattr(field.field_description, "get") and callable(field.field_description.get):
            return field.field_description.get(attr_name, default)
    
    # For direct access on the object
    if isinstance(field, dict):
        return field.get(attr_name, default)
    
    return default

# Function to make Pydantic models JSON serializable
def make_serializable(obj: Any) -> Any:
    """
    Make a Pydantic model JSON serializable.
    Handles frozen models by creating a dictionary copy.
    """
    if hasattr(obj, "model_dump"):
        # Pydantic v2
        return obj.model_dump()
    if hasattr(obj, "dict"):
        # Pydantic v1
        return obj.dict()
    if hasattr(obj, "__dict__"):
        # Regular objects with __dict__
        return {k: make_serializable(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    if isinstance(obj, list):
        return [make_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    # For other types, convert to a string
    return str(obj)

# Patch the generate_descriptor function to handle serialization properly
original_generate_descriptor = generate.generate_descriptor

def patched_generate_descriptor(*args, **kwargs):
    """
    Patched version of generate_descriptor that ensures the result can be properly serialized.
    """
    result = original_generate_descriptor(*args, **kwargs)
    
    # Convert the result to a serializable format if needed
    if hasattr(result, "json"):
        # If it has a json method, use it
        try:
            # First try to use the built-in json serialization
            json_str = result.json()
            return json.loads(json_str)
        except Exception:
            # If that fails, use our custom serialization
            serializable = make_serializable(result)
            return serializable
    
    return result

# Apply the monkey patch
generate.generate_descriptor = patched_generate_descriptor

# Log that the patches have been applied
print("ERC7730 library patches applied successfully.") 