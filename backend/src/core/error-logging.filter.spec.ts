import 'reflect-metadata';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorLoggingFilter } from './error-logging.filter';

function makeHost(statusFn: jest.Mock, _jsonFn: jest.Mock) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: statusFn }),
      getRequest: () => ({ url: '/test' }),
    }),
  };
}

function makePrisma() {
  return { errorLog: { create: jest.fn().mockResolvedValue({}) } };
}

describe('ErrorLoggingFilter', () => {
  it('renvoie 400 pour une HttpException', () => {
    const jsonFn = jest.fn();
    const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    const filter = new ErrorLoggingFilter(makePrisma() as never);
    filter.catch(
      new HttpException('Bad input', HttpStatus.BAD_REQUEST),
      makeHost(statusFn, jsonFn) as never,
    );
    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it('renvoie 500 pour une erreur inconnue', () => {
    const jsonFn = jest.fn();
    const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    const filter = new ErrorLoggingFilter(makePrisma() as never);
    filter.catch(new Error('crash'), makeHost(statusFn, jsonFn) as never);
    expect(statusFn).toHaveBeenCalledWith(500);
  });

  it('inclut timestamp et path dans la reponse', () => {
    const jsonFn = jest.fn();
    const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    const filter = new ErrorLoggingFilter(makePrisma() as never);
    filter.catch(
      new HttpException('not found', 404),
      makeHost(statusFn, jsonFn) as never,
    );
    const payload = jsonFn.mock.calls[0][0];
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('path', '/test');
  });

  it('loggue en DB les erreurs 500', () => {
    const jsonFn = jest.fn();
    const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    const prisma = makePrisma();
    const filter = new ErrorLoggingFilter(prisma as never);
    filter.catch(
      new Error('crash serveur'),
      makeHost(statusFn, jsonFn) as never,
    );
    expect(prisma.errorLog.create).toHaveBeenCalledTimes(1);
  });
});
