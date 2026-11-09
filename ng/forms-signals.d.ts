import { Signal, WritableSignal } from './core';
export interface ValidationError { readonly kind: string; readonly message?: string; }
export interface FieldState<T> {
  readonly value: WritableSignal<T>;
  readonly valid: Signal<boolean>;
  readonly invalid: Signal<boolean>;
  readonly touched: Signal<boolean>;
  readonly dirty: Signal<boolean>;
  readonly disabled: Signal<boolean>;
  readonly required: Signal<boolean>;
  readonly errors: Signal<ValidationError[]>;
  reset(value?: T): void;
  markAsTouched(): void;
}
export type FieldTree<T> = (() => FieldState<T>) & (T extends readonly (infer U)[] ? ReadonlyArray<FieldTree<U>> : T extends object ? { readonly [K in keyof T]-?: FieldTree<T[K]> } : unknown);
declare const PATH: unique symbol;
export type SchemaPath<T> = { [PATH]: T };
export type SchemaPathTree<T> = SchemaPath<T> & (T extends readonly any[] ? unknown : T extends object ? { readonly [K in keyof T]-?: SchemaPathTree<T[K]> } : unknown);
export interface ValidatorConfig { message?: string; }
export declare function form<T>(model: WritableSignal<T>, schema?: (path: SchemaPathTree<T>) => void): FieldTree<T>;
export declare function required<T>(path: SchemaPath<T>, config?: ValidatorConfig): void;
export declare function email(path: SchemaPath<string>, config?: ValidatorConfig): void;
export declare function minLength<T extends string | readonly any[]>(path: SchemaPath<T>, minLength: number, config?: ValidatorConfig): void;
export declare function maxLength<T extends string | readonly any[]>(path: SchemaPath<T>, maxLength: number, config?: ValidatorConfig): void;
export declare function min(path: SchemaPath<number>, min: number, config?: ValidatorConfig): void;
export declare function max(path: SchemaPath<number>, max: number, config?: ValidatorConfig): void;
export declare function pattern(path: SchemaPath<string>, pattern: RegExp, config?: ValidatorConfig): void;
export declare class FormField<T> {}
export declare class FormRoot<T> {}
