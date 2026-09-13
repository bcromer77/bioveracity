#!/usr/bin/env python3
"""Bounded schema-2.1 delivery. Receipts acknowledge intake, never verification."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_BYTES = 2 * 1024 * 1024


class ConfigurationError(ValueError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the ingest credential to a redirect target.


def configuration(env):
    missing = [name for name in ('BIOVERACITY_INGEST_URL', 'BIOVERACITY_INGEST_KEY')
               if not env.get(name, '').strip()]
    if missing:
        raise ConfigurationError('Missing Scout configuration: ' + ', '.join(missing))
    url = env['BIOVERACITY_INGEST_URL'].strip()
    key = env['BIOVERACITY_INGEST_KEY'].strip()
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise ConfigurationError('Invalid ingest URL') from None
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment
            or parsed.path != '/api/ingest/grok' or port not in (None, 443)):
        raise ConfigurationError('Use the confirmed HTTPS /api/ingest/grok URL without credentials or query parameters')
    if any(ord(c) < 33 or ord(c) > 126 for c in key):
        raise ConfigurationError('Ingest key must contain printable ASCII without whitespace')
    return url, key


def load_payload(path):
    with path.open('rb') as source:
        data = source.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('Payload exceeds 2 MiB')
    def invalid_constant(value):
        raise ValueError('Non-finite JSON number')
    payload = json.loads(data, parse_constant=invalid_constant)
    if not isinstance(payload, dict):
        raise ValueError('Expected one schema-2.1 object per file')
    for section in ('ingestion_metadata', 'raw_source', 'analysis', 'commercial', 'entity_resolution_proposals'):
        if section in payload and not isinstance(payload[section], dict):
            raise ValueError('Invalid object section')
    metadata = payload.get('ingestion_metadata', {})
    version = metadata.get('schema_version', metadata.get('schemaVersion', metadata.get('version')))
    if str(version) != '2.1':
        raise ValueError('Explicit schema version 2.1 required')
    observations = payload.get('observations')
    if not isinstance(observations, list) or not observations or not all(isinstance(o, dict) and o for o in observations):
        raise ValueError('Expected non-empty observation objects')
    # Hash exact transmitted bytes. Retries do not rewrite timestamps or payloads.
    return data, hashlib.sha256(data).hexdigest()


def open_ledger(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=30)
    os.chmod(path, 0o600)
    db.execute('''CREATE TABLE IF NOT EXISTS receipts (
        endpoint TEXT NOT NULL, digest TEXT NOT NULL, outcome TEXT NOT NULL,
        http_status INTEGER, raw_id TEXT, attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (endpoint, digest))''')
    db.commit()
    return db


def send(url, key, data, opener):
    request = Request(url, data=data, method='POST', headers={
        'Content-Type': 'application/json', 'x-bioveracity-ingest-key': key})
    try:
        with opener.open(request, timeout=30) as response:
            code = response.status
            raw = response.read(65537)
    except HTTPError as error:
        code = error.code
        raw = error.read(65537)
        error.close()
    except (URLError, TimeoutError, OSError):
        return 'retry_pending', None, None
    try:
        body = json.loads(raw) if len(raw) <= 65536 else None
    except (ValueError, UnicodeError):
        body = None
    body = body if isinstance(body, dict) else {}
    raw_id = body.get('rawIngestId')
    raw_id = raw_id if isinstance(raw_id, str) and 0 < len(raw_id) <= 200 else None
    # The legacy API can retain FAILED raw rows and acknowledge their retry as
    # duplicate. Hold these for operator repair instead of hiding that failure.
    if body.get('status') == 'FAILED' or (code >= 400 and raw_id):
        return 'stored_needs_attention', code, raw_id
    if 200 <= code < 300 and body.get('success') is True and raw_id:
        return 'intake_acknowledged', code, raw_id
    if code in (401, 403):
        return 'auth_blocked', code, None
    if code == 429 or code >= 500:
        return 'retry_pending', code, None
    return 'response_needs_attention', code, raw_id


def run(paths, ledger, env, limit=100, dry_run=False, opener=None):
    # Fail before opening a ledger or making any request when secrets are absent.
    url, key = configuration(env)
    counts = {'selected': 0, 'intake_acknowledged': 0, 'already_acknowledged': 0,
              'stored_needs_attention': 0, 'response_needs_attention': 0,
              'retry_pending': 0, 'auth_blocked': 0, 'invalid_payload': 0, 'validated_only': 0}
    opener = opener or build_opener(NoRedirect())
    db = None if dry_run else open_ledger(ledger)
    attempted = 0
    try:
        for path in paths:
            if attempted >= limit:
                break
            counts['selected'] += 1
            try:
                data, digest = load_payload(path)
            except (OSError, ValueError, RecursionError):
                counts['invalid_payload'] += 1
                attempted += 1
                continue
            if dry_run:
                counts['validated_only'] += 1
                attempted += 1
                continue
            # Serialize sends using this ledger. A crash after POST is replayed;
            # the server's payload fingerprint supplies duplicate protection.
            db.execute('BEGIN IMMEDIATE')
            previous = db.execute('SELECT outcome FROM receipts WHERE endpoint=? AND digest=?', (url, digest)).fetchone()
            if previous and previous[0] in ('intake_acknowledged', 'stored_needs_attention'):
                counts['already_acknowledged' if previous[0] == 'intake_acknowledged' else previous[0]] += 1
                db.commit()
                continue
            outcome, code, raw_id = send(url, key, data, opener)
            attempted += 1
            db.execute('''INSERT INTO receipts(endpoint,digest,outcome,http_status,raw_id,attempts)
                VALUES(?,?,?,?,?,1) ON CONFLICT(endpoint,digest) DO UPDATE SET
                outcome=excluded.outcome, http_status=excluded.http_status, raw_id=excluded.raw_id,
                attempts=receipts.attempts+1, updated_at=CURRENT_TIMESTAMP''',
                (url, digest, outcome, code, raw_id))
            db.commit()
            counts[outcome] += 1
            if outcome in ('auth_blocked', 'retry_pending'):
                break  # Stop on auth failure, rate limiting or outage; retry next run.
    finally:
        if db is not None:
            db.close()
    counts['remaining_unattempted'] = len(paths) - counts['selected']
    blocked = any(counts[k] for k in ('stored_needs_attention', 'response_needs_attention',
                                    'retry_pending', 'auth_blocked', 'invalid_payload'))
    return counts, 1 if blocked or counts['remaining_unattempted'] else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--payload-dir', type=Path, action='append', required=True,
                        help='Repeat for each staged payload directory; only direct *.json files are read')
    parser.add_argument('--ledger', type=Path, required=True, help='Persistent private SQLite receipt file outside Git')
    parser.add_argument('--limit', type=int, default=100)
    parser.add_argument('--dry-run', action='store_true', help='Check configuration and files; no POST or receipt writes')
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error('--limit must be between 1 and 1000')
    if any(not directory.is_dir() for directory in args.payload_dir):
        parser.error('Each payload directory must exist')
    paths = sorted(set(path for directory in args.payload_dir for path in directory.glob('*.json') if path.is_file()))
    if not paths:
        parser.error('No staged JSON payloads found')
    try:
        counts, code = run(paths, args.ledger, os.environ, args.limit, args.dry_run)
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        return 2
    except (OSError, sqlite3.Error):
        print('Delivery stopped: local storage or transport failure; inspect runtime securely', file=sys.stderr)
        return 1
    print(json.dumps(counts, sort_keys=True))
    return code


if __name__ == '__main__':
    sys.exit(main())
