# Translations

One JSON file per language, named after its language code.

## Adding a language

1. Copy `en.json` to `<code>.json` (e.g. `es.json`).
2. Translate the values (not the keys). And leave `{placeholder}` untouched.
3. Add a line to `index.json`:
   ```json
   { "code": "es", "name": "Español", "short": "ES" }
   ```

The menu entry is built from `index.json` automatically so you don't need to update JavaScript.

note : `ja.json` is shorter because we chose not to translate the console into Japanese.
