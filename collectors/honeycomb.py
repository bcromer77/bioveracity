"""Private staging evidence store. No production DB or application dependencies.

Vector relevance is not verification. Embedding provider/model/dimension are explicit.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import os
import re
import sqlite3
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any


def stable_id(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def valid_vector(vector: Any, dimensions: int) -> list[float]:
    if not isinstance(vector, list) or len(vector) != dimensions:
        raise ValueError('Embedding dimension mismatch')
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in vector):
        raise ValueError('Embedding must contain finite numbers')
    length = math.sqrt(sum(x*x for x in vector))
    if not length:
        raise ValueError('Zero embedding')
    return [x / length for x in vector]


class OpenAIEmbedder:
    def __init__(self) -> None:
        self.model = os.environ['BIOVERACITY_EMBEDDING_MODEL']
        self.dimensions = int(os.environ['BIOVERACITY_EMBEDDING_DIMENSIONS'])
        self.key = os.environ['OPENAI_API_KEY']
        if not self.key or not self.model or self.dimensions < 1:
            raise ValueError('Embedding configuration incomplete')
        self.space = 'openai:' + self.model + ':' + str(self.dimensions)

    def embed(self, texts: list[str]) -> list[list[float]]:
        payload = {'model': self.model, 'input': texts, 'encoding_format': 'float', 'dimensions': self.dimensions}
        request = urllib.request.Request('https://api.openai.com/v1/embeddings',
            data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + self.key, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=45) as response:
            body = json.load(response)
        rows = sorted(body['data'], key=lambda x: x['index'])
        if [r['index'] for r in rows] != list(range(len(texts))):
            raise ValueError('Embedding response indices mismatch')
        return [valid_vector(r['embedding'], self.dimensions) for r in rows]


class Store:
    def __init__(self, path: str) -> None:
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, url TEXT NOT NULL, current_version TEXT, current_observed_at TEXT);
        CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
          metadata TEXT NOT NULL, collected_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES versions(id),
          locator TEXT NOT NULL, start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL, text TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS embeddings(chunk_id TEXT NOT NULL REFERENCES chunks(id), space TEXT NOT NULL,
          dimensions INTEGER NOT NULL, vector TEXT NOT NULL, PRIMARY KEY(chunk_id, space));
        CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS edges(id TEXT PRIMARY KEY, from_id TEXT NOT NULL REFERENCES nodes(id),
          relation TEXT NOT NULL, to_id TEXT NOT NULL REFERENCES nodes(id),
          evidence_chunk TEXT NOT NULL REFERENCES chunks(id), status TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY, url TEXT NOT NULL, checked_at TEXT NOT NULL,
          status TEXT NOT NULL, detail TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS chunks_version ON chunks(version_id);
        CREATE INDEX IF NOT EXISTS versions_document ON versions(document_id);
        CREATE INDEX IF NOT EXISTS edges_from ON edges(from_id);
        ''')

    def ingest(self, record: dict[str, Any]) -> str:
        for field in ('url', 'title', 'publisher', 'authority_id', 'jurisdiction', 'retrieved_at', 'sections', 'access_label', 'content_kind'):
            if not record.get(field):
                raise ValueError('Missing field: ' + field)
        if record['access_label'] not in {'internal', 'public'}:
            raise ValueError('Invalid access label')
        if record['content_kind'] not in {'source_text', 'source_excerpt', 'analyst_summary'}:
            raise ValueError('Invalid content kind')
        if not record['url'].startswith('https://'):
            raise ValueError('An HTTPS source URL is required')
        for section in record['sections']:
            if not isinstance(section.get('text'), str) or not section['text'].strip() or not section.get('locator'):
                raise ValueError('Source text and locator required')
        precision = record.get('event_date_precision', 'unknown')
        event_date = record.get('event_date')
        if precision not in {'unknown', 'day', 'month', 'year'}:
            raise ValueError('Unsupported event date precision')
        if precision == 'day':
            date.fromisoformat(event_date or '')
        if precision == 'unknown' and event_date is not None:
            raise ValueError('Unknown date precision must not have an event date')
        observed = datetime.fromisoformat(record['retrieved_at'])
        if observed.tzinfo is None:
            raise ValueError('retrieved_at requires timezone')
        record = dict(record, retrieved_at=observed.astimezone(timezone.utc).isoformat())
        # Excerpt and full-document records are separate representations; one cannot replace the other.
        document_id = stable_id([record['url'], record['content_kind'], record.get('representation_id', 'full')])
        content = {k: v for k, v in record.items() if k != 'retrieved_at'}
        version_id = stable_id(content)
        with self.db:
            self.db.execute('INSERT OR IGNORE INTO documents VALUES (?,?,NULL,NULL)', (document_id, record['url']))
            self.db.execute('INSERT OR IGNORE INTO versions VALUES (?,?,?,?)',
                (version_id, document_id, json.dumps(record, ensure_ascii=False), record['retrieved_at']))
            # Preserve every version; repeated retrieval of an older observation cannot move the current pointer backwards.
            old = self.db.execute('SELECT current_observed_at FROM documents WHERE id=?', (document_id,)).fetchone()
            if old is None or old['current_observed_at'] is None or record['retrieved_at'] >= old['current_observed_at']:
                self.db.execute('UPDATE documents SET current_version=?,current_observed_at=? WHERE id=?', (version_id, record['retrieved_at'], document_id))
            for section_index, section in enumerate(record['sections']):
                text = section['text']
                # Small character windows keep embedding input bounded; offsets address the retained section text.
                for start in range(0, len(text), 700):
                    end = min(start + 900, len(text))
                    if start >= end:
                        break
                    chunk_id = stable_id([version_id, section_index, start, end])
                    self.db.execute('INSERT OR IGNORE INTO chunks VALUES (?,?,?,?,?,?)',
                        (chunk_id, version_id, section['locator'], start, end, text[start:end]))
            self.db.execute('INSERT INTO attempts(url,checked_at,status,detail) VALUES (?,?,?,?)',
                (record['url'], record['retrieved_at'], 'collected', version_id))
        return version_id

    def failure(self, url: str, status: str, detail: str) -> None:
        with self.db:
            self.db.execute('INSERT INTO attempts(url,checked_at,status,detail) VALUES (?,?,?,?)', (url, utcnow(), status, detail))

    def link(self, source: dict[str, str], relation: str, target: dict[str, str], evidence_chunk: str, status: str = 'proposed') -> None:
        kinds = {'authority', 'place', 'asset', 'waterbody', 'operator', 'event', 'topic'}
        if source['kind'] not in kinds or target['kind'] not in kinds:
            raise ValueError('Unknown honeycomb node type')
        if relation not in {'located_in', 'discusses', 'operated_by', 'receives_discharge_from', 'upstream_of', 'responds_to', 'concerns'}:
            raise ValueError('Unknown relation')
        if status not in {'proposed', 'reviewed'}:
            raise ValueError('Unknown relationship status')
        with self.db:
            for node in (source, target):
                existing = self.db.execute('SELECT kind FROM nodes WHERE id=?', (node['id'],)).fetchone()
                if existing and existing['kind'] != node['kind']:
                    raise ValueError('Conflicting node identity')
                self.db.execute('INSERT OR IGNORE INTO nodes VALUES (?,?,?)', (node['id'], node['kind'], node['label']))
            self.db.execute('INSERT OR REPLACE INTO edges VALUES (?,?,?,?,?,?)',
                (stable_id([source['id'], relation, target['id'], evidence_chunk]), source['id'], relation, target['id'], evidence_chunk, status))

    def index(self, embedder: Any, limit: int = 100) -> int:
        rows = self.db.execute('''SELECT c.* FROM chunks c JOIN versions v ON c.version_id=v.id
          JOIN documents d ON d.current_version=v.id LEFT JOIN embeddings e ON e.chunk_id=c.id AND e.space=?
          WHERE e.chunk_id IS NULL LIMIT ?''', (embedder.space, limit)).fetchall()
        count = 0
        for offset in range(0, len(rows), 16):
            batch = rows[offset:offset+16]
            vectors = embedder.embed([r['text'] for r in batch])
            if len(vectors) != len(batch):
                raise ValueError('Embedding count mismatch')
            checked = [valid_vector(v, embedder.dimensions) for v in vectors]
            with self.db:
                for row, vector in zip(batch, checked):
                    self.db.execute('INSERT OR IGNORE INTO embeddings VALUES (?,?,?,?)',
                        (row['id'], embedder.space, embedder.dimensions, json.dumps(vector)))
            count += len(batch)
        return count

    def search(self, query: str, *, allowed_labels: set[str], embedder: Any = None,
               authority_id: str | None = None, node_id: str | None = None,
               date_from: str | None = None, date_to: str | None = None, limit: int = 10) -> dict[str, Any]:
        if not allowed_labels or not allowed_labels <= {'public', 'internal'}:
            raise ValueError('Explicit authorised access labels required')
        if date_from:
            date.fromisoformat(date_from)
        if date_to:
            date.fromisoformat(date_to)
        if date_from and date_to and date_from > date_to:
            raise ValueError('Date range reversed')
        if not query.strip():
            return {'mode': 'empty_query', 'results': []}
        rows = self.db.execute('''SELECT c.*, v.metadata FROM chunks c JOIN versions v ON c.version_id=v.id
          JOIN documents d ON d.current_version=v.id''').fetchall()
        eligible = []
        for row in rows:
            metadata = json.loads(row['metadata'])
            if metadata['access_label'] not in allowed_labels:
                continue
            if authority_id and metadata['authority_id'] != authority_id:
                continue
            event_date = metadata.get('event_date')
            # Unknown and coarse dates never masquerade as precise event-date matches.
            if date_from or date_to:
                if not event_date or metadata.get('event_date_precision') != 'day':
                    continue
                if date_from and event_date < date_from or date_to and event_date > date_to:
                    continue
            if node_id and not self.db.execute('SELECT 1 FROM edges WHERE evidence_chunk=? AND status=? AND (from_id=? OR to_id=?)',
                (row['id'], 'reviewed', node_id, node_id)).fetchone():
                continue
            eligible.append((row, metadata))
        terms = set(re.findall(r'\w+', query.lower()))
        lexical = sorted([(sum(row['text'].lower().count(t) for t in terms), row['id']) for row, _ in eligible], reverse=True)
        lexical = [item for item in lexical if item[0] > 0]
        vectors = []
        if embedder:
            q = valid_vector(embedder.embed([query])[0], embedder.dimensions)
            for row, _ in eligible:
                e = self.db.execute('SELECT * FROM embeddings WHERE chunk_id=? AND space=?', (row['id'], embedder.space)).fetchone()
                if e:
                    if e['dimensions'] != embedder.dimensions:
                        raise ValueError('Stored embedding dimension mismatch')
                    vector = valid_vector(json.loads(e['vector']), embedder.dimensions)
                    vectors.append((sum(a*b for a, b in zip(q, vector)), row['id']))
            vectors.sort(reverse=True)
        scores: dict[str, float] = {}
        # Reciprocal rank fusion ranks retrieval, never evidence reliability.
        for ranking in (lexical[:100], vectors[:100]):
            for rank, (_, chunk_id) in enumerate(ranking, 1):
                scores[chunk_id] = scores.get(chunk_id, 0) + 1/(60+rank)
        lookup = {r['id']: (r, m) for r, m in eligible}
        hits = []
        for chunk_id in sorted(scores, key=lambda k: (-scores[k], k))[:max(0, min(limit, 100))]:
            row, metadata = lookup[chunk_id]
            edges = [dict(e) for e in self.db.execute('SELECT * FROM edges WHERE evidence_chunk=?', (chunk_id,))]
            hits.append({'chunk_id': chunk_id, 'version_id': row['version_id'], 'text': row['text'],
                'locator': row['locator'], 'start_offset': row['start_offset'], 'end_offset': row['end_offset'],
                'source': metadata, 'relations': edges, 'retrieval_score': scores[chunk_id],
                'warning': 'Relevant passage, not a verified factual answer or causal finding.'})
        return {'mode': 'hybrid' if vectors else 'lexical_only', 'vector_candidates': len(vectors),
                'eligible_chunks': len(eligible), 'results': hits}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--store', required=True, help='Persistent private staging SQLite path, outside the code repository')
    sub = p.add_subparsers(dest='command', required=True)
    ingest = sub.add_parser('import'); ingest.add_argument('file')
    sub.add_parser('index')
    search = sub.add_parser('search'); search.add_argument('query'); search.add_argument('--vectors', action='store_true')
    search.add_argument('--authority'); search.add_argument('--node'); search.add_argument('--from-date'); search.add_argument('--to-date')
    args = p.parse_args()
    store = Store(args.store)
    if args.command == 'import':
        records = json.loads(Path(args.file).read_text())['records']
        print(json.dumps({'versions': [store.ingest(r) for r in records]}))
    elif args.command == 'index':
        print(json.dumps({'indexed': store.index(OpenAIEmbedder())}))
    else:
        print(json.dumps(store.search(args.query, allowed_labels={'internal', 'public'},
          embedder=OpenAIEmbedder() if args.vectors else None, authority_id=args.authority,
          node_id=args.node, date_from=args.from_date, date_to=args.to_date), ensure_ascii=False))


if __name__ == '__main__':
    main()
