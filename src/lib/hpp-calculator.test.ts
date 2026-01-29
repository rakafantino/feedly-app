
import { calculateCleanHpp } from './hpp-calculator';

describe('calculateCleanHpp', () => {
    it('should return purchase price if no hpp details', () => {
        expect(calculateCleanHpp(10000, null)).toBe(10000);
        expect(calculateCleanHpp(10000, {})).toBe(10000);
    });

    it('should add direct costs to purchase price', () => {
        const hppDetails = {
            costs: [
                { name: 'Transport', amount: 500 },
                { name: 'Packaging', amount: 200 }
            ],
            safetyMargin: 1000 // Should be ignored
        };
        // 10000 + 500 + 200 = 10700
        expect(calculateCleanHpp(10000, hppDetails)).toBe(10700);
    });

    it('should handle invalid cost amounts gracefully', () => {
        const hppDetails = {
            costs: [
                { name: 'Transport', amount: 500 },
                { name: 'Invalid', amount: 'abc' as any }
            ]
        };
        expect(calculateCleanHpp(10000, hppDetails)).toBe(10500);
    });

    it('should return 0 if purchase price is null/0', () => {
        expect(calculateCleanHpp(null, {})).toBe(0);
        expect(calculateCleanHpp(0, {})).toBe(0);
    });
});
