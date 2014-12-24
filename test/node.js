var CssSyntaxError = require('../lib/css-syntax-error');
var Declaration    = require('../lib/declaration');
var AtRule         = require('../lib/at-rule');
var parse          = require('../lib/parse');
var Node           = require('../lib/node');
var Root           = require('../lib/root');
var Rule           = require('../lib/rule');

var expect = require('chai').expect;

describe('Node', () => {

    describe('error()', () => {

        it('generates custom error', () => {
            var css   = parse('a{}', { from: '/a.css' });
            var error = css.first.error('Test');
            expect(error).to.be.instanceOf(CssSyntaxError);
            expect(error.message).to.eql('/a.css:1:1: Test');
        });

        it('generates custom error for nodes without source', () => {
            var rule  = new Rule({ selector: 'a' });
            var error = rule.error('Test');
            expect(error.message).to.eql('<css input>: Test');
        });

    });

    describe('removeSelf()', () => {

        it('removes node from parent', () => {
            var rule = new Rule({ selector: 'a' });
            rule.append({ prop: 'color', value: 'black' });

            rule.nodes[0].removeSelf();
            expect(rule.nodes).to.be.empty;
        });

    });

    describe('replace()', () => {

        it('inserts new node', () => {
            var rule = new Rule({ selector: 'a' });
            rule.append({ prop: 'color', value: 'black' });
            rule.append({ prop: 'width', value: '1px' });
            rule.append({ prop: 'height', value: '1px' });

            var node   = new Declaration({ prop: 'min-width', value: '1px' });
            var width  = rule.nodes[1];
            var result = width.replace(node);

            expect(result).to.eql(width);

            expect(rule.toString()).to.eql('a {\n' +
                                       '    color: black;\n' +
                                       '    min-width: 1px;\n' +
                                       '    height: 1px\n' +
                                       '}');
        });

        it('inserts new root', () => {
            var root = new Root();
            root.append( new AtRule({ name: 'import', params: '"a.css"' }) );

            var a = new Root();
            a.append( new Rule({ selector: 'a' }) );
            a.append( new Rule({ selector: 'b' }) );

            root.first.replace(a);
            expect(root.toString()).to.eql('a {}\nb {}');
        });

    });

    describe('clone()', () => {

        it('clones nodes', () => {
            var rule = new Rule({ selector: 'a', after: '' });
            rule.append({ prop: 'color', value: '/**/black', before: '' });

            var clone = rule.clone();
            clone.append({ prop: 'z-index', value: '1' });

            expect(rule.first.parent).to.equal(rule);
            expect(clone.first.parent).to.equal(clone);
            expect(rule.nodes.length).to.equal(1);
        });

        it('overrides properties', () => {
            var rule  = new Rule({ selector: 'a' });
            var clone = rule.clone({ selector: 'b' });
            expect(clone.selector).to.eql('b');
        });

        it('cleans code style', () => {
            var css = parse('@page 1{a{color:black;}}');
            expect(css.clone().toString()).to.eql('@page 1 {\n' +
                                                  '    a {\n' +
                                                  '        color: black\n' +
                                                  '    }\n' +
                                                  '}');
        });

    });

    describe('toJSON()', () => {

        it('cleans parents inside', () => {
            var rule = new Rule({ selector: 'a' });
            rule.append({ prop: 'color', value: 'b' });

            var json = rule.toJSON();
            expect(json.parent).to.not.exist();
            expect(json.nodes[0].parent).to.not.exist();

            expect(JSON.stringify(rule)).to.eql(
                '{"type":"rule","nodes":[' +
                    '{"type":"decl","prop":"color","value":"b"}' +
                '],"selector":"a"}');
        });

    });

    describe('style()', () => {

        it('uses node style', () => {
            var rule = new Rule({ selector: 'a', between: '\n' });
            expect(rule.style('between', 'beforeOpen')).to.eql('\n');
        });

        it('hacks before for nodes without parent', () => {
            var rule = new Rule({ selector: 'a' });
            expect(rule.style('before', 'before')).to.eql('');
        });

        it('hacks before for first node', () => {
            var root = new Root();
            root.append(new Rule({ selector: 'a' }));
            expect(root.first.style('before', 'before')).to.eql('');
        });

        it('hacks before for first decl', () => {
            var decl = new Declaration({ prop: 'color', value: 'black' });
            expect(decl.style('before', 'before')).to.eql('');

            var rule = new Rule({ selector: 'a' });
            rule.append(decl);
            expect(decl.style('before', 'before')).to.eql('\n    ');
        });

        it('uses defaults without parent', () => {
            var rule = new Rule({ selector: 'a' });
            expect(rule.style('between', 'beforeOpen')).to.eql(' ');
        });

        it('uses defaults for unique node', () => {
            var root = new Root();
            root.append(new Rule({ selector: 'a' }));
            expect(root.first.style('between', 'beforeOpen')).to.eql(' ');
        });

        it('clones style from first node', () => {
            var root = new Root();
            root.append( new Rule({ selector: 'a', between: '' }) );
            root.append( new Rule({ selector: 'b' }) );

            expect(root.last.style('between', 'beforeOpen')).to.eql('');
        });

        it('indents by default', () => {
            var root = new Root();
            root.append( new AtRule({ name: 'page' }) );
            root.first.append( new Rule({ selector: 'a' }) );
            root.first.first.append({ prop: 'color', value: 'black' });

            expect(root.toString()).to.eql('@page {\n' +
                                           '    a {\n' +
                                           '        color: black\n' +
                                           '    }\n' +
                                           '}');
        });

        it('clones indent', () => {
            var compress = parse('@page{ a{ } }');
            var spaces   = parse('@page {\n  a {\n  }\n}');

            compress.first.first.append({ prop: 'color', value: 'black' });
            expect(compress.toString()).to.eql('@page{ a{ color: black } }');

            spaces.first.first.append({ prop: 'color', value: 'black' });
            expect(spaces.toString())
                .to.eql('@page {\n  a {\n    color: black\n  }\n}');
        });

        it('clones indent by types', () => {
            var css = parse('a {\n  color: black}\n\nb {\n}');
            css.append(new Rule({ selector: 'em' }));
            css.last.append({ prop: 'z-index', value: '1' });

            expect(css.last.toString()).to.eql('\n\nem {\n  z-index: 1\n}');
        });

        it('clones indent by before and after', () => {
            var css = parse('@page{\n\n a{\n  color: black}}');
            css.first.append(new Rule({ selector: 'b' }));
            css.first.last.append({ prop: 'z-index', value: '1' });

            expect(css.first.last.toString()).to.eql('\n\n b{\n  z-index: 1}');
        });

    });

    describe('stringifyRaw()', () => {
        it('creates trimmed/raw property', () => {
            var b = new Node();

            b.one  = 'trim';
            b._one = { value: 'trim', raw: 'raw' };
            expect(b.stringifyRaw('one')).to.eql('raw');

            b.one = 'trim1';
            expect(b.stringifyRaw('one')).to.eql('trim1');
        });

        it('works without magic', () => {
            var b = new Node();
            b.one = '1';
            expect(b.one).to.eql('1');
            expect(b.stringifyRaw('one')).to.eql('1');
        });

    });

});
