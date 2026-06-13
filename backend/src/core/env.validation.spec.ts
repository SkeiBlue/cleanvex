import { assertRequiredEnv, checkEnv } from './env.validation';

describe('checkEnv', () => {
  it('ok quand les vars requises sont présentes', () => {
    const r = checkEnv({
      DATABASE_URL: 'x',
      JWT_ACCESS_SECRET: 'y',
    });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('liste les vars manquantes', () => {
    const r = checkEnv({});
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('DATABASE_URL');
    expect(r.missing).toContain('JWT_ACCESS_SECRET');
  });

  it('liste les warnings pour vars recommandées', () => {
    const r = checkEnv({
      DATABASE_URL: 'x',
      JWT_ACCESS_SECRET: 'y',
    });
    expect(r.warnings).toContain('FRONTEND_ORIGIN');
  });

  it('considère une string vide comme absente', () => {
    const r = checkEnv({
      DATABASE_URL: '   ',
      JWT_ACCESS_SECRET: 'y',
    });
    expect(r.missing).toContain('DATABASE_URL');
  });
});

describe('assertRequiredEnv', () => {
  it('ne throw pas si vars présentes', () => {
    expect(() =>
      assertRequiredEnv({
        DATABASE_URL: 'x',
        JWT_ACCESS_SECRET: 'y',
      }),
    ).not.toThrow();
  });

  it('throw avec la liste si vars manquantes', () => {
    expect(() => assertRequiredEnv({})).toThrow(
      /DATABASE_URL.*JWT_ACCESS_SECRET/,
    );
  });
});
