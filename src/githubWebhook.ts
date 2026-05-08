import crypto from 'node:crypto';
import type { PortalRequestStatus } from './portalRequestsStore.js';

const REQUEST_ID_LABEL_PATTERN =
    /^(?:portal[- ]?request(?:[- ]id)?|request[- ]id|request)\s*[:/#-]\s*([A-Za-z0-9._-]+)$/i;
const REQUEST_ID_TEXT_PATTERNS = [
    /(?:^|\n)\s*(?:Portal-Request-Id|Portal Request ID|requestId)\s*:\s*([A-Za-z0-9._-]+)/im,
    /\bportal[- ]?request(?:[- ]id)?\s*[:/#=]\s*([A-Za-z0-9._-]+)/i,
];
const SESSION_CODE_LABEL_PATTERN =
    /^(?:session(?:[- ]code)?)\s*[:/#-]\s*([A-Za-z0-9._-]+)$/i;
const SESSION_CODE_TEXT_PATTERNS = [
    /(?:^|\n)\s*(?:Session-Code|Session Code)\s*:\s*([A-Za-z0-9._-]+)/im,
    /\bsession(?:[- ]code)?\s*[:/#=]\s*([A-Za-z0-9._-]+)/i,
];
const STATUS_LABEL_PATTERN =
    /^(?:portal[- ]?status|status)\s*[:/#-]\s*(submitted|imported|started)$/i;
const STATUS_TEXT_PATTERNS = [
    /(?:^|\n)\s*(?:Portal-Request-Status|Portal Status|Status)\s*:\s*(submitted|imported|started)/im,
];
const STARTED_LABELS = new Set([
    'started',
    'status:started',
    'status/started',
    'status-started',
    'in-progress',
    'status:in-progress',
    'status/in-progress',
    'doing',
]);

type GitHubLabel = {
    name?: string | null;
};

type GitHubUser = {
    login?: string | null;
};

type GitHubIssueLike = {
    title?: string | null;
    body?: string | null;
    state?: string | null;
    labels?: GitHubLabel[];
    assignee?: GitHubUser | null;
    assignees?: GitHubUser[];
    user?: GitHubUser | null;
    html_url?: string | null;
    number?: number | null;
};

export type PortalRequestSyncUpdate = {
    requestId: string;
    status: PortalRequestStatus;
    hostDisplayName?: string;
    sessionCode?: string;
    eventName: string;
    action?: string;
    sourceUrl?: string;
};

function sanitizeOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeLabel(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function isPortalRequestStatus(value: string | undefined): value is PortalRequestStatus {
    return value === 'submitted' || value === 'imported' || value === 'started';
}

function getLabelNames(labels?: GitHubLabel[]): string[] {
    return Array.isArray(labels)
        ? labels
            .map(label => sanitizeOptionalString(label?.name))
            .filter((label): label is string => Boolean(label))
        : [];
}

function findValueFromLabels(labelNames: string[], pattern: RegExp): string | undefined {
    for (const labelName of labelNames) {
        const match = labelName.match(pattern);
        if (match?.[1]) {
            return match[1].trim();
        }
    }

    return undefined;
}

function findValueFromText(texts: string[], patterns: RegExp[]): string | undefined {
    for (const text of texts) {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match?.[1]) {
                return match[1].trim();
            }
        }
    }

    return undefined;
}

function getSearchTexts(subject?: GitHubIssueLike): string[] {
    return [subject?.body, subject?.title]
        .map(value => sanitizeOptionalString(value))
        .filter((value): value is string => Boolean(value));
}

function getPortalRequestId(subject?: GitHubIssueLike): string | undefined {
    const labels = getLabelNames(subject?.labels);
    return findValueFromLabels(labels, REQUEST_ID_LABEL_PATTERN)
        ?? findValueFromText(getSearchTexts(subject), REQUEST_ID_TEXT_PATTERNS);
}

function getSessionCode(subject?: GitHubIssueLike): string | undefined {
    const labels = getLabelNames(subject?.labels);
    return findValueFromLabels(labels, SESSION_CODE_LABEL_PATTERN)
        ?? findValueFromText(getSearchTexts(subject), SESSION_CODE_TEXT_PATTERNS);
}

function getExplicitStatus(subject?: GitHubIssueLike): PortalRequestStatus | undefined {
    const labels = getLabelNames(subject?.labels);
    const fromLabels = findValueFromLabels(labels, STATUS_LABEL_PATTERN)?.toLowerCase();
    if (isPortalRequestStatus(fromLabels)) {
        return fromLabels;
    }

    const fromText = findValueFromText(getSearchTexts(subject), STATUS_TEXT_PATTERNS)?.toLowerCase();
    return isPortalRequestStatus(fromText) ? fromText : undefined;
}

function hasStartedLabel(subject?: GitHubIssueLike): boolean {
    return getLabelNames(subject?.labels).some(labelName => STARTED_LABELS.has(normalizeLabel(labelName)));
}

function getHostDisplayName(subject?: GitHubIssueLike, sender?: GitHubUser): string | undefined {
    const candidates = [
        sanitizeOptionalString(subject?.assignee?.login),
        ...(Array.isArray(subject?.assignees)
            ? subject!.assignees.map(assignee => sanitizeOptionalString(assignee?.login))
            : []),
        sanitizeOptionalString(sender?.login),
        sanitizeOptionalString(subject?.user?.login),
    ];

    return candidates.find((value): value is string => Boolean(value));
}

function extractIssueLikeUpdate(
    eventName: 'issues' | 'pull_request',
    subject: GitHubIssueLike | undefined,
    sender?: GitHubUser,
    action?: string,
): PortalRequestSyncUpdate | null {
    const requestId = getPortalRequestId(subject);
    if (!requestId) {
        return null;
    }

    const status = getExplicitStatus(subject)
        ?? (eventName === 'pull_request' || hasStartedLabel(subject) ? 'started' : 'imported');

    return {
        requestId,
        status,
        hostDisplayName: getHostDisplayName(subject, sender),
        sessionCode: getSessionCode(subject),
        eventName,
        action,
        sourceUrl: sanitizeOptionalString(subject?.html_url),
    };
}

export function verifyGitHubWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    secret: string,
): boolean {
    if (!secret) {
        return true;
    }

    const normalizedSignature = sanitizeOptionalString(signatureHeader);
    if (!normalizedSignature?.startsWith('sha256=')) {
        return false;
    }

    const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const actualBuffer = Buffer.from(normalizedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    return actualBuffer.length === expectedBuffer.length
        && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function extractPortalRequestSyncUpdate(
    eventName: string,
    payload: unknown,
): PortalRequestSyncUpdate | null {
    const body = (payload ?? {}) as Record<string, any>;
    const action = sanitizeOptionalString(body.action);

    if (eventName === 'repository_dispatch') {
        const clientPayload = (body.client_payload ?? {}) as Record<string, unknown>;
        const requestId = sanitizeOptionalString(clientPayload.requestId);
        const status = sanitizeOptionalString(clientPayload.status)?.toLowerCase();

        if (!requestId || !isPortalRequestStatus(status)) {
            return null;
        }

        return {
            requestId,
            status,
            hostDisplayName: sanitizeOptionalString(clientPayload.hostDisplayName),
            sessionCode: sanitizeOptionalString(clientPayload.sessionCode),
            eventName,
            action,
        };
    }

    if (eventName === 'issues') {
        return extractIssueLikeUpdate('issues', body.issue as GitHubIssueLike | undefined, body.sender, action);
    }

    if (eventName === 'pull_request') {
        return extractIssueLikeUpdate(
            'pull_request',
            body.pull_request as GitHubIssueLike | undefined,
            body.sender,
            action,
        );
    }

    return null;
}
