export declare class DatePipe { transform(value: Date | string | number | null | undefined, format?: string, timezone?: string, locale?: string): string | null; }
export declare class UpperCasePipe { transform(value: string | null | undefined): string | null; }
export declare class LowerCasePipe { transform(value: string | null | undefined): string | null; }
export declare class TitleCasePipe { transform(value: string | null | undefined): string | null; }
export declare class CurrencyPipe { transform(value: number | string | null | undefined, currencyCode?: string, display?: string | boolean, digitsInfo?: string, locale?: string): string | null; }
export declare class DecimalPipe { transform(value: number | string | null | undefined, digitsInfo?: string, locale?: string): string | null; }
export declare class PercentPipe { transform(value: number | string | null | undefined, digitsInfo?: string, locale?: string): string | null; }
export declare class JsonPipe { transform(value: any): string; }
export declare class SlicePipe { transform(value: any, start: number, end?: number): any; }
export declare class AsyncPipe { transform<T>(obj: any): T | null; }
export declare class NgClass {}
export declare class NgStyle {}
export declare class NgOptimizedImage {}
export declare class NgTemplateOutlet {}
export declare class CommonModule {}
export declare function registerLocaleData(data: any, localeId?: string): void;
