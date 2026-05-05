/** Cursor chain interfaces — matched by both MongoDB's FindCursor and the in-memory mock. */
export interface ILimitedCursor<T> {
    toArray(): Promise<T[]>;
}

export interface ISortedCursor<T> {
    limit(n: number): ILimitedCursor<T>;
}

export interface IFindResult<T> {
    sort(spec: Record<string, 1 | -1>): ISortedCursor<T>;
}

/**
 * Minimal collection contract shared by the real MongoDB collection and the in-memory mock.
 * Only the two operations actually used by this codebase are declared here.
 */
export interface IMessagesCollection<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insertOne(doc: T): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    find(query?: any): IFindResult<T>;
}
