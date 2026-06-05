import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required for e2e tests');
}

describe('V0.1 security flows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;

  const testEmail = 'v01-e2e@example.com';
  const signupEmail = 'signup-e2e@example.com';
  const testPassword = 'ChangeMe123!';

  beforeAll(async () => {
    process.env.SMTP_HOST = '';
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });

    await prisma.refreshToken.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.userSetting.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.activityLog.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.auditLog.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: { in: (await prisma.user.findMany({
        where: { email: { in: [testEmail, signupEmail] } },
        select: { id: true },
      })).map((user) => user.id) } },
    });
    await prisma.document.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.vehicle.deleteMany({
      where: { name: { startsWith: 'E2E ' } },
    });
    await prisma.financialTransaction.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.financialAccount.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.financialCategory.deleteMany({
      where: { name: { startsWith: 'E2E ' } },
    });
    await prisma.stockMovement.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.stockItem.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.property.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.contact.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.notification.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.task.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, signupEmail] } } });

    await prisma.user.create({
      data: {
        email: testEmail,
        username: 'V01 Test',
        passwordHash: await bcrypt.hash(testPassword, 12),
        role: 'admin',
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = setupApp(moduleFixture.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await prisma.module.updateMany({
      where: { key: 'documents' },
      data: { isEnabled: true },
    });
    await prisma.module.updateMany({
      where: { key: { in: ['vehicles', 'finances', 'stock', 'agenda', 'contacts'] } },
      data: { isEnabled: true },
    });
    await prisma.module.updateMany({
      where: { key: 'real-estate' },
      data: { isEnabled: true },
    });
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.userSetting.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.activityLog.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.auditLog.deleteMany({
      where: { user: { email: { in: [testEmail, signupEmail] } } },
    });
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: { in: (await prisma.user.findMany({
        where: { email: { in: [testEmail, signupEmail] } },
        select: { id: true },
      })).map((user) => user.id) } },
    });
    await prisma.document.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.vehicle.deleteMany({
      where: { name: { startsWith: 'E2E ' } },
    });
    await prisma.financialTransaction.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.financialAccount.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.financialCategory.deleteMany({
      where: { name: { startsWith: 'E2E ' } },
    });
    await prisma.stockMovement.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.stockItem.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.property.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.contact.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.notification.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.task.deleteMany({
      where: { owner: { email: testEmail } },
    });
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, signupEmail] } } });
    await app.close();
    await prisma.$disconnect();
  });

  it('exposes a health endpoint', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('ok');
      });
  });

  it('logs in, refreshes with rotation, and logs out', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.user.email).toBe(testEmail);
    const firstCookie = login.headers['set-cookie'];
    expect(firstCookie?.[0]).toContain('refresh_token=');

    const firstTokenCount = await prisma.refreshToken.count({
      where: { user: { email: testEmail }, revokedAt: null },
    });
    expect(firstTokenCount).toBe(1);

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);

    expect(refreshed.body.accessToken).toBeTruthy();
    const secondCookie = refreshed.headers['set-cookie'];
    expect(secondCookie?.[0]).toContain('refresh_token=');

    const tokens = await prisma.refreshToken.findMany({
      where: { user: { email: testEmail } },
      orderBy: { createdAt: 'asc' },
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0].revokedAt).toBeTruthy();
    expect(tokens[0].replacedByTokenId).toBe(tokens[1].id);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', secondCookie)
      .expect(204);

    const activeTokenCount = await prisma.refreshToken.count({
      where: { user: { email: testEmail }, revokedAt: null },
    });
    expect(activeTokenCount).toBe(0);
  });

  it('registers a user, blocks login until email verification, then allows login', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: signupEmail,
        password: testPassword,
        username: 'Signup E2E',
      })
      .expect(201);

    expect(registered.body.user.email).toBe(signupEmail);
    expect(registered.body.user.emailVerified).toBe(false);
    expect(registered.body.emailDelivery.sent).toBe(false);
    expect(registered.body.verification.token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: signupEmail, password: testPassword })
      .expect(403);

    const verified = await request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ token: registered.body.verification.token })
      .expect(200);

    expect(verified.body.user.emailVerified).toBe(true);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: signupEmail, password: testPassword })
      .expect(200);

    expect(login.body.accessToken).toBeTruthy();
  });

  it('refuses private documents without an access token', () => {
    return request(app.getHttpServer()).get('/api/documents').expect(401);
  });

  it('uploads and lists private documents with an access token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    const upload = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('private invoice'), 'invoice.txt')
      .expect(201);

    expect(upload.body.name).toBe('invoice.txt');
    expect(upload.body.visibility).toBe('private');

    const list = await request(app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.some((item: { name: string }) => item.name === 'invoice.txt')).toBe(
      true,
    );
  });

  it('blocks documents API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('updates profile, stores settings and exposes activity/audit logs', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    const updated = await request(app.getHttpServer())
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'V01 Test Updated' })
      .expect(200);

    expect(updated.body.username).toBe('V01 Test Updated');

    const setting = await request(app.getHttpServer())
      .put('/api/settings/dashboard.compact')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: true })
      .expect(200);

    expect(setting.body.key).toBe('dashboard.compact');
    expect(setting.body.valueJson).toBe(true);

    const profile = await request(app.getHttpServer())
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.user.email).toBe(testEmail);
    expect(Array.isArray(profile.body.sessions)).toBe(true);

    const activity = await request(app.getHttpServer())
      .get('/api/activity')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(activity.body.some((item: { action: string }) => item.action === 'setting.updated')).toBe(true);

    const audit = await request(app.getHttpServer())
      .get('/api/audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(audit.body.some((item: { action: string }) => item.action === 'auth.login')).toBe(true);

    const errors = await request(app.getHttpServer())
      .get('/api/errors')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(errors.body)).toBe(true);
  });

  it('creates, updates and reads a vehicle with mileage, intervention and alert', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Golf GTI',
        type: 'car',
        status: 'active',
        brand: 'Volkswagen',
        model: 'Golf GTI',
        year: 1991,
        mileage: 180000,
      })
      .expect(201);

    expect(created.body.id).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'restoration' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/vehicles/${created.body.id}/mileage`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mileage: 181000, date: '2026-06-03' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/vehicles/${created.body.id}/interventions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Vidange',
        date: '2026-06-03',
        mileage: 181000,
        costAmount: 89.9,
        status: 'done',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/vehicles/${created.body.id}/alerts`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'technical_control',
        title: 'Controle technique',
        dueDate: '2026-08-01',
      })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('vehicle photo'), 'vehicle-photo.jpg')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/vehicles/${created.body.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: uploaded.body.id, context: 'photo' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.status).toBe('restoration');
    expect(detail.body.mileage).toBe(181000);
    expect(detail.body.interventions).toHaveLength(1);
    expect(detail.body.alerts).toHaveLength(1);
    expect(detail.body.documents).toHaveLength(1);
    expect(detail.body.documents[0].context).toBe('photo');
  });

  it('blocks vehicles API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('creates finances account, category, linked vehicle expense and summary', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/finances')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/modules/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);

    const account = await request(app.getHttpServer())
      .post('/api/finances/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Main account',
        type: 'checking',
        currency: 'EUR',
        initialBalance: 1000,
      })
      .expect(201);

    const category = await request(app.getHttpServer())
      .post('/api/finances/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Entretien',
        type: 'expense',
        color: '#06b6d4',
      })
      .expect(201);

    const vehicle = await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Finance Source',
        type: 'car',
        status: 'active',
      })
      .expect(201);

    const transaction = await request(app.getHttpServer())
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 120.5,
        accountId: account.body.id,
        categoryId: category.body.id,
        operationDate: '2026-06-03',
        label: 'Vidange E2E',
        sourceModule: 'vehicles',
        sourceType: 'vehicle',
        sourceId: vehicle.body.id,
      })
      .expect(201);

    expect(transaction.body.status).toBe('linked');
    expect(transaction.body.sourceModule).toBe('vehicles');

    const summary = await request(app.getHttpServer())
      .get('/api/finances/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(summary.body.accountCount).toBe(1);
    expect(summary.body.transactionCount).toBe(1);
    expect(summary.body.expense).toBe(120.5);
    expect(summary.body.balance).toBe(879.5);
  });

  it('blocks finances API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/finances')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/finances/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/finances')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('creates stock item, purchase expense and vehicle consumption', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    for (const moduleKey of ['stock', 'finances', 'vehicles']) {
      await request(app.getHttpServer())
        .patch(`/api/modules/${moduleKey}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isEnabled: true })
        .expect(200);
    }

    const account = await request(app.getHttpServer())
      .post('/api/finances/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Stock account',
        type: 'checking',
        currency: 'EUR',
        initialBalance: 500,
      })
      .expect(201);

    const vehicle = await request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Stock Target',
        type: 'car',
        status: 'active',
      })
      .expect(201);

    const item = await request(app.getHttpServer())
      .post('/api/stock/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Oil filter',
        category: 'piece',
        unit: 'unit',
        quantity: 2,
        location: 'Shelf A',
      })
      .expect(201);

    const purchase = await request(app.getHttpServer())
      .post(`/api/stock/items/${item.body.id}/purchase`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        quantity: 3,
        valueAmount: 45,
        accountId: account.body.id,
        operationDate: '2026-06-03',
      })
      .expect(201);

    expect(Number(purchase.body.item.quantity)).toBe(5);
    expect(purchase.body.transaction.sourceModule).toBe('stock');

    const consume = await request(app.getHttpServer())
      .post(`/api/stock/items/${item.body.id}/consume`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        quantity: 1,
        valueAmount: 15,
        vehicleId: vehicle.body.id,
        note: 'Used in service',
      })
      .expect(201);

    expect(Number(consume.body.item.quantity)).toBe(4);
    expect(consume.body.movement.targetType).toBe('vehicle');
    expect(consume.body.intervention.title).toBe('Stock - E2E Oil filter');
  });

  it('blocks stock API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/stock')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/stock/items')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/stock')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('creates agenda task, subtask and notification then marks notification read', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/agenda')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);

    const task = await request(app.getHttpServer())
      .post('/api/agenda/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E Controle technique',
        description: 'Verifier les papiers',
        priority: 'high',
        dueDate: '2026-07-01',
        moduleKey: 'vehicles',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/agenda/tasks/${task.body.id}/subtasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Prendre rendez-vous', position: 1 })
      .expect(201);

    const tasks = await request(app.getHttpServer())
      .get('/api/agenda/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(tasks.body[0].subtasks).toHaveLength(1);

    const notifications = await request(app.getHttpServer())
      .get('/api/agenda/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(notifications.body.some((item: { targetId: string }) => item.targetId === task.body.id)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/agenda/notifications/${notifications.body[0].id}/read`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const dashboard = await request(app.getHttpServer())
      .get('/api/agenda/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.openTasks).toBeGreaterThanOrEqual(1);
  });

  it('blocks agenda API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/agenda')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/agenda/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/agenda')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('creates real estate property, event, linked document and finance source', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    for (const moduleKey of ['real-estate', 'finances']) {
      await request(app.getHttpServer())
        .patch(`/api/modules/${moduleKey}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isEnabled: true })
        .expect(200);
    }

    const property = await request(app.getHttpServer())
      .post('/api/real-estate/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Appartement test',
        type: 'apartment',
        status: 'owned',
        city: 'Lyon',
        surface: 42.5,
        rooms: 2,
        estimatedValue: 180000,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/real-estate/properties/${property.body.id}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'maintenance',
        title: 'E2E Revision chaudiere',
        date: '2026-10-01',
        amount: 120,
      })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('property document'), 'property-doc.txt')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/real-estate/properties/${property.body.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: uploaded.body.id, context: 'diagnostic' })
      .expect(201);

    const account = await request(app.getHttpServer())
      .post('/api/finances/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'E2E Property account',
        type: 'checking',
        currency: 'EUR',
        initialBalance: 1000,
      })
      .expect(201);

    const transaction = await request(app.getHttpServer())
      .post('/api/finances/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'expense',
        amount: 120,
        accountId: account.body.id,
        operationDate: '2026-10-01',
        label: 'E2E Chaudiere',
        sourceModule: 'real-estate',
        sourceType: 'property',
        sourceId: property.body.id,
      })
      .expect(201);

    expect(transaction.body.sourceModule).toBe('real-estate');

    const detail = await request(app.getHttpServer())
      .get(`/api/real-estate/properties/${property.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.events).toHaveLength(1);
    expect(detail.body.documents).toHaveLength(1);
  });

  it('blocks real estate API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/real-estate')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/real-estate/properties')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/real-estate')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('creates contact, interaction and linked document', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);

    const contact = await request(app.getHttpServer())
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'company',
        displayName: 'E2E Garage Contact',
        organization: 'E2E Garage',
        email: 'garage-e2e@example.com',
        phone: '0102030405',
        city: 'Lyon',
        tags: 'garage,vehicule',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/contacts/${contact.body.id}/interactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'call',
        title: 'E2E Appel devis',
        date: '2026-06-04',
        notes: 'Demande de prix',
      })
      .expect(201);

    const uploaded = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('contact document'), 'contact-doc.txt')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/contacts/${contact.body.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ documentId: uploaded.body.id, context: 'contract' })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/contacts/${contact.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.displayName).toBe('E2E Garage Contact');
    expect(detail.body.interactions).toHaveLength(1);
    expect(detail.body.documents).toHaveLength(1);

    const search = await request(app.getHttpServer())
      .get('/api/search?q=Garage')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(search.body.results.some((item: { type: string }) => item.type === 'contact')).toBe(true);
  });

  it('blocks contacts API when the module is disabled', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .patch('/api/modules/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .patch('/api/modules/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ isEnabled: true })
      .expect(200);
  });

  it('searches globally, returns reports and exports a secured zip', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    const token = login.body.accessToken;

    await request(app.getHttpServer())
      .post('/api/agenda/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'E2E Searchable task',
        dueDate: '2026-09-01',
      })
      .expect(201);

    const search = await request(app.getHttpServer())
      .get('/api/search?q=Searchable')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(search.body.results.some((item: { type: string }) => item.type === 'task')).toBe(true);

    const report = await request(app.getHttpServer())
      .get('/api/reports/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(report.body.counts.openTasks).toBeGreaterThanOrEqual(1);
    expect(report.body.generatedAt).toBeTruthy();

    await request(app.getHttpServer()).get('/api/backups/export.zip').expect(401);

    const zip = await request(app.getHttpServer())
      .get('/api/backups/export.zip')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(zip.headers['content-type']).toContain('application/zip');
    expect(zip.body.length).toBeGreaterThan(100);
  });
});
