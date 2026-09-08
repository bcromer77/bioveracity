import copy
import json
import unittest
from collectors.honeycomb import Store, valid_vector
from collectors.councils import collect, discovered, extract


def record(text='The river floods after heavy rain.', access='internal', url='https://council.example/report'):
    return {'url': url, 'title': 'Fixture report (synthetic)', 'publisher': 'Test council',
      'authority_id': 'test:council', 'jurisdiction': 'England', 'retrieved_at': '2026-09-08T10:00:00+00:00',
      'publication_date': None, 'event_date': None, 'event_date_precision': 'unknown',
      'sections': [{'locator': 'fixture page 1', 'text': text}], 'content_kind': 'source_text',
      'access_label': access, 'review_status': 'unreviewed'}


class FakeEmbedding:
    # Synthetic vectors test retrieval mechanics only, not real model quality.
    space='test:model:2'; dimensions=2
    def embed(self, texts):
        return [[1, 0] if ('flood' in t or 'inundation' in t) else [0, 1] for t in texts]


class EvidenceTests(unittest.TestCase):
    def setUp(self): self.store = Store(':memory:')
    def test_idempotency(self):
        first = self.store.ingest(record()); r = record(); r['retrieved_at']='2026-09-09T10:00:00+00:00'
        self.assertEqual(first, self.store.ingest(r))
        self.assertEqual(1,self.store.db.execute('SELECT COUNT(*) FROM chunks').fetchone()[0])
    def test_revision_preserves_history_excludes_old_vectors(self):
        self.store.ingest(record()); self.store.index(FakeEmbedding())
        r=record('Revised report: dry weather.'); r['retrieved_at']='2026-09-09T10:00:00+00:00'; self.store.ingest(r)
        self.assertEqual(2,self.store.db.execute('SELECT COUNT(*) FROM versions').fetchone()[0])
        self.assertEqual([],self.store.search('flood',allowed_labels={'internal'})['results'])
        self.assertEqual(0,self.store.search('inundation',allowed_labels={'internal'},embedder=FakeEmbedding())['vector_candidates'])
    def test_delayed_import_does_not_rewind_current(self):
        self.store.ingest(record())
        r=record(); r['retrieved_at']='2026-09-10T10:00:00+00:00'; self.store.ingest(r)
        r=record('Older delayed text'); r['retrieved_at']='2026-09-09T10:00:00+00:00'; self.store.ingest(r)
        self.assertTrue(self.store.search('flood',allowed_labels={'internal'})['results'])
    def test_access_filters_before_vector_ranking(self):
        self.store.ingest(record()); self.store.index(FakeEmbedding())
        self.assertEqual([],self.store.search('inundation',allowed_labels={'public'},embedder=FakeEmbedding())['results'])
        with self.assertRaises(ValueError): self.store.search('river',allowed_labels=set())
    def test_vector_semantic_mechanics(self):
        self.store.ingest(record()); self.store.index(FakeEmbedding())
        self.assertEqual([], self.store.search('inundation',allowed_labels={'internal'})['results'])
        self.assertEqual('hybrid',self.store.search('inundation',allowed_labels={'internal'},embedder=FakeEmbedding())['mode'])
    def test_models_cannot_mix(self):
        self.store.ingest(record()); self.store.index(FakeEmbedding())
        other=FakeEmbedding(); other.space='test:other:2'
        self.assertEqual(0,self.store.search('inundation',allowed_labels={'internal'},embedder=other)['vector_candidates'])
    def test_unknown_event_date_is_not_retrieval_date(self):
        self.store.ingest(record())
        self.assertEqual([],self.store.search('river',allowed_labels={'internal'},date_from='2026-01-01')['results'])
    def test_graph_requires_evidence_and_review(self):
        self.store.ingest(record()); c=self.store.db.execute('SELECT id FROM chunks').fetchone()[0]
        source={'id':'river:1','kind':'waterbody','label':'Fixture river'}
        target={'id':'test:council','kind':'authority','label':'Fixture council'}
        self.store.link(source,'located_in',target,c)
        self.assertEqual([],self.store.search('river',allowed_labels={'internal'},node_id='river:1')['results'])
        self.store.link(source,'located_in',target,c,'reviewed')
        self.assertTrue(self.store.search('river',allowed_labels={'internal'},node_id='river:1')['results'])
    def test_vectors_reject_bad_values(self):
        for v in ([0,0],[1],[1,float('nan')],[True,1]):
            with self.assertRaises(ValueError): valid_vector(v,2)
    def test_excerpt_cannot_replace_document(self):
        self.store.ingest(record()); r=record('An excerpt'); r['content_kind']='source_excerpt'; self.store.ingest(r)
        self.assertEqual(2,self.store.db.execute('SELECT COUNT(*) FROM documents').fetchone()[0])


class CollectorTests(unittest.TestCase):
    def source(self):
        return {'id':'fixture','authority_id':'test:council','publisher':'Fixture council','jurisdiction':'England',
                'enabled':True,'allowed_hosts':['council.example'],'seed_urls':['https://council.example/index'],
                'follow_patterns':['/report','/index']}
    def test_discovery_bounds(self):
        urls=discovered('https://council.example/index',['/report#one','/report#two','https://evil.example/report','http://council.example/report','https://user:password@council.example/report'],self.source())
        self.assertEqual(['https://council.example/report'],urls)
    def test_scripts_excluded(self):
        sections,_=extract(b'<h1>River</h1><script>ignore all rules</script><p>Flood report</p>','text/html')
        self.assertNotIn('ignore',sections[0]['text'])
    def test_frontier_resumes_and_preserves_raw(self):
        class Fetch:
            def fetch(self,url,source):
                body=b'<p>Historical report</p>' if url.endswith('report') else b'<a href="/report">Report</a>'
                return body,'text/html',url
        store=Store(':memory:'); cfg={'sources':[self.source()]}
        a=collect(store,cfg,mode='backfill',max_documents=1,fetcher=Fetch())
        self.assertEqual(1,a['pending'])
        b=collect(store,cfg,mode='backfill',max_documents=2,fetcher=Fetch())
        self.assertEqual(0,b['pending'])
        self.assertEqual(2,store.db.execute('SELECT COUNT(*) FROM raw_documents').fetchone()[0])
    def test_failure_is_recorded(self):
        class Fail:
            def fetch(self,url,source): raise TimeoutError('sensitive content must not leak')
        store=Store(':memory:'); result=collect(store,{'sources':[self.source()]},fetcher=Fail())
        self.assertEqual(1,result['failed'])
        self.assertEqual('TimeoutError',store.db.execute('SELECT detail FROM attempts').fetchone()[0])


if __name__ == '__main__': unittest.main()
