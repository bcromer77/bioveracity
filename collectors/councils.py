"""Bounded HTML/PDF collection with durable frontier and auditable failures.
Run using a private persistent SQLite path. No background process is implied by this file.
"""
from __future__ import annotations
import argparse
import io
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from html.parser import HTMLParser
from pathlib import Path
from collectors.honeycomb import Store, utcnow

MAX_BYTES = 12 * 1024 * 1024
USER_AGENT = 'BioVeracityResearch/0.1'


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.links = [], []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'noscript'}:
            self.hidden += 1
        if tag == 'a':
            href = dict(attrs).get('href')
            if href:
                self.links.append(href)
        if tag in {'p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'tr'}:
            self.parts.append('\n')
    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'noscript'}:
            self.hidden = max(0, self.hidden - 1)
    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def allowed(url, source):
    p = urllib.parse.urlsplit(url)
    return p.scheme == 'https' and p.hostname in source['allowed_hosts'] and not p.username and not p.password and p.port in {None, 443}


def discovered(base, links, source):
    result = set()
    for href in links:
        url = urllib.parse.urldefrag(urllib.parse.urljoin(base, href))[0]
        if allowed(url, source) and any(re.search(pattern, url, re.I) for pattern in source['follow_patterns']):
            result.add(url)
    return sorted(result)


class RestrictedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, source):
        self.source = source
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed(newurl, self.source):
            raise ValueError('Redirect outside reviewed source hosts')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Fetcher:
    def __init__(self):
        self.robots = {}
        self.last_request = 0.0
    def fetch(self, url, source, check_robots=True):
        if not allowed(url, source):
            raise ValueError('URL outside reviewed source hosts')
        origin = 'https://' + urllib.parse.urlsplit(url).netloc
        if check_robots:
            if origin not in self.robots:
                rp = urllib.robotparser.RobotFileParser()
                try:
                    raw, _, _ = self.fetch(origin + '/robots.txt', source, False)
                    rp.parse(raw.decode('utf-8', errors='replace').splitlines())
                except urllib.error.HTTPError as exc:
                    if exc.code != 404:
                        raise
                    rp.parse([])
                self.robots[origin] = rp
            if not self.robots[origin].can_fetch(USER_AGENT, url):
                raise ValueError('Disallowed by source robots policy')
        delay = max(1, (self.robots.get(origin).crawl_delay(USER_AGENT) or 1) if origin in self.robots else 1)
        if delay > 30:
            raise ValueError('Source requires a slower dedicated schedule')
        time.sleep(max(0, delay - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        opener = urllib.request.build_opener(RestrictedRedirect(source))
        with opener.open(urllib.request.Request(url, headers={'User-Agent': USER_AGENT}), timeout=25) as response:
            raw = response.read(MAX_BYTES+1)
            if len(raw) > MAX_BYTES:
                raise ValueError('Document exceeds bounded collection size')
            return raw, response.headers.get_content_type(), response.geturl()


def extract(raw, content_type):
    if raw.startswith(b'%PDF') or content_type == 'application/pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        sections = [{'locator': 'PDF page ' + str(i+1), 'text': page.extract_text() or ''} for i, page in enumerate(reader.pages)]
        sections = [s for s in sections if s['text'].strip()]
        if not sections:
            raise ValueError('No extractable PDF text; OCR review needed')
        return sections, []
    if content_type not in {'text/html', 'application/xhtml+xml'}:
        raise ValueError('Unsupported content type')
    page = Page(); page.feed(raw.decode('utf-8', errors='replace'))
    text = '\n'.join(line.strip() for line in ''.join(page.parts).splitlines() if line.strip())
    if not text:
        raise ValueError('Empty HTML text')
    return [{'locator': 'HTML text extraction v1 (includes navigation; review required)', 'text': text}], page.links


def collect(store, config, *, mode='incremental', max_documents=25, fetcher=None):
    fetcher = fetcher or Fetcher()
    store.db.execute('''CREATE TABLE IF NOT EXISTS frontier(source_id TEXT NOT NULL, url TEXT NOT NULL,
      last_attempt TEXT, status TEXT NOT NULL DEFAULT 'pending', PRIMARY KEY(source_id,url))''')
    store.db.execute('CREATE TABLE IF NOT EXISTS raw_documents(sha256 TEXT PRIMARY KEY, content_type TEXT NOT NULL, body BLOB NOT NULL)')
    sources = {s['id']: s for s in config['sources'] if s.get('enabled')}
    for source in sources.values():
        for url in source['seed_urls']:
            with store.db:
                store.db.execute('INSERT OR IGNORE INTO frontier(source_id,url) VALUES (?,?)', (source['id'], url))
                # Revisit archive indices to discover fresh links on every run.
                store.db.execute("UPDATE frontier SET last_attempt=NULL,status='pending' WHERE source_id=? AND url=?", (source['id'], url))
    processed, failed = 0, 0
    attempted = set()
    while processed < max_documents:
        rows = store.db.execute('SELECT * FROM frontier ORDER BY last_attempt IS NOT NULL, last_attempt, source_id, url').fetchall()
        row = next((r for r in rows if r['source_id'] in sources and (r['source_id'], r['url']) not in attempted
            and (not r['last_attempt'] or (mode == 'incremental' and r['last_attempt'][:10] < utcnow()[:10]))), None)
        if row is None:
            break
        source = sources[row['source_id']]; url = row['url']
        attempted.add((row['source_id'], url)); processed += 1
        status = 'collected'
        try:
            raw, content_type, final_url = fetcher.fetch(url, source)
            if not allowed(final_url, source):
                raise ValueError('Final URL outside reviewed source hosts')
            sections, links = extract(raw, content_type)
            import hashlib
            record = {'url': url, 'resolved_url': final_url, 'title': url.rsplit('/', 1)[-1] or url,
                'publisher': source['publisher'], 'authority_id': source['authority_id'],
                'jurisdiction': source['jurisdiction'], 'retrieved_at': utcnow(),
                'publication_date': None, 'event_date': None, 'event_date_precision': 'unknown',
                'access_label': 'internal', 'content_kind': 'source_text', 'review_status': 'unreviewed',
                'source_family': source['id'], 'raw_sha256': hashlib.sha256(raw).hexdigest(),
                'sections': sections}
            with store.db:
                store.db.execute('INSERT OR IGNORE INTO raw_documents VALUES (?,?,?)', (record['raw_sha256'], content_type, raw))
            store.ingest(record)
            with store.db:
                for link in discovered(final_url, links, source):
                    store.db.execute('INSERT OR IGNORE INTO frontier(source_id,url) VALUES (?,?)', (source['id'], link))
        except Exception as exc:
            status = 'failed'; failed += 1
            # Do not print response bodies, credentials or exception strings.
            detail = 'HTTP ' + str(exc.code) if isinstance(exc, urllib.error.HTTPError) else type(exc).__name__
            store.failure(url, status, detail)
        with store.db:
            store.db.execute('UPDATE frontier SET last_attempt=?,status=? WHERE source_id=? AND url=?', (utcnow(), status, source['id'], url))
    return {'attempted': processed, 'failed': failed, 'mode': mode,
            'pending': store.db.execute("SELECT COUNT(*) FROM frontier WHERE status='pending'").fetchone()[0],
            'enabled_sources': len(sources), 'coverage': 'bounded configured sources only'}


if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('--store', required=True); p.add_argument('--config', required=True)
    p.add_argument('--mode', choices=['backfill', 'incremental'], default='incremental')
    p.add_argument('--max-documents', type=int, default=25)
    args = p.parse_args()
    if not 1 <= args.max_documents <= 100:
        p.error('max-documents must be 1..100')
    result = collect(Store(args.store), json.loads(Path(args.config).read_text()), mode=args.mode, max_documents=args.max_documents)
    print(json.dumps(result))
    if result['failed']:
        raise SystemExit(2)
