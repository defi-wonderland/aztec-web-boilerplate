import { describe, expect, it } from 'vitest';
import { queuePxeCall } from '../../../src/utils/pxeQueue';

describe('queuePxeCall', () => {
  it('serializes operations in order', async () => {
    const order: string[] = [];
    let firstRunning = false;

    const op1 = async () => {
      firstRunning = true;
      await Promise.resolve();
      order.push('first');
      firstRunning = false;
    };

    const op2 = async () => {
      expect(firstRunning).toBe(false);
      order.push('second');
    };

    await Promise.all([queuePxeCall(op1), queuePxeCall(op2)]);

    expect(order).toEqual(['first', 'second']);
  });

  it('rejects if the operation throws but continues the queue', async () => {
    const order: string[] = [];

    const failing = async () => {
      order.push('fail');
      throw new Error('boom');
    };

    await expect(queuePxeCall(failing)).rejects.toThrow('boom');

    const succeeding = async () => {
      order.push('success');
      return 'ok';
    };

    const result = await queuePxeCall(succeeding);

    expect(result).toBe('ok');
    expect(order).toEqual(['fail', 'success']);
  });
});


