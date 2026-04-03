
import { translate } from "./translate";
import type { Namespace, NamespacedTranslationKey, SupportedLocale } from "./types";

  type A = NamespacedTranslationKey<'common'>;

export const useTranslation = <N extends Namespace>(namespace: N) => {
  const locale = 'en' as SupportedLocale;

  const t = (key: NamespacedTranslationKey<N>, interpolate?: Record<string, string>) => translate(locale, namespace, key, interpolate);

  
	return { t, locale };
};

