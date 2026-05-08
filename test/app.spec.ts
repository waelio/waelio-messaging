import crypto from 'node:crypto';
import { expect } from 'chai';
import request from 'supertest';
import { app, startServer } from '../src/server.js';

function signGitHubPayload(payload: Record<string, unknown>, secret: string) {
    const body = JSON.stringify(payload);
    const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

    return { body, signature };
}

describe('HTTP API Integration Tests', () => {
    let serverHandle: Awaited<ReturnType<typeof startServer>> | undefined;
    const GITHUB_WEBHOOK_SECRET = 'test-github-webhook-secret';

    before(async () => {
        process.env.PORT = '0';
        process.env.NODE_ENV = 'test';
        process.env.GITHUB_WEBHOOK_SECRET = GITHUB_WEBHOOK_SECRET;
        process.env.USE_MONGO_IN_TESTS = 'false';

        serverHandle = await startServer();
    });

    after(async () => {
        if (serverHandle) {
            await serverHandle.shutdown();
        }
    });

    it('creates and retrieves portal requests', async () => {
        const createResponse = await request(app)
            .post('/api/portal-requests')
            .send({
                fullName: 'Octavia Portal',
                topic: 'Sync automation',
                summary: 'Track GitHub status changes.',
                additionalNotes: 'Please keep this in sync.',
            });

        expect(createResponse.status).to.equal(201);
        expect(createResponse.body.requestId).to.be.a('string');
        expect(createResponse.body.status).to.equal('submitted');

        const fetchResponse = await request(app)
            .get(`/api/portal-requests/${createResponse.body.requestId}`);

        expect(fetchResponse.status).to.equal(200);
        expect(fetchResponse.body.requestId).to.equal(createResponse.body.requestId);
        expect(fetchResponse.body.topic).to.equal('Sync automation');
    });

    it('updates portal request status through the REST API', async () => {
        const createResponse = await request(app)
            .post('/api/portal-requests')
            .send({
                fullName: 'Mina Restore',
                topic: 'Manual import',
                summary: 'Track manual status updates.',
            });

        const updateResponse = await request(app)
            .patch(`/api/portal-requests/${createResponse.body.requestId}`)
            .send({
                status: 'imported',
                hostDisplayName: 'maintainer-octo',
                sessionCode: 'SYNC-17',
            });

        expect(updateResponse.status).to.equal(200);
        expect(updateResponse.body.status).to.equal('imported');
        expect(updateResponse.body.hostDisplayName).to.equal('maintainer-octo');
        expect(updateResponse.body.sessionCode).to.equal('SYNC-17');
    });

    it('synchronizes portal request status from GitHub issue webhooks', async () => {
        const createResponse = await request(app)
            .post('/api/portal-requests')
            .send({
                fullName: 'Nora Merge',
                topic: 'GitHub issue sync',
                summary: 'Issue events should move the request forward.',
            });

        const payload = {
            action: 'opened',
            issue: {
                title: 'Portal sync issue',
                body: `Portal-Request-Id: ${createResponse.body.requestId}\nSession-Code: ROOM-42`,
                state: 'open',
                labels: [{ name: 'started' }],
                assignees: [{ login: 'octocat' }],
                html_url: 'https://github.com/waelio/waelio-messaging/issues/42',
            },
            sender: {
                login: 'copilot-bot',
            },
        };
        const { body, signature } = signGitHubPayload(payload, GITHUB_WEBHOOK_SECRET);

        const webhookResponse = await request(app)
            .post('/api/github/webhook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Event', 'issues')
            .set('X-Hub-Signature-256', signature)
            .send(body);

        expect(webhookResponse.status).to.equal(200);
        expect(webhookResponse.body.synced).to.equal(true);
        expect(webhookResponse.body.status).to.equal('started');

        const fetchResponse = await request(app)
            .get(`/api/portal-requests/${createResponse.body.requestId}`);

        expect(fetchResponse.status).to.equal(200);
        expect(fetchResponse.body.status).to.equal('started');
        expect(fetchResponse.body.hostDisplayName).to.equal('octocat');
        expect(fetchResponse.body.sessionCode).to.equal('ROOM-42');
    });

    it('rejects GitHub webhooks with an invalid signature', async () => {
        const payload = {
            action: 'opened',
            issue: {
                title: 'Unsigned sync',
                body: 'Portal-Request-Id: missing',
            },
        };

        const response = await request(app)
            .post('/api/github/webhook')
            .set('Content-Type', 'application/json')
            .set('X-GitHub-Event', 'issues')
            .set('X-Hub-Signature-256', 'sha256=definitely-not-valid')
            .send(JSON.stringify(payload));

        expect(response.status).to.equal(401);
        expect(response.body.error).to.equal('Invalid GitHub webhook signature.');
    });
});
