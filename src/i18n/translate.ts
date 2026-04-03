
import { en } from "./locales/en";
import type { Namespace, NamespacedTranslationKey, SupportedLocale } from "./types";

const getNestedValue = (obj: unknown, path: string): string => {
	return path
		.split(".")
		.reduce(
			(acc, key) => (acc as Record<string, unknown>)?.[key],
			obj,
		) as string;
};

const interpolateString = (str: string, interpolate: Record<string, string>): string => {
  return Object.entries(interpolate).reduce((acc, [key, value]) => {
    return acc.replace(`{${key}}`, value);
  }, str);
};

export const translate = <N extends Namespace>(locale: SupportedLocale, namespace: N, key: NamespacedTranslationKey<N>, interpolate?: Record<string, string>): string => {
  const translations = en;
  let value = getNestedValue(translations[namespace], key);

  if (value === undefined) {
    value = getNestedValue(en[namespace], key);
  }

  if (interpolate) {
    value = interpolateString(value, interpolate);
  }

  return value;
};
