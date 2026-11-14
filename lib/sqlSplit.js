/**
 * Split a SQL file into statements on top-level semicolons only.
 *
 * Naive `text.split(";")` corrupts real files in this repo: it shreds the
 * dollar-quoted body in lib/migration.sql and would split any semicolon inside
 * a string literal. Quoted strings, dollar-quoted blocks and both comment
 * styles are skipped here.
 *
 * @param {string} text
 * @returns {string[]} statements, trimmed and without trailing semicolons
 */
export const splitSqlStatements = (text) => {
  const statements = [];
  let current = "";
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "-" && next === "-") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end + 1;
      continue;
    }

    if (char === "/" && next === "*") {
      // Postgres block comments nest.
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        if (text[i] === "/" && text[i + 1] === "*") { depth += 1; i += 2; }
        else if (text[i] === "*" && text[i + 1] === "/") { depth -= 1; i += 2; }
        else { i += 1; }
      }
      continue;
    }

    if (char === "$") {
      const tag = /^\$[A-Za-z_0-9]*\$/.exec(text.slice(i))?.[0];
      if (tag) {
        const end = text.indexOf(tag, i + tag.length);
        const stop = end === -1 ? text.length : end + tag.length;
        current += text.slice(i, stop);
        i = stop;
        continue;
      }
    }

    if (char === "'" || char === '"') {
      current += char;
      i += 1;
      while (i < text.length) {
        if (text[i] === "\\") { current += text.slice(i, i + 2); i += 2; continue; }
        if (text[i] === char) {
          // Doubled quote is an escaped quote, not the end of the literal.
          if (text[i + 1] === char) { current += char + char; i += 2; continue; }
          current += char;
          i += 1;
          break;
        }
        current += text[i];
        i += 1;
      }
      continue;
    }

    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      i += 1;
      continue;
    }

    current += char;
    i += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
};

// The Neon HTTP driver rejects multi-statement strings, so a file's statements
// travel as separate calls and BEGIN/COMMIT cannot span them. They are dropped
// rather than sent as orphaned no-ops.
const TRANSACTION_MARKER = /^(BEGIN|START\s+TRANSACTION|COMMIT|ROLLBACK)$/i;

/**
 * @param {string} text
 * @returns {{ statements: string[], droppedTransactionMarkers: number }}
 */
export const executableStatements = (text) => {
  const all = splitSqlStatements(text);
  const statements = all.filter((statement) => !TRANSACTION_MARKER.test(statement));
  return {
    statements,
    droppedTransactionMarkers: all.length - statements.length,
  };
};
