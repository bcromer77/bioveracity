import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

from scout_delivery import ConfigurationError, NoRedirect, configuration, run


class Response:
    def __init__(self, status=200, body=None):
        self.status = status
        self.body = json.dumps(body if body is not None else {'success': True, 'rawIngestId': 'raw-1', 'status': 'VERIFICATION_PENDING'}).encode()

    def read(self, size):
        return self.body[:size]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.ledger = self.root / 'receipts.sqlite'
        self.payload = self.root / 'payload.json'
        self.payload.write_text(json.dumps({'ingestion_metadata': {'schema_version': '2.1'},
                                           'observations': [{'claim': 'Synthetic test only'}]}))
        self.env = {'BIOVERACITY_INGEST_URL': 'https://example.test/api/ingest/grok',
                    'BIOVERACITY_INGEST_KEY': 'synthetic-test-key'}
        self.opener = Mock()
        self.opener.open.return_value = Response()

    def deliver(self, **kwargs):
        return run(kwargs.pop('paths', [self.payload]), self.ledger, self.env, opener=self.opener, **kwargs)

    def test_missing_configuration_fails_without_network_or_ledger(self):
        for key in self.env:
            env = dict(self.env)
            del env[key]
            with self.assertRaisesRegex(ConfigurationError, key):
                run([self.payload], self.ledger, env, opener=self.opener)
        self.opener.open.assert_not_called()
        self.assertFalse(self.ledger.exists())

    def test_unsafe_or_wrong_endpoint_rejected(self):
        for url in ('http://example.test/api/ingest/grok', 'https://example.test/api/ingest/evidence',
                    'https://user:secret@example.test/api/ingest/grok',
                    'https://example.test/api/ingest/grok?key=secret',
                    'https://example.test:invalid/api/ingest/grok'):
            with self.subTest(url=url), self.assertRaises(ConfigurationError):
                configuration({**self.env, 'BIOVERACITY_INGEST_URL': url})

    def test_dry_run_does_not_send_or_write(self):
        counts, code = self.deliver(dry_run=True)
        self.assertEqual((counts['validated_only'], code), (1, 0))
        self.opener.open.assert_not_called()
        self.assertFalse(self.ledger.exists())

    def test_request_and_persistent_acknowledgement(self):
        counts, code = self.deliver()
        self.assertEqual((counts['intake_acknowledged'], code), (1, 0))
        request = self.opener.open.call_args.args[0]
        self.assertEqual(request.data, self.payload.read_bytes())
        self.assertEqual(request.get_header('X-bioveracity-ingest-key'), self.env['BIOVERACITY_INGEST_KEY'])
        self.assertEqual(request.get_method(), 'POST')
        counts, code = self.deliver()
        self.assertEqual(counts['already_acknowledged'], 1)
        self.assertEqual(self.opener.open.call_count, 1)
        self.assertNotIn(self.env['BIOVERACITY_INGEST_KEY'].encode(), self.ledger.read_bytes())

    def test_receipts_are_scoped_to_endpoint(self):
        self.deliver()
        self.env['BIOVERACITY_INGEST_URL'] = 'https://other.test/api/ingest/grok'
        self.deliver()
        self.assertEqual(self.opener.open.call_count, 2)

    def test_limit_does_not_starve_new_payloads_after_acknowledged_files(self):
        self.deliver()
        another = self.root / 'another.json'
        another.write_bytes(self.payload.read_bytes().replace(b'Synthetic', b'Another'))
        counts, code = self.deliver(paths=[self.payload, another], limit=1)
        self.assertEqual((counts['already_acknowledged'], counts['intake_acknowledged'], code), (1, 1, 0))

    def test_transport_failure_retries_identical_bytes_on_next_run(self):
        self.opener.open.side_effect = [URLError('offline'), Response()]
        counts, code = self.deliver()
        self.assertEqual((counts['retry_pending'], code), (1, 1))
        self.assertEqual(self.deliver()[1], 0)
        calls = self.opener.open.call_args_list
        self.assertEqual(calls[0].args[0].data, calls[1].args[0].data)

    def test_2xx_without_explicit_success_and_id_is_not_delivery(self):
        for body in ({}, {'success': False}, {'success': True}, {'success': True, 'rawIngestId': 'x', 'status': 'FAILED'}):
            self.opener.open.return_value = Response(body=body)
            counts, code = self.deliver()
            self.assertEqual(counts['intake_acknowledged'], 0)
            self.assertEqual(code, 1)

    def test_failed_stored_payload_is_held_not_replayed_as_successful_duplicate(self):
        body = json.dumps({'success': False, 'rawIngestId': 'failed-row', 'status': 'FAILED'}).encode()
        self.opener.open.side_effect = HTTPError(self.env['BIOVERACITY_INGEST_URL'], 500, 'failure', {}, io.BytesIO(body))
        self.assertEqual(self.deliver()[0]['stored_needs_attention'], 1)
        self.assertEqual(self.deliver()[0]['stored_needs_attention'], 1)
        self.assertEqual(self.opener.open.call_count, 1)

    def test_auth_and_rate_limits_stop_batch(self):
        for status, outcome in ((401, 'auth_blocked'), (403, 'auth_blocked'), (429, 'retry_pending'), (503, 'retry_pending')):
            self.opener.open.side_effect = HTTPError(self.env['BIOVERACITY_INGEST_URL'], status, 'error', {}, io.BytesIO(b'{}'))
            counts, code = self.deliver(paths=[self.payload, self.payload])
            self.assertEqual((counts[outcome], counts['remaining_unattempted'], code), (1, 1, 1))

    def test_malformed_or_empty_payload_is_not_posted(self):
        for data in ('not json', '{}', '[]', '{"ingestion_metadata":{"schema_version":"2.1"},"observations":[]}'):
            self.payload.write_text(data)
            self.assertEqual(self.deliver()[0]['invalid_payload'], 1)
        self.opener.open.assert_not_called()

    def test_redirect_handler_does_not_forward_credentials(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test'))


if __name__ == '__main__':
    unittest.main()
