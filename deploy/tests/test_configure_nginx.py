"""Regression tests for safe, repeatable nginx site candidate generation."""

import importlib.util
from pathlib import Path
import sys
import unittest

SPEC = importlib.util.spec_from_file_location(
    "configure_nginx", Path(__file__).resolve().parents[1] / "configure-nginx.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

SITE = '''# Existing routes must remain byte-for-byte intact.
server {
    listen 192.168.10.10:80;
    server_name acserver.csie.org;
    location /larp { return 308 https://acserver.csie.org$request_uri; }
}
server {
    listen 192.168.10.10:443 ssl;
    server_name acserver.csie.org;
    ssl_certificate /etc/cert.pem;
    location /trading/ { proxy_pass http://127.0.0.1:8765; }
}
'''


class ConfigureTests(unittest.TestCase):
    def test_preservation_and_idempotency(self):
        result = MODULE.configure(SITE)
        self.assertEqual(MODULE.configure(result), result)
        restored = result
        for block in MODULE.BLOCKS.values():
            self.assertEqual(result.count(block), 1)
            restored = restored.replace(block, "")
        self.assertEqual(restored, SITE)

    def test_comments_quotes_escapes_and_variables(self):
        site = SITE.replace('ssl_certificate /etc/cert.pem;', r'''
    # } { ignored comment
    set $example "quoted } { # ;";
    set $other 'single { }';
    set $escaped escaped\{brace\};
    set $variable ${request_uri};
''')
        result = MODULE.configure(site)
        for block in MODULE.BLOCKS.values():
            result = result.replace(block, "")
        self.assertEqual(result, site)

    def test_conflicting_routes_and_includes(self):
        for directive in (
            'location = /bridge_online { return 404; }',
            'location ^~ /bridge_online/ { return 404; }',
            'location ~ "^/bridge_online" { return 404; }',
            'include /etc/nginx/snippets/bridge-online.conf;',
        ):
            with self.subTest(directive=directive), self.assertRaises(ValueError):
                MODULE.configure(SITE.replace('ssl_certificate /etc/cert.pem;', directive))

    def test_duplicate_server(self):
        with self.assertRaises(ValueError):
            MODULE.configure(SITE + SITE)

    def test_missing_server(self):
        with self.assertRaises(ValueError):
            MODULE.configure(SITE.replace('443 ssl', '8443 ssl'))

    def test_malformed_syntax(self):
        for suffix in ('}', 'server {', 'dangling', 'set $x "unterminated;', 'set $x trailing\\'):
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                MODULE.configure(SITE + suffix)

    def test_modified_markers(self):
        result = MODULE.configure(SITE)
        with self.assertRaises(ValueError):
            MODULE.configure(result.replace('return 308', 'return 301'))

    def test_wrong_managed_block_placement(self):
        with self.assertRaises(ValueError):
            MODULE.configure(SITE + MODULE.BLOCKS['https'])

    def test_unrelated_server_remains_untouched(self):
        unrelated = 'server { listen 80; server_name example.org; location /bridge_online {} }\n'
        result = MODULE.configure(SITE + unrelated)
        self.assertTrue(result.endswith(unrelated))


if __name__ == '__main__':
    unittest.main()
