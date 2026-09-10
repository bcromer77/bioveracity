"""Bounded NI staging refresh. No AI, production delivery or automatic verification."""
import argparse
import json
import os
from pathlib import Path
from collectors import councils
from collectors.honeycomb import Store, utcnow

class HTMLOnlyFetcher(councils.Fetcher):
    def fetch(self, url, source, check_robots=True):
        raw, kind, final = super().fetch(url, source, check_robots)
        if check_robots and kind not in {'text/html', 'application/xhtml+xml'}:
            raise ValueError('HTML discovery only; document adapter requires review')
        return raw, kind, final

def run(config, state, output, fetcher=None):
    sources = config['sources']
    if len(sources) != 11 or len({s['authority_id'] for s in sources}) != 11:
        raise ValueError('Exactly 11 unique councils required')
    if any(s['jurisdiction'] != 'Northern Ireland' or not s.get('enabled') for s in sources):
        raise ValueError('NI-only scope required')
    state, output = Path(state), Path(output)
    state.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    councils.MAX_BYTES = 1024 * 1024
    store = Store(str(state / 'councils.sqlite'))
    results = []
    try:
        for s in sources:
            if (state / 'councils.sqlite').stat().st_size >= 32 * 1024 * 1024:
                results.append({'council': s['publisher'], 'status': 'storage_limit', 'failed': 1})
                continue
            before = store.db.execute('SELECT COUNT(*) FROM versions').fetchone()[0]
            result = councils.collect(store, {'sources': [s]}, max_documents=2,
                                      fetcher=fetcher or HTMLOnlyFetcher())
            added = store.db.execute('SELECT COUNT(*) FROM versions').fetchone()[0] - before
            results.append(dict(result, council=s['publisher'], authority_id=s['authority_id'],
                                new_versions=added, status='partial_failure' if result['failed'] else 'checked'))
        # Incremental FTS index of current passages only. No embeddings or external calls.
        with store.db:
            store.db.execute('CREATE VIRTUAL TABLE IF NOT EXISTS ni_fts USING fts5(chunk_id UNINDEXED, text)')
            store.db.execute('CREATE TEMP VIEW current_chunks AS SELECT c.id,c.text FROM chunks c JOIN documents d ON d.current_version=c.version_id')
            store.db.execute('DELETE FROM ni_fts WHERE chunk_id NOT IN (SELECT id FROM current_chunks)')
            store.db.execute('INSERT INTO ni_fts SELECT id,text FROM current_chunks WHERE id NOT IN (SELECT chunk_id FROM ni_fts)')
        report = {'checked_at': utcnow(), 'search_mode': 'keyword_only', 'ai_calls': 0,
                  'production_writes': 0, 'coverage': 'bounded HTML discovery, not comprehensive monitoring',
                  'state': 'best-effort Actions cache; eviction restarts collection, not durable evidence storage',
                  'councils': results}
        (output / 'coverage.json').write_text(json.dumps(report, indent=2))
        lines = ['Northern Ireland nightly staging', '', 'Unreviewed HTML discovery; no production updates.', '']
        lines += [r['council'] + ': ' + r['status'] + '; new versions ' + str(r.get('new_versions', 0)) for r in results]
        summary = '\n'.join(lines) + '\n'
        (output / 'summary.txt').write_text(summary)
        if os.environ.get('GITHUB_STEP_SUMMARY'):
            with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
                f.write(summary)
        return report
    finally:
        store.db.close()

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--config', default='collectors/ni-sources.json')
    p.add_argument('--state', required=True)
    p.add_argument('--output', required=True)
    a = p.parse_args()
    report = run(json.loads(Path(a.config).read_text()), a.state, a.output)
    print(json.dumps({'councils': len(report['councils']), 'failed': sum(r['failed'] for r in report['councils'])}))
    raise SystemExit(2 if any(r['failed'] for r in report['councils']) else 0)
