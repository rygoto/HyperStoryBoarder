const OMIT = Symbol('omit');

const isPlainObject = (value) => {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const unwrapArrayField = (value, fieldName, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value[fieldName])) return value[fieldName];
  if (value == null) return fallback;
  return [value];
};

export const normalizeCutImages = (value) =>
  unwrapArrayField(value, 'urls', [null]);

const sanitizeUndefined = (value, insideArray = false) => {
  if (value === undefined) return insideArray ? null : OMIT;

  if (Array.isArray(value)) {
    return value.map(item => sanitizeUndefined(item, true));
  }

  if (isPlainObject(value)) {
    const sanitized = {};
    Object.entries(value).forEach(([key, child]) => {
      const next = sanitizeUndefined(child, false);
      if (next !== OMIT) sanitized[key] = next;
    });
    return sanitized;
  }

  return value;
};

export const findNestedArrayPath = (value, path = 'root', parentIsArray = false) => {
  if (Array.isArray(value)) {
    if (parentIsArray) return path;
    for (let index = 0; index < value.length; index += 1) {
      const nestedPath = findNestedArrayPath(value[index], `${path}[${index}]`, true);
      if (nestedPath) return nestedPath;
    }
    return null;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const nestedPath = findNestedArrayPath(child, `${path}.${key}`, false);
      if (nestedPath) return nestedPath;
    }
  }

  return null;
};

export const serializePages = (pages) => {
  if (!Array.isArray(pages)) return pages;

  const serialized = pages.map(page => {
    const nextPage = { ...page };

    if (Array.isArray(page.images)) {
      nextPage.images = page.images.map(value => ({
        urls: normalizeCutImages(value)
      }));
    }

    if (Array.isArray(page.dialogueLines)) {
      nextPage.dialogueLines = page.dialogueLines.map(value => ({
        lines: unwrapArrayField(value, 'lines')
      }));
    }

    return nextPage;
  });

  const sanitized = sanitizeUndefined(serialized);
  const nestedArrayPath = findNestedArrayPath(sanitized);
  if (nestedArrayPath) {
    throw new Error(`保存データに未対応のネスト配列があります: ${nestedArrayPath}`);
  }

  return sanitized;
};

export const deserializePages = (pages) => {
  if (!Array.isArray(pages)) return pages;

  return pages.map(page => {
    const nextPage = { ...page };

    if (Array.isArray(page.images)) {
      nextPage.images = page.images.map(value =>
        normalizeCutImages(value)
      );
    }

    if (Array.isArray(page.dialogueLines)) {
      nextPage.dialogueLines = page.dialogueLines.map(value =>
        unwrapArrayField(value, 'lines')
      );
    }

    return nextPage;
  });
};
