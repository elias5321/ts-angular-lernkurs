import { ApplicationConfig, Type } from './core';
export interface ApplicationRef { destroy(): void; }
export declare function bootstrapApplication(rootComponent: Type<unknown>, options?: ApplicationConfig): Promise<ApplicationRef>;
export declare class Title { getTitle(): string; setTitle(newTitle: string): void; }
