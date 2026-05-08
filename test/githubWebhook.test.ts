import { expect } from 'chai';
import crypto from 'node:crypto';
import { extractPortalRequestSyncUpdate, verifyGitHubWebhookSignature } from '../src/githubWebhook.js';

describe('GitHub webhook helpers', () => {
    it('extracts portal sync data from an issue body', () => {
        const result = extractPortalRequestSyncUpdate('issues', {
            action: 'opened',
            issue: {
                title: 'Portal intake',
                body: 'Portal-Request-Id: request-123\nSession-Code: ROOM-42',
                assignee: { login: 'octohost' },
                html_url: 'https://github.com/waelio/waelio-messaging/issues/1',
            },
            sender: { login: 'copilot-bot' },
        });

        expect(result).to.deep.include({
            requestId: 'request-123',
            status: 'imported',
            hostDisplayName: 'octohost',
            sessionCode: 'ROOM-42',
            eventName: 'issues',
            action: 'opened',
        });
    });

    it('promotes issue sync status to started when a started-style label is present', () => {
        const result = extractPortalRequestSyncUpdate('issues', {
            action: 'labeled',
            issue: {
                title: 'Portal intake',
                body: 'Portal-Request-Id: request-456',
                labels: [{ name: 'in-progress' }],
            },
            sender: { login: 'octocat' },
        });

        expect(result).to.deep.include({
            requestId: 'request-456',
            status: 'started',
            hostDisplayName: 'octocat',
            eventName: 'issues',
        });
    });

    it('treats pull request events as started sync updates', () => {
        const result = extractPortalRequestSyncUpdate('pull_request', {
            action: 'opened',
            pull_request: {
                title: 'Portal request sync',
                body: 'Portal-Request-Id: request-789',
                assignees: [{ login: 'maintainer-one' }],
            },
            sender: { login: 'octocat' },
        });

        expect(result).to.deep.include({
            requestId: 'request-789',
            status: 'started',
            hostDisplayName: 'maintainer-one',
            eventName: 'pull_request',
        });
    });

    it('extracts explicit repository dispatch sync payloads', () => {
        const result = extractPortalRequestSyncUpdate('repository_dispatch', {
            action: 'portal-request-sync',
            client_payload: {
                requestId: 'request-dispatch',
                status: 'started',
                hostDisplayName: 'dispatch-host',
                sessionCode: 'ROOM-99',
            },
        });

        expect(result).to.deep.equal({
            requestId: 'request-dispatch',
            status: 'started',
            hostDisplayName: 'dispatch-host',
            sessionCode: 'ROOM-99',
            eventName: 'repository_dispatch',
            action: 'portal-request-sync',
        });
    });

    it('verifies GitHub HMAC signatures', () => {
        const secret = 'super-secret';
        const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
        const validSignature = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;

        expect(verifyGitHubWebhookSignature(rawBody, validSignature, secret)).to.equal(true);
        expect(verifyGitHubWebhookSignature(rawBody, 'sha256=deadbeef', secret)).to.equal(false);
    });
});