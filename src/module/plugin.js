const assert = require('assert');
const Joi = require('joi-strict');
const validationCompile = require('./plugin/validation-compile');
const validationExtractKeys = require('./plugin/validation-extract-keys');
const joinPath = require('./plugin/join-path');

const plugin = (type, options) => {
  assert(['FILTER', 'INJECT', 'SORT'].includes(type));
  Joi.assert(options, Joi.object({
    target: Joi.string(), // target can not be "", use "*" instead
    requires: Joi.array().items(Joi.string()),
    contextSchema: Joi.alternatives(Joi.object(), Joi.array(), Joi.function()).optional(),
    init: Joi.function().optional(),
    fn: Joi.function(),
    schema: type === 'INJECT' ? Joi.alternatives(Joi.object(), Joi.array(), Joi.function()) : Joi.forbidden(),
    limit: type === 'SORT' ? Joi.function().optional() : Joi.forbidden()
  }));

  const {
    target, requires, contextSchema, init, fn, schema, limit
  } = options;

  let localCache;
  let localContext;
  const wrap = (f) => {
    if (f === undefined) {
      return undefined;
    }
    return (kwargs = {}) => {
      // eslint-disable-next-line no-param-reassign
      kwargs.cache = localCache;
      // eslint-disable-next-line no-param-reassign
      kwargs.context = localContext;
      return f(kwargs);
    };
  };

  const self = (prefix) => {
    const targetAbs = joinPath([prefix, target]);
    const result = {
      self,
      prefix,
      targetNormalized: targetAbs.endsWith('.') ? targetAbs.slice(0, -1) : targetAbs,
      target: targetAbs,
      targets: [targetAbs],
      targetRel: target,
      requires: requires.map((f) => (f.startsWith('/') ? f.slice(1) : joinPath([prefix, f]))),
      type,
      fn: wrap(fn),
      limit: wrap(limit)
    };
    if (type === 'INJECT') {
      result.targetNormalized = prefix;
      result.schema = validationCompile(schema);
      result.targets = validationExtractKeys(targetAbs, schema);
    }
    return result;
  };
  self.init = (context, logger) => {
    if (
      contextSchema !== undefined
      && validationCompile(contextSchema, false)(context) === false
    ) {
      logger.warn(`Context validation failure\n${JSON.stringify({
        origin: 'object-rewrite',
        options
      })}`);
      return false;
    }
    localCache = {};
    localContext = contextSchema instanceof Object && !Array.isArray(contextSchema)
      ? Object.keys(contextSchema).reduce((p, k) => {
        // eslint-disable-next-line no-param-reassign
        p[k] = context[k];
        return p;
      }, {})
      : context;
    return init === undefined ? true : wrap(init)();
  };
  return self;
};

module.exports = {
  filterPlugin: (opts) => plugin('FILTER', opts),
  injectPlugin: (opts) => plugin('INJECT', opts),
  sortPlugin: (opts) => plugin('SORT', opts)
};