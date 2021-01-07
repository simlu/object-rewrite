const get = require('lodash.get');
const { expect } = require('chai');
const rewriter = require('../../src/module/rewriter');
const { injectPlugin, filterPlugin, sortPlugin } = require('../../src/module/plugin');

describe('Testing rewriter', () => {
  it('Testing inject', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['idPlus'];
    const plugin = injectPlugin({
      target: 'idPlus',
      requires: ['id'],
      schema: (r) => Number.isInteger(r),
      fn: ({ value }) => value.id + 1
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['id']);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ idPlus: 3 }, { idPlus: 2 }]);
  });

  it('Testing inject object', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['id', 'meta.id'];
    const plugin = injectPlugin({
      target: 'meta',
      schema: [{
        id: (r) => Number.isInteger(r)
      }],
      requires: ['id'],
      fn: ({ value }) => [{ id: value.id + 1 }]
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['id']);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ id: 2, meta: [{ id: 3 }] }, { id: 1, meta: [{ id: 2 }] }]);
  });

  it('Testing inject deep merge', () => {
    [
      { name: (r) => typeof r === 'string', desc: (r) => typeof r === 'string' },
      (r) => r instanceof Object && !Array.isArray(r)
    ].forEach((schema) => {
      const dataStoreFields = ['name', 'desc', 'property.name', 'property.desc'];
      const data = [{ name: 'name-en', desc: 'desc-en', property: { name: 'name-en', desc: 'desc-en' } }];
      const fields = ['name', 'desc', 'property.name', 'property.desc'];
      const plugin = injectPlugin({
        target: '*',
        schema,
        requires: ['name', 'desc'],
        fn: () => ({ name: 'name-fr', desc: 'desc-fr' })
      });
      const rew = rewriter({
        '': [plugin],
        property: [plugin]
      }, dataStoreFields).init(fields);
      expect(rew.fieldsToRequest).to.deep.equal(['name', 'desc', 'property.name', 'property.desc']);
      rew.rewrite(data);
      expect(data).to.deep.equal([{
        name: 'name-fr',
        desc: 'desc-fr',
        property: { name: 'name-fr', desc: 'desc-fr' }
      }]);
    });
  });

  it('Testing inject with **', () => {
    const dataStoreFields = ['**.id'];
    const data = {
      data: [
        { id: 2, c: [{ id: 3 }, { id: 4 }] },
        { id: 1, c: [{ id: 5 }, { id: 6 }] }
      ]
    };
    const fields = ['**.id'];
    const plugin = injectPlugin({
      target: 'id',
      requires: ['id'],
      schema: (r) => Number.isInteger(r),
      fn: ({ value }) => (value.id ? value.id + 1 : 0)
    });
    const rew = rewriter({
      '**': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal({
      data: [
        { id: 3, c: [{ id: 4 }, { id: 5 }] },
        { id: 2, c: [{ id: 6 }, { id: 7 }] }
      ]
    });
  });

  it('Testing inject with context', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['idPlus'];
    const plugin = injectPlugin({
      target: 'idPlus',
      requires: ['id'],
      schema: (r) => Number.isInteger(r),
      fn: ({ value, context }) => value.id + context.inc
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['id']);
    rew.rewrite(data, { inc: 2 });
    expect(data).to.deep.equal([{ idPlus: 4 }, { idPlus: 3 }]);
  });

  it('Testing filter array element', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['id'];
    const plugin = filterPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => value.id === 1
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ id: 1 }]);
  });

  it('Testing filter object key', () => {
    const dataStoreFields = ['obj.id'];
    const data = [{ obj: { id: 2 } }, { obj: { id: 1 } }];
    const fields = ['obj.id'];
    const plugin = filterPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => value.id === 1
    });
    const rew = rewriter({
      obj: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{}, { obj: { id: 1 } }]);
  });

  it('Testing sort', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['id'];
    const plugin = sortPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => value.id
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ id: 1 }, { id: 2 }]);
  });

  it('Testing sort list primitive', () => {
    const dataStoreFields = ['numbers'];
    const data = [{ numbers: [2, 1] }];
    const fields = ['numbers'];
    const plugin = sortPlugin({
      target: '*',
      requires: [],
      fn: ({ value }) => value
    });
    const rew = rewriter({
      numbers: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ numbers: [1, 2] }]);
  });

  it('Testing filter list primitive', () => {
    const dataStoreFields = ['numbers'];
    const data = [{ numbers: [2, 1] }];
    const fields = ['numbers'];
    const plugin = filterPlugin({
      target: '*',
      requires: [],
      fn: ({ value }) => value === 2
    });
    const rew = rewriter({
      numbers: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ numbers: [2] }]);
  });

  it('Testing filter non-list primitive', () => {
    const dataStoreFields = ['numbers'];
    const data = [{ numbers: 2 }];
    const fields = ['numbers'];
    const plugin = filterPlugin({
      target: '*',
      requires: [],
      fn: ({ value }) => value === 1
    });
    const rew = rewriter({
      numbers: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{}]);
  });

  it('Testing multiple sort plugins', () => {
    const dataStoreFields = ['idA', 'idB'];
    const data = [
      { idA: 2, idB: 4 },
      { idA: 2, idB: 3 },
      { idA: 1, idB: 2 },
      { idA: 1, idB: 1 }
    ];
    const fields = ['idA', 'idB'];
    const plugin1 = sortPlugin({
      target: '*',
      requires: ['idA'],
      fn: ({ value }) => value.idA
    });
    const plugin2 = sortPlugin({
      target: '*',
      requires: ['idB'],
      fn: ({ value }) => value.idB
    });
    const rew = rewriter({
      '': [plugin1, plugin2]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([
      { idA: 1, idB: 1 },
      { idA: 1, idB: 2 },
      { idA: 2, idB: 3 },
      { idA: 2, idB: 4 }
    ]);
  });

  it('Testing inject + filter + sort', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 0 }, { id: 1 }, { id: 2 }];
    const fields = ['id'];
    const plugin1 = injectPlugin({
      target: 'idNeg',
      requires: ['id'],
      schema: (r) => Number.isInteger(r),
      fn: ({ value }) => -value.id
    });
    const plugin2 = filterPlugin({
      target: '*',
      requires: ['idNeg'],
      fn: ({ value }) => [-2, -1].includes(value.idNeg)
    });
    const plugin3 = sortPlugin({
      target: '*',
      requires: ['idNeg'],
      fn: ({ value }) => value.idNeg
    });
    const rew = rewriter({
      '': [plugin1, plugin2, plugin3]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ id: 2 }, { id: 1 }]);
  });

  it('Testing inject is bottom up', () => {
    const dataStoreFields = ['id', 'c.id'];
    const data = [
      { id: 2, c: [{ id: 3 }, { id: 4 }] },
      { id: 1, c: [{ id: 5 }, { id: 6 }] }
    ];
    const fields = ['idSum', 'c.idSum'];
    const plugin = injectPlugin({
      target: 'idSum',
      schema: (r) => Number.isInteger(r),
      requires: ['id'],
      fn: ({ value }) => value.id + (value.c || []).reduce((p, c) => p + c.id, 0)
    });
    const rew = rewriter({
      '': [plugin],
      c: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['id', 'c.id']);
    rew.rewrite(data);
    expect(data).to.deep.equal([
      { idSum: 9, c: [{ idSum: 3 }, { idSum: 4 }] },
      { idSum: 12, c: [{ idSum: 5 }, { idSum: 6 }] }
    ]);
  });

  it('Testing filter is bottom up', () => {
    const dataStoreFields = ['id', 'c.id'];
    const data = [
      { id: 2, c: [{ id: 3 }, { id: 4 }] },
      { id: 1, c: [{ id: 5 }, { id: 6 }] }
    ];
    const fields = ['id', 'c.id'];
    const plugin = filterPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => (value.c || []).length !== 0 || value.id === 6
    });
    const rew = rewriter({
      '': [plugin],
      c: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ id: 1, c: [{ id: 6 }] }]);
  });

  it('Testing sort is bottom up', () => {
    const dataStoreFields = ['id', 'c.id'];
    const data = [
      { id: 1, c: [{ id: 4 }, { id: 5 }] },
      { id: 2, c: [{ id: 6 }, { id: 3 }] }
    ];
    const fields = ['id', 'c.id'];
    const plugin = sortPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => get(value, 'c[0].id', value.id)
    });
    const rew = rewriter({
      '': [plugin],
      c: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([
      { id: 2, c: [{ id: 3 }, { id: 6 }] },
      { id: 1, c: [{ id: 4 }, { id: 5 }] }
    ]);
  });

  it('Testing sort duplicate element', () => {
    const dataStoreFields = ['id', 'c.id'];
    const eA = { id: 5 };
    const data = [
      eA,
      { id: 1, c: [{ id: 4 }, eA] },
      { id: 2, c: [{ id: 6 }, { id: 3 }] }
    ];
    const fields = ['id', 'c.id'];
    const plugin = sortPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => get(value, 'c[0].id', value.id)
    });
    const rew = rewriter({
      '': [plugin],
      c: [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data);
    expect(data).to.deep.equal([
      { id: 2, c: [{ id: 3 }, { id: 6 }] },
      { id: 1, c: [{ id: 4 }, eA] },
      eA
    ]);
  });

  it('Testing sort and limit', () => {
    const dataStoreFields = ['id'];
    const data = [
      { id: 3 },
      { id: 1 },
      { id: 2 }
    ];
    const fields = ['id'];
    const plugin = sortPlugin({
      target: '*',
      requires: ['id'],
      fn: ({ value }) => value.id,
      limit: ({ context }) => context.limit
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(fields);
    rew.rewrite(data, { limit: 2 });
    expect(data).to.deep.equal([{ id: 1 }, { id: 2 }]);
  });

  it('Testing inject can overwrite existing field', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['id'];
    const plugin = injectPlugin({
      target: 'id',
      schema: (r) => Number.isInteger(r),
      requires: ['id'],
      fn: ({ value }) => value.id + 1
    });
    const rew = rewriter({
      '': [plugin]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['id']);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ id: 3 }, { id: 2 }]);
  });

  it('Testing inject can overwrite existing dynamic field', () => {
    const dataStoreFields = ['id'];
    const data = [{ id: 2 }, { id: 1 }];
    const fields = ['idPlus'];
    const plugin1 = injectPlugin({
      target: 'idPlus',
      schema: (r) => Number.isInteger(r),
      requires: ['id'],
      fn: ({ value }) => value.id + 1
    });
    const plugin2 = injectPlugin({
      target: 'idPlus',
      schema: (r) => Number.isInteger(r),
      requires: ['idPlus'],
      fn: ({ value }) => value.idPlus + 1
    });
    const rew = rewriter({
      '': [plugin1, plugin2]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['id']);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ idPlus: 4 }, { idPlus: 3 }]);
  });

  it('Testing dependent injects', () => {
    const dataStoreFields = ['a'];
    const data = [{ a: 2 }, { a: 1 }];
    const fields = ['c'];
    const p1 = injectPlugin({
      target: 'b',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      fn: ({ value }) => value.a + 1
    });
    const p2 = injectPlugin({
      target: 'c',
      schema: (r) => Number.isInteger(r),
      requires: ['b'],
      fn: ({ value }) => value.b + 1
    });
    const rew = rewriter({
      '': [p1, p2]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['a']);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ c: 4 }, { c: 3 }]);
  });

  it('Testing async inject', async () => {
    const dataStoreFields = ['a'];
    const data = [{ a: 2 }, { a: 1 }];
    const fields = ['b'];
    const p1 = injectPlugin({
      target: 'b',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      fn: async ({ value }) => value.a + 1
    });
    const rew = rewriter({
      '': [p1]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['a']);
    await rew.rewriteAsync(data);
    expect(data).to.deep.equal([{ b: 3 }, { b: 2 }]);
  });

  it('Testing nested inject', async () => {
    const dataStoreFields = ['a'];
    const data = [{ a: 2 }, { a: 1 }];
    const fields = ['settings.a', 'settings.b'];
    const p1 = injectPlugin({
      target: 'settings.a',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      fn: ({ value }) => value.a
    });
    const p2 = injectPlugin({
      target: 'settings.b',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      fn: ({ value }) => value.a + 1
    });
    const rew = rewriter({
      '': [p1, p2]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['a']);
    rew.rewrite(data);
    expect(data).to.deep.equal([{ settings: { a: 2, b: 3 } }, { settings: { a: 1, b: 2 } }]);
  });

  it('Testing init', async () => {
    const dataStoreFields = ['a'];
    const data = [{ a: 2 }, { a: 1 }];
    const fields = ['a'];
    const logs = [];
    const mkPlugin = () => injectPlugin({
      target: 'a',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      contextSchema: {
        enabled: (e) => typeof e === 'boolean'
      },
      init: ({ context, cache }) => {
        logs.push('init');
        logs.push(`context = ${context.a}`);
        context.a = (context.a || 0) + 3;
        logs.push(`cache = ${cache.a}`);
        // eslint-disable-next-line no-param-reassign
        cache.a = (cache.a || 0) + 5;
        return context.enabled;
      },
      fn: ({ value, context, cache }) => {
        logs.push(`value = ${value.a}`);
        logs.push(`context = ${context.a}`);
        logs.push(`cache = ${cache.a}`);
        return value.a + context.a + cache.a;
      }
    });
    const p1 = mkPlugin();
    const p2 = mkPlugin();
    const rew = rewriter({
      '': [p1, p2]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['a']);

    rew.rewrite(data, { enabled: false });
    expect(logs).to.deep.equal([
      'init', 'context = undefined', 'cache = undefined',
      'init', 'context = undefined', 'cache = undefined'
    ]);
    expect(data).to.deep.equal([{ a: 2 }, { a: 1 }]);

    logs.length = 0;
    rew.rewrite(data, { enabled: true });
    expect(logs).to.deep.equal([
      'init', 'context = undefined', 'cache = undefined',
      'init', 'context = undefined', 'cache = undefined',
      'value = 1', 'context = 3', 'cache = 5',
      'value = 9', 'context = 3', 'cache = 5',
      'value = 2', 'context = 3', 'cache = 5',
      'value = 10', 'context = 3', 'cache = 5'
    ]);
    expect(data).to.deep.equal([{ a: 18 }, { a: 17 }]);
  });

  it('Testing init executes once per plugin', async () => {
    const dataStoreFields = ['a', 'b.a'];
    const data = [{ a: 2, b: { a: 3 } }, { a: 1, b: { a: 4 } }];
    const fields = ['a', 'b.a'];
    const logs = [];
    const p1 = injectPlugin({
      target: 'a',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      init: () => {
        logs.push('init');
        return true;
      },
      fn: ({ value }) => value.a + 1
    });
    const rew = rewriter({
      '': [p1, p1],
      b: [p1]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['a', 'b.a']);

    rew.rewrite(data);
    expect(logs).to.deep.equal(['init']);
    expect(data).to.deep.equal([{ a: 4, b: { a: 4 } }, { a: 3, b: { a: 5 } }]);
  });

  it('Testing disabled', async () => {
    const dataStoreFields = ['a'];
    const data = [{ a: 2 }, { a: 1 }];
    const fields = ['a'];
    const p1 = injectPlugin({
      target: 'a',
      schema: (r) => Number.isInteger(r),
      requires: ['a'],
      init: () => false,
      fn: () => {}
    });
    const p2 = filterPlugin({
      target: 'a',
      requires: ['a'],
      init: () => false,
      fn: () => false
    });
    const p3 = sortPlugin({
      target: 'a',
      requires: ['a'],
      init: () => false,
      fn: () => []
    });
    expect(p1('').fn()).to.deep.equal(undefined);
    expect(p1('').schema(1)).to.deep.equal(true);
    expect(p2('').fn()).to.deep.equal(false);
    expect(p3('').fn()).to.deep.equal([]);
    const rew = rewriter({
      '': [p1, p2, p3]
    }, dataStoreFields).init(fields);
    expect(rew.fieldsToRequest).to.deep.equal(['a']);

    rew.rewrite(data);
    expect(data).to.deep.equal([{ a: 2 }, { a: 1 }]);
  });

  it('Testing Bad Field Requested', () => {
    expect(() => rewriter({}, []).init(['id'])).to.throw('Bad Field Requested: id');
    const p1 = filterPlugin({
      target: '*',
      requires: ['id'],
      fn: () => true
    });
    expect(p1('').fn()).to.equal(true);
    expect(() => rewriter({
      '': [p1]
    }, ['a']).init(['a'])).to.throw('Bad Field Requested: id');
  });

  it('Testing Bad Context', () => {
    const log = [];
    const logger = { warn: (arg) => log.push(arg) };
    const p1 = filterPlugin({
      target: '*',
      requires: [],
      contextSchema: {
        enabled: (e) => typeof e === 'boolean'
      },
      fn: () => false
    });
    expect(p1('').fn()).to.equal(false);
    const data = [{ a: 1 }];
    rewriter({ '': [p1] }, ['a'], logger)
      .init(['a'])
      .rewrite(data, {});
    expect(log).to.deep.equal([
      'Context validation failure\n'
      + '{"origin":"object-rewrite","options":{"target":"*","requires":[],"contextSchema":{}}}'
    ]);
    expect(data).to.deep.equal([{ a: 1 }]);
  });
});