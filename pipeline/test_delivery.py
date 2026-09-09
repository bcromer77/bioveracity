import sqlite3
import tempfile
import unittest
from pathlib import Path
from pipeline.deliver_evidence import deliver, send


class DeliveryTests(unittest.TestCase):
    def test_acknowledged_retry_is_not_resent(self):
        with tempfile.TemporaryDirectory() as directory:
            receipts = str(Path(directory) / 'receipts.sqlite')
            calls = []
            def sender(*args):
                calls.append(args)
                return {'id': 'document-1', 'status': 'PENDING_REVIEW'}
            self.assertEqual(deliver([{'title': 'Fixture'}], receipts, 'https://fixture.test/api/ingest/evidence', 'x'*32, sender=sender)['acknowledged'], 1)
            self.assertEqual(deliver([{'title': 'Fixture'}], receipts, 'https://fixture.test/api/ingest/evidence', 'x'*32, sender=sender)['attempted'], 0)
            self.assertEqual(len(calls), 1)

    def test_failure_is_retried_and_not_receipted(self):
        with tempfile.TemporaryDirectory() as directory:
            receipts = str(Path(directory) / 'receipts.sqlite')
            def failing(*args):
                raise TimeoutError('secret content must not be logged')
            self.assertEqual(deliver([{'title': 'Fixture'}], receipts, 'https://fixture.test/api/ingest/evidence', 'x'*32, sender=failing)['failed'], 1)
            db = sqlite3.connect(receipts)
            self.assertEqual(db.execute('SELECT error_type FROM delivery_failures').fetchone()[0], 'TimeoutError')
            db.close()
            result = deliver([{'title': 'Fixture'}], receipts, 'https://fixture.test/api/ingest/evidence', 'x'*32, sender=lambda *args: {'id': 'document-1'})
            self.assertEqual(result['acknowledged'], 1)

    def test_changed_content_is_delivered(self):
        with tempfile.TemporaryDirectory() as directory:
            receipts = str(Path(directory) / 'receipts.sqlite')
            result = deliver([{'title': 'Old'}, {'title': 'Corrected'}], receipts, 'https://fixture.test/api/ingest/evidence', 'x'*32, sender=lambda *args: {'id': 'document'})
            self.assertEqual(result['acknowledged'], 2)

    def test_insecure_endpoint_rejected_before_network(self):
        with self.assertRaises(ValueError):
            send('http://fixture.test/api/ingest/evidence', 'x'*32, {})


if __name__ == '__main__':
    unittest.main()
