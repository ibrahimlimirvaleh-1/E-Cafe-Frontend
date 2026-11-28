"""Offline deployment guard tests: synthetic pins only, no SSH or secrets."""

import base64
import copy
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import unittest

import yaml

from validate_ssh_fingerprint import is_valid_fingerprint


ROOT = Path(__file__).resolve().parents[1]
PIN_SECRET = "${{ secrets.ECAFE_DEV_SSH_FINGERPRINT }}"
VALIDATION_COMMAND = "python3 scripts/validate_ssh_fingerprint.py"
GENERIC_ERROR = "::error::SSH host fingerprint configuration is missing or invalid.\n"


def pin(data):
    return "SHA256:" + base64.b64encode(hashlib.sha256(data).digest()).decode("ascii").rstrip("=")


def workflow(name):
    return yaml.load((ROOT / ".github/workflows" / name).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def assert_deploy_guards(test, document):
    job = document["jobs"]["deploy"]
    test.assertEqual(job["environment"], "dev")
    test.assertNotIn("ECAFE_DEV_SSH_FINGERPRINT", document.get("env", {}))
    test.assertNotIn("ECAFE_DEV_SSH_FINGERPRINT", job.get("env", {}))
    steps = job["steps"]
    guards = [i for i, step in enumerate(steps) if step.get("run") == VALIDATION_COMMAND]
    test.assertEqual(len(guards), 1)
    guard_index = guards[0]
    guard = steps[guard_index]
    test.assertEqual(guard["shell"], "bash")
    test.assertEqual(guard["env"], {"ECAFE_DEV_SSH_FINGERPRINT": PIN_SECRET})
    for key in ("if", "continue-on-error"):
        test.assertNotIn(key, guard)
        test.assertNotIn(key, job)
    remotes = [(i, step) for i, step in enumerate(steps)
               if step.get("uses", "").startswith(("appleboy/scp-action@", "appleboy/ssh-action@"))]
    test.assertEqual([step["uses"] for _, step in remotes],
                     ["appleboy/scp-action@v0.1.7", "appleboy/ssh-action@v1.0.3"])
    for index, step in remotes:
        test.assertLess(guard_index, index)
        test.assertEqual(step["with"]["fingerprint"], PIN_SECRET)
        test.assertEqual(step["with"]["host"], "${{ secrets.ECAFE_DEV_HOST }}")
        test.assertEqual(step["with"]["username"], "${{ secrets.ECAFE_DEV_USER }}")
        test.assertEqual(step["with"]["key"], "${{ secrets.ECAFE_DEV_SSH_KEY }}")
        test.assertNotIn("if", step)
        test.assertNotIn("continue-on-error", step)
    for step in steps:
        for key in ("run",):
            test.assertNotIn(PIN_SECRET, step.get(key, ""))
        test.assertNotIn(PIN_SECRET, step.get("with", {}).get("script", ""))


class FingerprintValidationTests(unittest.TestCase):
    def test_canonical_sha256_digests(self):
        for data in (b"", b"fixture", bytes(range(256)), b"another isolated host"):
            with self.subTest(data=data):
                self.assertTrue(is_valid_fingerprint(pin(data)))

    def test_full_base64_alphabet(self):
        for digest in (bytes(32), bytes([255]) * 32, bytes([251]) * 32):
            self.assertTrue(is_valid_fingerprint("SHA256:" + base64.b64encode(digest).decode().rstrip("=")))

    def test_missing_empty_and_non_string(self):
        for value in (None, "", 0, False, [], {}):
            with self.subTest(value=value):
                self.assertFalse(is_valid_fingerprint(value))

    def test_whitespace_is_not_trimmed(self):
        for whitespace in (" ", "\t", "\r", "\n", "\r\n", "\u00a0", "\u200b"):
            for value in (whitespace, whitespace + pin(b"x"), pin(b"x") + whitespace):
                with self.subTest(value=value):
                    self.assertFalse(is_valid_fingerprint(value))

    def test_malformed_and_multiple_pins(self):
        valid = pin(b"fixture")
        for value in ("MD5:" + "ab:" * 16, valid.lower(), valid + "=", valid[1:], valid[:-1],
                      valid + "A", "SHA256:" + "_" * 43, "SHA256:" + "-" * 43,
                      "SHA256:" + "A" * 42 + "é", valid + "," + valid, valid + "\n" + valid,
                      "$(echo unsafe)", "'; exit 0; #", valid[:20] + "\x00" + valid[21:]):
            with self.subTest(value=value):
                self.assertFalse(is_valid_fingerprint(value))

    def test_noncanonical_pad_bits_are_rejected(self):
        self.assertFalse(is_valid_fingerprint("SHA256:" + "A" * 42 + "B"))
        self.assertFalse(is_valid_fingerprint("SHA256:" + "A" * 42 + "/"))

    def run_validator(self, value):
        environment = os.environ.copy()
        environment.pop("ECAFE_DEV_SSH_FINGERPRINT", None)
        if value is not None:
            environment["ECAFE_DEV_SSH_FINGERPRINT"] = value
        return subprocess.run([sys.executable, str(ROOT / "scripts/validate_ssh_fingerprint.py")],
                              env=environment, capture_output=True, text=True, timeout=10)

    def test_cli_success_is_silent(self):
        result = self.run_validator(pin(b"isolated cli fixture"))
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_cli_errors_are_generic_and_do_not_leak_input(self):
        for value in (None, "", "  ", pin(b"x") + "\n", "SECRET-NONSECRET-TEST-MARKER",
                      "$(echo SECRET-NONSECRET-TEST-MARKER)", "SHA256:" + "A" * 42 + "B"):
            with self.subTest(value=value):
                result = self.run_validator(value)
                self.assertEqual((result.returncode, result.stdout, result.stderr), (1, "", GENERIC_ERROR))


class DeploymentWorkflowTests(unittest.TestCase):
    def test_preflight_and_both_actions_are_required_and_pinned(self):
        assert_deploy_guards(self, workflow("deploy-dev.yml"))

    def test_ci_executes_offline_guards_without_deploy_secrets(self):
        document = workflow("ci.yml")
        steps = document["jobs"]["build"]["steps"]
        checks = [step for step in steps if step.get("name") == "Verify deploy SSH fingerprint guards"]
        self.assertEqual(len(checks), 1)
        self.assertIn("PyYAML==6.0.3", checks[0]["run"])
        self.assertIn("python3 -m unittest discover -s scripts -p 'test_deploy_ssh_fingerprint.py' -v", checks[0]["run"])
        self.assertNotIn("if", checks[0])
        self.assertNotIn("continue-on-error", checks[0])
        self.assertNotIn("secrets.", checks[0]["run"])
        self.assertIn("dev", document["on"]["pull_request"]["branches"])

    def test_packaging_and_remote_operations_remain_unchanged(self):
        document = workflow("deploy-dev.yml")
        job = document["jobs"]["deploy"]
        self.assertEqual(job["env"], {"APP_PATH": "${{ secrets.ECAFE_DEV_PATH || '/opt/ecafe' }}"})
        steps = {step["name"]: step for step in job["steps"]}
        upload = steps["Upload frontend source"]["with"]
        self.assertEqual(upload, {
            "host": "${{ secrets.ECAFE_DEV_HOST }}", "username": "${{ secrets.ECAFE_DEV_USER }}",
            "key": "${{ secrets.ECAFE_DEV_SSH_KEY }}", "fingerprint": PIN_SECRET,
            "source": "frontend-source.tar.gz",
            "target": "${{ env.APP_PATH }}/deploy-packages/${{ github.sha }}", "rm": "true",
        })
        self.assertEqual(steps["Package frontend source"]["run"], """tar \\
  --exclude='.git' \\
  --exclude='node_modules' \\
  --exclude='dist' \\
  --exclude='.env' \\
  --exclude='.env.*' \\
  -czf "$RUNNER_TEMP/frontend-source.tar.gz" .
cp "$RUNNER_TEMP/frontend-source.tar.gz" frontend-source.tar.gz
""")
        self.assertEqual(steps["Deploy frontend"]["with"]["script"], """set -euo pipefail
APP_PATH="${{ env.APP_PATH }}"
PACKAGE_DIR="$APP_PATH/deploy-packages/${{ github.sha }}"

rm -rf "$APP_PATH/frontend"
mkdir -p "$APP_PATH/frontend"
tar -xzf "$PACKAGE_DIR/frontend-source.tar.gz" -C "$APP_PATH/frontend"
rm -rf "$PACKAGE_DIR"

cd "$APP_PATH"
docker compose build frontend
docker compose up -d frontend
docker compose ps
""")
        self.assertNotIn("permissions", document)
        self.assertNotIn("permissions", job)

    def test_regression_audit_detects_removed_or_bypassed_guards(self):
        original = workflow("deploy-dev.yml")
        mutations = []
        for action in ("appleboy/scp-action@v0.1.7", "appleboy/ssh-action@v1.0.3"):
            for value in (None, "", "${{ secrets.OTHER_FINGERPRINT }}"):
                changed = copy.deepcopy(original)
                target = next(step for step in changed["jobs"]["deploy"]["steps"] if step.get("uses") == action)
                if value is None:
                    del target["with"]["fingerprint"]
                else:
                    target["with"]["fingerprint"] = value
                mutations.append(changed)
        for field, value in (("if", "always()"), ("continue-on-error", "true"),
                             ("run", 'echo "${{ secrets.ECAFE_DEV_SSH_FINGERPRINT }}"')):
            changed = copy.deepcopy(original)
            guard = next(step for step in changed["jobs"]["deploy"]["steps"] if step.get("run") == VALIDATION_COMMAND)
            guard[field] = value
            mutations.append(changed)
        changed = copy.deepcopy(original)
        steps = changed["jobs"]["deploy"]["steps"]
        steps.append(steps.pop(next(i for i, step in enumerate(steps) if step.get("run") == VALIDATION_COMMAND)))
        mutations.append(changed)
        changed = copy.deepcopy(original)
        changed["jobs"]["deploy"]["environment"] = "production"
        mutations.append(changed)
        for index, changed in enumerate(mutations):
            with self.subTest(mutation=index), self.assertRaises((AssertionError, KeyError)):
                assert_deploy_guards(self, changed)


if __name__ == "__main__":
    unittest.main()
