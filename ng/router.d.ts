import { EnvironmentProviders, Signal, Type } from './core';
import { Observable } from './rxjs';
export interface Route {
  path?: string;
  component?: Type<any>;
  loadComponent?: () => Promise<Type<any>> | Type<any>;
  redirectTo?: string;
  pathMatch?: 'prefix' | 'full';
  title?: string;
  children?: Route[];
  data?: { [key: string | symbol]: any };
}
export type Routes = Route[];
export interface RouterFeatures { ɵkind: number; }
export declare function provideRouter(routes: Routes, ...features: RouterFeatures[]): EnvironmentProviders;
export declare function withComponentInputBinding(): RouterFeatures;
export declare class RouterOutlet {}
export declare class RouterLink {}
export declare class RouterLinkActive {}
export interface ParamMap { has(name: string): boolean; get(name: string): string | null; getAll(name: string): string[]; readonly keys: string[]; }
export declare class ActivatedRouteSnapshot { readonly paramMap: ParamMap; readonly queryParamMap: ParamMap; readonly params: { [key: string]: any }; }
export declare class ActivatedRoute { readonly snapshot: ActivatedRouteSnapshot; readonly paramMap: Observable<ParamMap>; readonly params: Observable<{ [key: string]: any }>; }
export declare class Router {
  readonly url: string;
  navigate(commands: readonly any[], extras?: { queryParams?: { [k: string]: any }; replaceUrl?: boolean }): Promise<boolean>;
  navigateByUrl(url: string): Promise<boolean>;
}
