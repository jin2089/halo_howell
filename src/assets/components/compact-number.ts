const formatters = new Map<string, Intl.NumberFormat>();

export const DEFAULT_LOCALE = "en";

/** Returns a cached formatter: `Intl.NumberFormat` construction is comparatively expensive. */
export function getCompactFormatter(locale: string): Intl.NumberFormat {
  const cached = formatters.get(locale);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });

  formatters.set(locale, formatter);

  return formatter;
}

/** Falls back to English whenever the tag is missing or unsupported by the ICU data. */
export function resolveLocale(tag: string | null | undefined): string {
  if (!tag) {
    return DEFAULT_LOCALE;
  }

  try {
    return Intl.NumberFormat.supportedLocalesOf([tag]).length > 0 ? tag : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Parses a raw attribute value; returns null when it is absent or not numeric. */
export function parseCount(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Formats a count with ICU compact notation, so that every locale uses its own
 * unit (`12.3K` in en, `1.2万` in zh-CN, `1.2萬` in zh-TW).
 *
 * Non numeric input is returned verbatim, which keeps legacy behaviour for
 * values like `-` or `N/A`.
 */
export function formatCompactNumber(value: string | null | undefined, locale: string): string {
  const count = parseCount(value);

  if (count === null) {
    return value?.trim() ?? "";
  }

  return getCompactFormatter(resolveLocale(locale)).format(count);
}
