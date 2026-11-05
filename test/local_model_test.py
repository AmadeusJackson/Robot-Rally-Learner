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

if __name__ == '__main__': unittest.main()
