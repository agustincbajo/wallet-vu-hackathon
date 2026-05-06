import { BaseException } from '../../../../src/infrastructure/exceptions';

describe('BaseException', () => {
  it('defaults severity to fatal and httpStatus to 500', () => {
    const exception = new BaseException('boom');

    expect(exception.severity).toBe('fatal');
    expect(exception.httpStatus).toBe(500);
    expect(exception.code).toBe('UNCLASSIFIED');
    expect(exception.retryable).toBe(false);
  });

  it('uses 400 default httpStatus when severity is not fatal', () => {
    const recoverable = new BaseException('soft', { severity: 'recoverable' });
    const warning = new BaseException('soft', { severity: 'warning' });

    expect(recoverable.httpStatus).toBe(400);
    expect(warning.httpStatus).toBe(400);
  });

  it('respects explicit httpStatus override', () => {
    const exception = new BaseException('teapot', { severity: 'fatal', httpStatus: 418 });

    expect(exception.httpStatus).toBe(418);
  });

  it('preserves cause chain in getMessageChain', () => {
    const root = new Error('root cause');
    const middle = new BaseException('middle', { cause: root });
    const top = new BaseException('top', { cause: middle });

    expect(top.getMessageChain()).toBe('[BaseException] top <- [BaseException] middle <- [Error] root cause');
  });

  it('freezes meta object', () => {
    const exception = new BaseException('x', { meta: { id: 'a' } });

    expect(Object.isFrozen(exception.meta)).toBe(true);
  });

  it('toLogObject exposes structured fields with snake_case', () => {
    const exception = new BaseException('boom', {
      code: 'X',
      severity: 'recoverable',
      httpStatus: 502,
      retryable: true,
      meta: { id: '1' },
    });

    const log = exception.toLogObject();

    expect(log.code).toBe('X');
    expect(log.severity).toBe('recoverable');
    expect(log.http_status).toBe(502);
    expect(log.retryable).toBe(true);
    expect(log.meta).toEqual({ id: '1' });
    expect(log.message_chain).toContain('[BaseException] boom');
  });
});
