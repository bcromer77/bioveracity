"""Deliver collected source versions to BioVeracity's authenticated review queue.

Reads the existing collector SQLite store or the research JSON archive. Does not
mark anything verified. Keep receipt storage on persistent private disk.
"""
import argparse
import hashlib
import json
import os
import sqlite3
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect refused; configure the canonical evidence endpoint')


def send(endpoint, key, record):
    parsed = urlsplit(endpoint)
    if parsed.scheme != 'https' or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('A canonical HTTPS intake endpoint is required')
    if parsed.path != '/api/ingest/evidence' or len(key) < 32:
        raise ValueError('Invalid intake configuration')
    body = json.dumps(record, ensure_ascii=False).encode()
    if len(body) > 1000000:
        raise ValueError('Record exceeds intake size limit')
    request = urllib.request.Request(endpoint, data=body, headers={
        'Content-Type': 'application/json', 'x-bioveracity-evidence-key': key,
    }, method='POST')
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=45) as response:
        if response.status not in (200, 201):
            raise ValueError('Intake did not acknowledge record')
        ack = json.loads(response.read(10000))
    if not isinstance(ack.get('id'), str) or ack.get('status') not in {'PENDING_REVIEW', 'VERIFIED', 'REVOKED'}:
        raise ValueError('Invalid acknowledgement')
    return ack


def deliver(records, receipts, endpoint, key, limit=25, sender=send):
    if not 1 <= limit <= 100:
        raise ValueError('limit must be 1..100')
    db = sqlite3.connect(receipts)
    db.execute('CREATE TABLE IF NOT EXISTS deliveries (fingerprint TEXT PRIMARY KEY, remote_id TEXT NOT NULL, acknowledged_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    db.execute('CREATE TABLE IF NOT EXISTS delivery_failures (fingerprint TEXT, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, error_type TEXT NOT NULL)')
    sent = failed = attempted = 0
    try:
        for record in records:
            if attempted >= limit:
                break
            # Include the retrieval time so fresh observations reach the current-version selector.
            fingerprint = hashlib.sha256(json.dumps([endpoint, record], sort_keys=True).encode()).hexdigest()
            if db.execute('SELECT 1 FROM deliveries WHERE fingerprint=?', (fingerprint,)).fetchone():
                continue
            attempted += 1
            try:
                ack = sender(endpoint, key, record)
                with db:
                    db.execute('INSERT OR IGNORE INTO deliveries(fingerprint,remote_id) VALUES (?,?)', (fingerprint, ack['id']))
                sent += 1
            except Exception as exc:
                failed += 1
                with db:
                    db.execute('INSERT INTO delivery_failures(fingerprint,error_type) VALUES (?,?)', (fingerprint, type(exc).__name__))
                # Failed records remain eligible on the next run. Never log keys or response bodies.
        return {'attempted': attempted, 'acknowledged': sent, 'failed': failed,
                'meaning': 'Acknowledged intake is private review-queue storage, not verification.'}
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--records', help='Research archive JSON with records array')
    source.add_argument('--store', help='Existing collector SQLite store')
    parser.add_argument('--receipts', required=True)
    parser.add_argument('--limit', type=int, default=25)
    args = parser.parse_args()
    if args.records:
        records = json.loads(Path(args.records).read_text())['records']
    else:
        db = sqlite3.connect(Path(args.store).resolve().as_uri() + '?mode=ro', uri=True)
        rows = db.execute('SELECT v.metadata, d.current_observed_at FROM versions v JOIN documents d ON d.current_version=v.id').fetchall()
        records = [dict(json.loads(row[0]), retrieved_at=row[1]) for row in rows]
        db.close()
    result = deliver(records, args.receipts, os.environ['BIOVERACITY_EVIDENCE_ENDPOINT'], os.environ['BIOVERACITY_EVIDENCE_INGEST_KEY'], args.limit)
    print(json.dumps(result))
    if result['failed']:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
