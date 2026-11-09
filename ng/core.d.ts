declare const SIGNAL: unique symbol;
export interface Type<T> extends Function { new (...args: any[]): T; }
export interface AbstractType<T> extends Function { prototype: T; }
export declare class InjectionToken<T> { constructor(desc: string, options?: { providedIn?: 'root' | 'platform' | null; factory: () => T }); private _t: T; }
export type Signal<T> = (() => T) & { [SIGNAL]: unknown };
export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(updateFn: (value: T) => T): void;
  asReadonly(): Signal<T>;
}
export interface CreateSignalOptions<T> { equal?: (a: T, b: T) => boolean; debugName?: string; }
export declare function signal<T>(initialValue: T, options?: CreateSignalOptions<T>): WritableSignal<T>;
export declare function computed<T>(computation: () => T, options?: CreateSignalOptions<T>): Signal<T>;
export declare function linkedSignal<D>(computation: () => D): WritableSignal<D>;
export declare function untracked<T>(nonReactiveReadsFn: () => T): T;
export interface EffectRef { destroy(): void; }
export declare function effect(effectFn: (onCleanup: (cleanupFn: () => void) => void) => void): EffectRef;
export interface InputSignal<T> extends Signal<T> {}
export interface InputOptions<T> { alias?: string; debugName?: string; transform?: (v: any) => T; }
export interface InputFunction {
  <T>(): InputSignal<T | undefined>;
  <T>(initialValue: T, opts?: InputOptions<T>): InputSignal<T>;
  required: { <T>(opts?: InputOptions<T>): InputSignal<T>; };
}
export declare const input: InputFunction;
export interface OutputRefSubscription { unsubscribe(): void; }
export declare class OutputEmitterRef<T> {
  emit(value: T): void;
  subscribe(callback: (value: T) => void): OutputRefSubscription;
}
export declare function output<T = void>(opts?: { alias?: string }): OutputEmitterRef<T>;
export interface ModelSignal<T> extends WritableSignal<T> {}
export interface ModelFunction {
  <T>(): ModelSignal<T | undefined>;
  <T>(initialValue: T, opts?: { alias?: string }): ModelSignal<T>;
  required: { <T>(opts?: { alias?: string }): ModelSignal<T>; };
}
export declare const model: ModelFunction;
export declare function inject<T>(token: Type<T> | AbstractType<T> | InjectionToken<T>): T;
export interface TypeDecorator { <T extends Type<any>>(type: T): T; (target: Object, propertyKey?: string | symbol, parameterIndex?: number): void; }
export declare enum ChangeDetectionStrategy { OnPush = 0, Eager = 1, Default = 1 }
export declare enum ViewEncapsulation { Emulated = 0, None = 2, ShadowDom = 3 }
export type Provider = any;
export interface EnvironmentProviders { ɵbrand: 'EnvironmentProviders'; }
export interface Component {
  selector?: string;
  template?: string;
  templateUrl?: string;
  styles?: string | string[];
  styleUrl?: string;
  styleUrls?: string[];
  imports?: any[];
  providers?: Provider[];
  changeDetection?: ChangeDetectionStrategy;
  encapsulation?: ViewEncapsulation;
  standalone?: boolean;
  host?: { [key: string]: string };
}
export declare function Component(obj: Component): TypeDecorator;
export declare function Directive(obj?: { selector?: string; host?: { [key: string]: string }; standalone?: boolean; providers?: Provider[] }): TypeDecorator;
export declare function Pipe(obj: { name: string; pure?: boolean; standalone?: boolean }): TypeDecorator;
export interface PipeTransform { transform(value: any, ...args: any[]): any; }
export declare function Service(options?: { autoProvided?: boolean; factory?: () => unknown }): TypeDecorator;
export declare function Injectable(options?: { providedIn: Type<any> | 'root' | 'platform' | 'any' | null }): TypeDecorator;
export interface OnInit { ngOnInit(): void; }
export interface OnDestroy { ngOnDestroy(): void; }
export interface ApplicationConfig { providers: Array<Provider | EnvironmentProviders>; }
export declare function provideBrowserGlobalErrorListeners(): EnvironmentProviders;
export declare function provideZonelessChangeDetection(): EnvironmentProviders;
export declare class ElementRef<T = any> { nativeElement: T; constructor(nativeElement: T); }
export declare abstract class DestroyRef { abstract onDestroy(callback: () => void): () => void; }
export declare function viewChild<T>(locator: string | Type<T>): Signal<T | undefined>;
export declare function afterNextRender(callback: () => void): { destroy(): void };
export declare function isDevMode(): boolean;
