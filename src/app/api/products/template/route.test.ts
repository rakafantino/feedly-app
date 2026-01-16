/**
 * @jest-environment node
 */
import { GET } from './route';

describe('Product Template API', () => {
    it('should return CSV template file', async () => {
        const res = await GET();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('text/csv');
        expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="product-template.csv"');

        // Check content
        const blob = await res.blob();
        const text = await blob.text();
        expect(text).toContain('name,description,category,price');
        expect(text).toContain('# CATATAN');
    });
});
