"""Validate a required OpenSSH host-key pin without exposing its value."""

import base64
import os
import re
import sys


def is_valid_fingerprint(value):
    if not isinstance(value, str) or not re.fullmatch(r"SHA256:[A-Za-z0-9+/]{43}", value):
        return False
    digest = base64.b64decode(value[7:] + "=", validate=True)
    return len(digest) == 32 and base64.b64encode(digest).decode("ascii").rstrip("=") == value[7:]


def main():
    if not is_valid_fingerprint(os.environ.get("ECAFE_DEV_SSH_FINGERPRINT")):
        print("::error::SSH host fingerprint configuration is missing or invalid.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
