# Browser dependency

`js-yaml.min.js` is copied from the js-yaml version recorded in package-lock.json.
Its upstream license is preserved in js-yaml.LICENSE.

After a js-yaml dependency update, copy `node_modules/js-yaml/dist/js-yaml.min.js`
and `node_modules/js-yaml/LICENSE` into this directory, run `npm test`, and check
both browser entry points. Serving this file locally removes the runtime CDN dependency.
