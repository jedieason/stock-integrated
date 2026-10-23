import importlib.util
import pathlib
import unittest

path=pathlib.Path(__file__).resolve().parents[1]/'scripts/update_data.py'
spec=importlib.util.spec_from_file_location('providers',path)
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class ProviderTests(unittest.TestCase):
    def test_roc_dates(self):
        self.assertEqual(p.roc_date('115/10/22'),'2026-10-22')
        self.assertEqual(p.roc_date('1151022'),'2026-10-22')
    def test_missing_fields_are_not_zero(self):
        for v in ['',None,'--','NaN','Infinity']: self.assertIsNone(p.number(v))
        self.assertEqual(p.number('1,234.50'),1234.5)
    def test_invalid_ohlc_does_not_enter_history(self):
        bars=[dict(date='2026-01-01',open=10,high=8,low=9,close=10)]
        valid,issues=p.validate_bars(bars)
        self.assertEqual(valid,[])
        self.assertEqual(issues[0]['code'],'VALIDATION_FAILED')
    def test_duplicates_are_deduplicated_and_reported(self):
        b=dict(date='2026-01-01',open=10,high=11,low=9,close=10)
        valid,issues=p.validate_bars([b,b])
        self.assertEqual(len(valid),1)
        self.assertEqual(issues[0]['code'],'DUPLICATE_OBSERVATION')
    def test_split_discontinuity_requires_review(self):
        a=dict(date='2026-01-01',open=100,high=102,low=99,close=100)
        b=dict(date='2026-01-02',open=25,high=26,low=24,close=25,change=0)
        _,issues=p.validate_bars([a,b])
        self.assertEqual(issues[0]['code'],'CORPORATE_ACTION_REVIEW_REQUIRED')
    def test_fred_official_table_and_deferred_rows(self):
        html='<tr><th scope="row">2026-01-01</th><td> 3.50</td></tr> #2026-01-02| 3.75 #2026-01-03| .'
        self.assertEqual(p.parse_fred_table(html,'2026-01-01'),[{'date':'2026-01-01','value':3.5},{'date':'2026-01-02','value':3.75}])
    def test_fred_plain_text_and_date_range(self):
        text='2024-01-01 3.0\n2026-01-01 4.0\n2026-01-02 .\n'
        self.assertEqual(p.parse_fred_table(text,'2025-01-01'),[{'date':'2026-01-01','value':4.0}])

if __name__=='__main__': unittest.main()
