import math
import unittest
from unittest.mock import patch
from patterns import group_curves, group_pdf, validate_grid


def drawing(cell, angle=0, scale=1, shape=0):
    x, y = cell % 4 * 20 + 10, cell // 4 * 20 + 10
    points = []
    for n in range(25):
        a = n / 25 * math.tau
        radius = 4 + math.sin(a * (3 if shape == 0 else 5))
        p = complex(math.cos(a), math.sin(a)) * radius * scale * complex(math.cos(angle), math.sin(angle))
        points.append((x + p.real, y + p.imag))
    xs, ys = zip(*points)
    return {'x0': min(xs), 'x1': max(xs), 'top': min(ys), 'bottom': max(ys),
            'width': max(xs) - min(xs), 'height': max(ys) - min(ys),
            'path': [('m', points[0])] + [('l', p) for p in points[1:]] + [('h',)],
            'non_stroking_color': (.2, .3, .4)}


class PatternTests(unittest.TestCase):
    def test_repeat_grouping_is_invariant_to_position_rotation_and_scale(self):
        curves = [drawing(0), drawing(5, math.pi / 2, .8), drawing(10, math.pi, 1.2),
                  drawing(3, shape=1), drawing(7, shape=1)]
        result = group_curves(curves, 80, 80, 4, 4, dict(x=0, y=0, w=1, h=1))
        self.assertEqual([g['cells'] for g in result['groups']], [[0, 5, 10], [3, 7]])
        self.assertEqual(set(result['unmatched']), set(range(16)) - {0, 5, 10, 3, 7})
        self.assertNotIn('category', result['groups'][0])

    def test_outside_drawings_do_not_influence_the_board_groups(self):
        curves = [drawing(0), drawing(5), drawing(40)]
        result = group_curves(curves, 80, 80, 4, 4, dict(x=0, y=0, w=1, h=1))
        self.assertEqual(result['groups'], [{'cells': [0, 5]}])

    def test_empty_or_raster_pages_leave_all_cells_for_image_grouping(self):
        result = group_curves([], 80, 80, 4, 4, dict(x=0, y=0, w=1, h=1))
        self.assertEqual(result, {'groups': [], 'unmatched': list(range(16))})

    def test_rejects_invalid_grid_bounds_dimensions_and_files(self):
        for grid in [None, dict(x=-.1, y=0, w=1, h=1), dict(x=0, y=0, w=float('nan'), h=1),
                     dict(x=0, y=0, w=1.1, h=1), dict(x=0, y=0, w=0, h=1), dict(x=True, y=0, w=1, h=1)]:
            with self.assertRaises(ValueError):
                validate_grid(4, 4, grid)
        for rows in [0, 65, 1.5, True]:
            with self.assertRaises(ValueError):
                validate_grid(rows, 4, dict(x=0, y=0, w=1, h=1))
        with self.assertRaises(ValueError):
            group_pdf(b'not a PDF', 1, 4, 4, dict(x=0, y=0, w=1, h=1))

    def test_missing_optional_parser_has_an_actionable_error(self):
        with patch.dict('sys.modules', {'pdfplumber': None}):
            with self.assertRaisesRegex(ValueError, 'requirements.txt'):
                group_pdf(b'%PDF-mock', 1, 4, 4, dict(x=0, y=0, w=1, h=1))


if __name__ == '__main__':
    unittest.main()
