export interface Observer<T> { next?: (value: T) => void; error?: (err: any) => void; complete?: () => void; }
export declare class Subscription { unsubscribe(): void; readonly closed: boolean; }
export declare class Observable<T> {
  subscribe(observerOrNext?: Partial<Observer<T>> | ((value: T) => void)): Subscription;
  pipe(...operations: any[]): Observable<any>;
}
export declare function firstValueFrom<T>(source: Observable<T>): Promise<T>;
export declare function lastValueFrom<T>(source: Observable<T>): Promise<T>;
export declare function of<T>(...values: T[]): Observable<T>;
