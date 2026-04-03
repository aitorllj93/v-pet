import type { en } from "./locales/en";

export type Translations = typeof en;

export type Namespace = keyof Translations;

type FlattenKeys<T, Prefix extends string = ""> = T extends object
	? {
			[K in keyof T]: K extends string
				? T[K] extends string
					? `${Prefix}${K}`
					: FlattenKeys<T[K], `${Prefix}${K}.`>
				: never;
		}[keyof T]
	: never;

export type TranslationKey = FlattenKeys<Translations>;

export type NamespacedTranslationKey<N extends Namespace> = FlattenKeys<Translations[N]>;

export type SupportedLocale =
	| "en";

type DeepStringify<T> = T extends string
	? string
	: T extends object
		? { [K in keyof T]: DeepStringify<T[K]> }
		: T;

export type LocaleTranslations = DeepStringify<Translations>;
