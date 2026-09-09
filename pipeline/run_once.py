"""One bounded collection-and-delivery run; schedule in a persistent runtime.

Requires the reviewed collector from PR #2. Does not deploy or approve claims.
"""
import fcntl
import json
import os
from pathlib import Path
from pipeline.deliver_evidence import deliver


def main():
    from collectors.councils import collect
    from collectors.honeycomb import Store
    root = Path(os.environ['BIOVERACITY_STATE_DIR'])
    if not root.is_absolute():
        raise ValueError('An absolute persistent state directory is required')
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.umask(0o077)
    with (root / 'pipeline.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        store = Store(str(root / 'councils.sqlite'))
        config = json.loads(Path(os.environ['BIOVERACITY_SOURCE_CONFIG']).read_text())
        result = collect(store, config, mode='incremental', max_documents=25)
        rows = store.db.execute('SELECT v.metadata, d.current_observed_at FROM versions v JOIN documents d ON d.current_version=v.id').fetchall()
        records = [dict(json.loads(row[0]), retrieved_at=row[1]) for row in rows]
        try:
            output = deliver(records, str(root / 'delivery-receipts.sqlite'), os.environ['BIOVERACITY_EVIDENCE_ENDPOINT'], os.environ['BIOVERACITY_EVIDENCE_INGEST_KEY'])
        finally:
            store.db.close()
        print(json.dumps({'collection': result, 'delivery': output}))
        if result['failed'] or output['failed']:
            raise SystemExit(2)


if __name__ == '__main__':
    main()
