import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from collectors.ni_nightly import run
CONFIG = json.loads(Path('collectors/ni-sources.json').read_text())
class FakeFetcher:
    def fetch(self, url, source):
        if source['id'] == 'and':
            raise TimeoutError('synthetic source unavailable')
        return b'<p>Synthetic flood consultation</p>', 'text/html', url
class NightlyTests(unittest.TestCase):
    def test_all_councils_and_repeat_import(self):
        with tempfile.TemporaryDirectory() as d:
            one = run(CONFIG, d, d, FakeFetcher())
            two = run(CONFIG, d, d, FakeFetcher())
            self.assertEqual(len(one['councils']), 11)
            self.assertEqual(sum(r['failed'] for r in one['councils']), 1)
            self.assertEqual(sum(r['new_versions'] for r in two['councils']), 0)
            db = sqlite3.connect(str(Path(d)/'councils.sqlite'))
            self.assertEqual(db.execute('SELECT COUNT(*) FROM embeddings').fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM ni_fts WHERE ni_fts MATCH 'flood'").fetchone()[0], 10)
            db.close()
    def test_rejects_incomplete_scope(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                run({'sources': CONFIG['sources'][:10]}, d, d, FakeFetcher())
    def test_homepages_allowlisted(self):
        from collectors.councils import allowed
        for s in CONFIG['sources']:
            self.assertTrue(allowed(s['seed_urls'][0], s))
            self.assertFalse(allowed('https://example.com/', s))
