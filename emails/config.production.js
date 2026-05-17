/**
 * Maizzle v5 config for Selbo transactional emails.
 *
 * Run `bunx maizzle build production` from this directory to compile
 * templates in src/ to inline-styled HTML in build_production/.
 *
 * The compiled HTML is committed to git so the runtime send helpers
 * in lib/email/ can read it directly without a build step at deploy
 * time. Designers iterate locally; re-build + commit when templates
 * change.
 */
export default {
  build: {
    content: ["src/templates/**/*.html"],
    output: { path: "build_production", extension: "html" },
  },
  inlineCSS: true,
  removeUnusedCSS: true,
  shorthandCSS: true,
  prettify: true,
  attributes: {
    add: {
      table: { cellpadding: 0, cellspacing: 0, border: 0 },
    },
  },
};
