"""Build a deterministic, offline council identity register; never writes a database."""
import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'councils'
SNAPSHOT = '2026-09-08'
PRINCIPAL_TYPES = {'NMD', 'UA', 'MD', 'SCO', 'LBO', 'WPA', 'CTY', 'NID', 'CC'}


def build():
    with (DATA / 'sources/uk-local-authorities.csv').open(encoding='utf-8', newline='') as f:
        upstream = list(csv.DictReader(f))
    ie = json.loads((DATA / 'sources/ireland-local-authorities.json').read_text())
    principal, strategic = [], []
    for row in upstream:
        # Preserve upstream lifecycle history in the input; do not silently revive abolished councils.
        if row['current-authority'] != 'True':
            continue
        record = {
            'id': 'uk:mysociety:' + row['local-authority-code'],
            'name': row['official-name'], 'jurisdiction': row['nation'], 'country': 'UK',
            'authority_type': row['local-authority-type-name'],
            'gss_area_code': row['gss-code'] or None,
            'source_start_date': row['start-date'] or None,
            'source_end_date': row['end-date'] or None,
            'overlapping_county_id': ('uk:mysociety:' + row['county-la']) if row['county-la'] else None,
            'identity_source': 'sources/uk-local-authorities.csv',
            'identity_locator': 'local-authority-code=' + row['local-authority-code'],
            'identity_status': 'listed_in_source', 'monitoring_status': 'not_started',
            'website_url': None, 'asset_links': [],
        }
        if row['local-authority-type'] in PRINCIPAL_TYPES:
            principal.append(record)
        elif row['local-authority-type'] in {'COMB', 'SRA'}:
            strategic.append(record)
        else:
            raise ValueError('Unreviewed authority type: ' + row['local-authority-type'])
    for name in ie['names']:
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        principal.append({
            'id': 'ie:bioveracity:' + slug, 'name': name, 'jurisdiction': 'Republic of Ireland',
            'country': 'IE', 'authority_type': 'City and county council' if ('&' in name or 'and County' in name)
                else ('City council' if 'City Council' in name else 'County council'),
            'gss_area_code': None, 'source_start_date': None, 'source_end_date': None,
            'overlapping_county_id': None, 'identity_source': ie['source_url'],
            'identity_locator': 'Table 4.1: ' + name,
            'identity_status': 'listed_in_source', 'monitoring_status': 'not_started',
            'website_url': None, 'asset_links': [],
        })
    principal.sort(key=lambda r: (r['jurisdiction'], r['name']))
    strategic.sort(key=lambda r: r['id'])
    records = principal + strategic
    ids = {r['id'] for r in records}
    assert len(ids) == len(records), 'Duplicate entity IDs'
    counts = dict(sorted(Counter(r['jurisdiction'] for r in principal).items()))
    # Snapshot acceptance baseline: changes require review, not automatic acceptance.
    assert counts == {'England': 317, 'Northern Ireland': 11, 'Republic of Ireland': 31, 'Scotland': 32, 'Wales': 22}, counts
    for row in records:
        assert row['overlapping_county_id'] is None or row['overlapping_county_id'] in ids
    endpoints = json.loads((DATA / 'source-endpoints.json').read_text())
    for endpoint in endpoints:
        assert endpoint['council_id'] in ids, endpoint
        assert endpoint['url'].startswith('https://')
        assert endpoint['last_successful_ingestion'] is None
    return {'schema_version': 1, 'snapshot_date': SNAPSHOT, 'coverage': 'identity_directory_only',
            'counts': counts, 'principal_councils': principal, 'strategic_authorities': strategic}


if __name__ == '__main__':
    result = build()
    (DATA / 'register.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'principal': len(result['principal_councils']), 'strategic': len(result['strategic_authorities']),
                      'counts': result['counts'], 'live_collectors': 0}))
