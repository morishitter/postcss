var CssSyntaxError = require('../lib/css-syntax-error');
var postcss        = require('../lib/postcss');
var Result         = require('../lib/result');
var Root           = require('../lib/root');

var expect = require('chai').expect;
var path   = require('path');

describe('postcss()', () => {

    it('creates processors list', () => {
        expect(postcss().processors).to.eql([]);
    });

    it('saves processors list', () => {
        var a = () => 1;
        var b = () => 2;
        expect(postcss(a, b).processors).to.eql([a, b]);
    });

    it('saves processors list as array', () => {
        var a = () => 1;
        var b = () => 2;
        expect(postcss([a, b]).processors).to.eql([a, b]);
    });

    it('saves processors object list', () => {
        var a = () => 1;
        expect(postcss({ postcss: a }).processors).to.eql([a]);
    });

    describe('use()', () => {

        it('adds new processors', () => {
            var a = () => 1;
            var processor = postcss();
            processor.use(a);
            expect(processor.processors).to.eql([a]);
        });

        it('adds new processor by object', () => {
            var a = () => 1;
            var processor = postcss();
            processor.use({ postcss: a });
            expect(processor.processors).to.eql([a]);
        });

        it('adds new processor by object-function', () => {
            var a   = () => 1;
            var obj = () => 2;
            obj.postcss = a;
            var processor = postcss();
            processor.use(obj);
            expect(processor.processors).to.eql([a]);
        });

        it('adds new processors of another postcss instance', () => {
            var a = () => 1;
            var processor = postcss();
            var otherProcessor = postcss(a);
            processor.use(otherProcessor);
            expect(processor.processors).to.eql([a]);
        });

        it('returns itself', () => {
            var a = () => 1;
            var b = () => 2;
            expect(postcss().use(a).use(b).processors).to.eql([a, b]);
        });

    });

    describe('process()', () => {
        before( () => {
            this.processor = postcss( (css) => {
                css.eachRule( (rule) => {
                    if ( !rule.selector.match(/::(before|after)/) ) return;
                    if ( !rule.some( i => i.prop == 'content' ) ) {
                        rule.prepend({ prop: 'content', value: '""' });
                    }
                });
            });
        });

        it('processes CSS', () => {
            var result = this.processor.process('a::before{top:0}');
            expect(result.css).to.eql('a::before{content:"";top:0}');
        });

        it('processes parsed AST', () => {
            var root   = postcss.parse('a::before{top:0}');
            var result = this.processor.process(root);
            expect(result.css).to.eql('a::before{content:"";top:0}');
        });

        it('processes previous result', () => {
            var result = postcss().process('a::before{top:0}');
            result = this.processor.process(result);
            expect(result.css).to.eql('a::before{content:"";top:0}');
        });

        it('takes maps from previous result', () => {
            var one = postcss().process('a{}', {
                from: 'a.css',
                to:   'b.css',
                map: { inline: false }
            });
            var two = postcss().process(one, {
                to:   'c.css',
                map: { inline: false }
            });
            expect(two.map.toJSON().sources).to.eql(['a.css']);
        });

        it('throws with file name', () => {
            var error;
            try {
                postcss().process('a {', { from: 'a.css' });
            } catch (e) {
                if ( e instanceof CssSyntaxError ) {
                    error = e;
                } else {
                    throw e;
                }
            }

            expect(error.file).to.eql(path.resolve('a.css'));
            expect(error.message).to.match(/a.css:1:1: Unclosed block$/);
        });

        it('allows to replace Root', () => {
            var processor = postcss( () => new Root() );
            expect(processor.process('a {}').css).to.eql('');
        });

        it('returns Result object', () => {
            var result = postcss().process('a{}');
            expect(result).to.be.an.instanceOf(Result);
            expect(result.css).to.eql(       'a{}');
            expect(result.toString()).to.eql('a{}');
        });

        it('calls all processors', () => {
            var calls = '';
            var a = () => calls += 'a';
            var b = () => calls += 'b';

            postcss(a, b).process('');
            expect(calls).to.eql('ab');
        });

        it('parses, convert and stringify CSS', () => {
            var a = (css) => expect(css).to.be.an.instanceof(Root);
            expect(postcss(a).process('a {}').css).to.be.a('string');
        });

        it('send options to processors', () => {
            var a = (css, opts) => expect(opts).to.eql({ from: 'a.css' });
            postcss(a).process('a {}', { from: 'a.css' });
        });

        it('accepts source map from PostCSS', () => {
            var one = postcss().process('a{}', {
                from: 'a.css',
                to:   'b.css',
                map:   { inline: false }
            });
            var two = postcss().process(one.css, {
                from: 'b.css',
                to:   'c.css',
                map: { prev: one.map, inline: false }
            });
            expect(two.map.toJSON().sources).to.eql(['a.css']);
        });

    });

    describe('.root()', () => {

        it('allows to build own CSS', () => {
            var root = postcss.root();
            var rule = postcss.rule({ selector: 'a' });
            rule.append( postcss.decl({ prop: 'color', value: 'black' }) );
            root.append( rule );

            expect(root.toString()).to.eql("a {\n    color: black\n}");
        });

    });

});
