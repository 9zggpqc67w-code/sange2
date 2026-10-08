import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  const make = (query: jest.Mock) =>
    new HealthController({ $queryRaw: query } as unknown as PrismaService);

  it('reports ok when the database responds', async () => {
    const res = await make(jest.fn().mockResolvedValue([{ ok: 1 }])).check();
    expect(res.status).toBe('ok');
    expect(res.db).toBe('up');
  });

  it('reports degraded when the database fails', async () => {
    const res = await make(jest.fn().mockRejectedValue(new Error('down'))).check();
    expect(res.status).toBe('degraded');
    expect(res.db).toBe('down');
  });
});
