import importlib.util
import pathlib
import unittest
spec = importlib.util.spec_from_file_location('local_model', pathlib.Path(__file__).parents[1] / 'src/local-model.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class AnswerReviewTests(unittest.TestCase):
    def review(self, flags=(True, False)):
        return {'selectedAnswer': 'A', 'evaluations': [{'option': option, 'isCorrect': flag, 'sourceVerdict': 'supports' if flag is True else 'contradicts'} for option, flag in zip(['A','B'], flags)]}
    def test_one_correct_answer(self):
        self.assertEqual(worker.select_reviewed_answer(self.review(), ['A','B']), 'A')
    def test_multiple_or_no_correct_answers(self):
        for flags in [(True,True),(False,False)]:
            with self.assertRaises(ValueError): worker.select_reviewed_answer(self.review(flags), ['A','B'])
    def test_unresolved_distractor(self):
        review=self.review();review['evaluations'][1]['sourceVerdict']='unclear'
        with self.assertRaises(ValueError): worker.select_reviewed_answer(review, ['A','B'])
    def test_missing_option(self):
        with self.assertRaises(ValueError): worker.select_reviewed_answer(self.review(), ['A','B','C'])
    def test_mismatched_answer_key(self):
        review=self.review();review['selectedAnswer']='B'
        with self.assertRaises(ValueError): worker.select_reviewed_answer(review, ['A','B'])
    def test_string_booleans_rejected(self):
        with self.assertRaises(ValueError): worker.select_reviewed_answer(self.review((True,'false')), ['A','B'])

class SpareChoiceTests(unittest.TestCase):
    def test_prediction_options_cover_every_combination(self):
        pairs = [['A rises', 'A falls'], ['B rises', 'B falls']]
        self.assertEqual(worker.prediction_choices(pairs, 2),
                         ['A rises; B rises', 'A rises; B falls', 'A falls; B rises', 'A falls; B falls'])
        for invalid in [pairs[:1], [['A falls', 'A falls'], pairs[1]]]:
            with self.assertRaises(ValueError):
                worker.prediction_choices(invalid, 2)

    def test_keeps_only_contradicted_choices(self):
        review = {'verdicts':dict(zip('ABCD','UCSC')), 'pick':'C'}
        self.assertEqual(worker.reviewed_choices(review, ['unclear','wrong','right','wrong2'], 2),
                         ('right', ['wrong','wrong2']))

    def test_rejects_ambiguous_incomplete_or_disagreeing_checks(self):
        for verdicts, pick in [('UCSU','C'), ('SCSS','A'), ('SCCC','B'), ('SCC','A'), ('SCC?','A')]:
            with self.subTest(verdicts=verdicts, pick=pick), self.assertRaises(ValueError):
                worker.reviewed_choices({'verdicts':dict(zip('ABCD',verdicts)),'pick':pick}, list('abcd'), 2)

if __name__ == '__main__': unittest.main()
