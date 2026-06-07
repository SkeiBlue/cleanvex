import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prismaMock = { $queryRaw: jest.fn() } as unknown as PrismaService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('GET /health', () => {
    it('retourne status ok et le nom du service', () => {
      const result = appController.getHealth();
      expect(result).toEqual({ status: 'ok', service: 'personal-platform-api' });
    });
  });

  describe('GET /health/full', () => {
    it("retourne status ok quand la DB répond", async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
      const result = await appController.getFullHealth();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('personal-platform-api');
      expect(result.db.status).toBe('up');
      expect(typeof result.db.latencyMs).toBe('number');
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(result.version).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });

    it('retourne status degraded quand la DB est down', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockRejectedValue(new Error('boom'));
      const result = await appController.getFullHealth();
      expect(result.status).toBe('degraded');
      expect(result.db.status).toBe('down');
      expect(result.db.latencyMs).toBeNull();
    });
  });
});
