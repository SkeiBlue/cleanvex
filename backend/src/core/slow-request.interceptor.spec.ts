import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { SlowRequestInterceptor } from './slow-request.interceptor';

function makeContext(method = 'GET', url = '/api/test') {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method, url, originalUrl: url }),
    }),
  } as unknown as ExecutionContext;
}

describe('SlowRequestInterceptor', () => {
  let interceptor: SlowRequestInterceptor;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.SLOW_REQUEST_THRESHOLD_MS = '50';
    interceptor = new SlowRequestInterceptor();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    delete process.env.SLOW_REQUEST_THRESHOLD_MS;
  });

  it("ne log rien quand la requête est sous le seuil", async () => {
    const handler: CallHandler = { handle: () => of('ok') };
    await lastValueFrom(interceptor.intercept(makeContext(), handler));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("log un warn quand la requête dépasse le seuil", async () => {
    const handler: CallHandler = { handle: () => of('ok').pipe(delay(80)) };
    await lastValueFrom(interceptor.intercept(makeContext('POST', '/api/heavy'), handler));
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/POST \/api\/heavy \d+ms/);
  });

  it('ignore les contextes non-HTTP', async () => {
    const handler: CallHandler = { handle: () => of('ok').pipe(delay(80)) };
    const wsCtx = { getType: () => 'ws' } as unknown as ExecutionContext;
    await lastValueFrom(interceptor.intercept(wsCtx, handler));
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
