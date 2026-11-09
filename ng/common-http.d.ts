import { EnvironmentProviders, Signal, WritableSignal } from './core';
import { Observable } from './rxjs';
export interface HttpFeature { ɵkind: number; }
export declare function provideHttpClient(...features: HttpFeature[]): EnvironmentProviders;
export declare function withFetch(): HttpFeature;
export interface HttpOptions { headers?: { [header: string]: string | string[] }; params?: { [param: string]: string | number | boolean }; }
export declare class HttpClient {
  get<T>(url: string, options?: HttpOptions): Observable<T>;
  post<T>(url: string, body: any | null, options?: HttpOptions): Observable<T>;
  put<T>(url: string, body: any | null, options?: HttpOptions): Observable<T>;
  patch<T>(url: string, body: any | null, options?: HttpOptions): Observable<T>;
  delete<T>(url: string, options?: HttpOptions): Observable<T>;
}
export declare class HttpErrorResponse extends Error { readonly status: number; readonly statusText: string; readonly url: string | null; readonly error: any; }
export type ResourceStatus = 'idle' | 'error' | 'loading' | 'reloading' | 'resolved' | 'local';
export interface HttpResourceRef<T> {
  readonly value: WritableSignal<T>;
  readonly status: Signal<ResourceStatus>;
  readonly error: Signal<Error | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly statusCode: Signal<number | undefined>;
  hasValue(): boolean;
  reload(): boolean;
  set(value: T): void;
  update(updater: (value: T) => T): void;
  destroy(): void;
}
export interface HttpResourceFn {
  <TResult = unknown>(url: () => string | undefined, options: { defaultValue: NoInfer<TResult> }): HttpResourceRef<TResult>;
  <TResult = unknown>(url: () => string | undefined, options?: {}): HttpResourceRef<TResult | undefined>;
}
export declare const httpResource: HttpResourceFn;
