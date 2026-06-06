import 'reflect-metadata';
import { paginate } from './pagination.helper';

describe('paginate()', () => {
  const data = [{ id: '1' }, { id: '2' }, { id: '3' }];

  it('retourne les bonnes metadonnees sur la premiere page', () => {
    const result = paginate(data, 30, 1, 10);
    expect(result).toEqual({
      data,
      total: 30,
      page: 1,
      limit: 10,
      totalPages: 3,
    });
  });

  it('calcule totalPages en arrondissant au superieur', () => {
    expect(paginate([], 21, 1, 10).totalPages).toBe(3);
    expect(paginate([], 20, 1, 10).totalPages).toBe(2);
    expect(paginate([], 0, 1, 10).totalPages).toBe(0);
  });

  it('gere une seule page', () => {
    const result = paginate(data, 3, 1, 20);
    expect(result.totalPages).toBe(1);
    expect(result.data).toHaveLength(3);
  });

  it('gere un tableau vide', () => {
    const result = paginate([], 0, 1, 20);
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('conserve les donnees telles quelles (meme reference)', () => {
    const items = [{ id: 'a', name: 'test' }];
    expect(paginate(items, 1, 1, 20).data).toBe(items);
  });
});
