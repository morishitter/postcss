var PreviousMap = require('../lib/previous-map');
var postcss     = require('../lib/postcss');

var mozilla = require('source-map');
var expect  = require('chai').expect;
var path    = require('path');
var fs      = require('fs-extra');

var consumer = map => new mozilla.SourceMapConsumer.fromSourceMap(map);

var read = function (result) {
    var prev = new PreviousMap(result.css, { });
    return prev.consumer();
};

describe('source maps', () => {
    before( () => {
        this.dir = __dirname + '/fixtures';

        this.doubler = postcss( (css) => {
            css.eachDecl( decl => decl.parent.prepend(decl.clone()) );
        });
        this.lighter = postcss( (css) => {
            css.eachDecl( decl => decl.value = 'white' );
        });
    });

    afterEach( () => {
        if ( fs.existsSync(this.dir) ) fs.removeSync(this.dir);
    });

    it('adds map field only on request', () => {
        expect(postcss().process('a {}').map).to.not.exist();
    });

    it('return map generator', () => {
        var map = postcss().process('a {}', { map: { inline: false } }).map;
        expect(map).to.be.instanceOf(mozilla.SourceMapGenerator);
    });

    it('generate right source map', () => {
        var css       = "a {\n  color: black;\n  }";
        var processor = postcss( (css) => {
            css.eachRule( (rule) => {
                rule.selector = 'strong';
            });
            css.eachDecl( (decl) => {
                decl.parent.prepend( decl.clone({ prop: 'background' }) );
            });
        });

        var result = processor.process(css, {
            from: 'a.css',
            to:   'b.css',
            map:  true
        });
        var map = read(result);

        expect(map.file).to.eql('b.css');

        expect(map.originalPositionFor({ line: 1, column: 0 })).to.eql({
            source: 'a.css',
            line:   1,
            column: 0,
            name:   null
        });
        expect(map.originalPositionFor({ line: 2, column: 2 })).to.eql({
            source: 'a.css',
            line:   2,
            column: 2,
            name:   null
        });
        expect(map.originalPositionFor({ line: 3, column: 2 })).to.eql({
            source: 'a.css',
            line:   2,
            column: 2,
            name:   null
        });
    });

    it('changes previous source map', () => {
        var css = 'a { color: black }';

        var doubled = this.doubler.process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { inline: false }
        });

        var lighted = this.lighter.process(doubled.css, {
            from: 'b.css',
            to:   'c.css',
            map: { prev: doubled.map }
        });

        var map = consumer(lighted.map);
        expect(map.originalPositionFor({ line: 1, column: 18 })).to.eql({
            source: 'a.css',
            line:   1,
            column: 4,
            name:   null
        });
    });

    it('adds source map annotation', () => {
        var css    = 'a { }/*# sourceMappingURL=a.css.map */';
        var result = postcss().process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { inline: false }
        });

        expect(result.css).to.eql("a { }\n/*# sourceMappingURL=b.css.map */");
    });

    it('misses source map annotation, if user ask', () => {
        var css    = 'a { }';
        var result = postcss().process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { annotation: false }
        });

        expect(result.css).to.eql(css);
    });

    it('misses source map annotation, if previous map missed it', () => {
        var css = 'a { }';

        var step1 = postcss().process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { annotation: false }
        });

        var step2 = postcss().process(step1.css, {
            from: 'b.css',
            to:   'c.css',
            map: { prev: step1.map }
        });

        expect(step2.css).to.eql(css);
    });

    it('uses user path in annotation, relative to options.to', () => {
        var result = postcss().process('a { }', {
            from: 'source/a.css',
            to:   'build/b.css',
            map: { annotation: 'maps/b.map' }
        });

        expect(result.css).to.eql("a { }\n/*# sourceMappingURL=maps/b.map */");
        var map = consumer(result.map);

        expect(map.file).to.eql('../b.css');
        expect(map.originalPositionFor({ line: 1, column: 0 }).source)
            .to.eql('../../source/a.css');
    });

    it('generates inline map', () => {
        var css = 'a { }';

        var inline = postcss().process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { inline: true }
        });

        expect(inline.map).to.not.exist();
        expect(inline.css).to.match(/# sourceMappingURL=data:/);

        var separated = postcss().process(css, {
          from: 'a.css',
          to:   'b.css',
          map: { inline: false }
        });

        var base64 = new Buffer(separated.map).toString('base64');
        expect(inline.css.endsWith(base64 + ' */')).to.be.true;
    });

    it('generates inline map by default', () => {
        var inline = postcss().process('a { }', {
            from: 'a.css',
            to:   'b.css',
            map:   true
        });

        expect(inline.css).to.match(/# sourceMappingURL=data:/);
    });

    it('generates separated map if previous map was not inlined', () => {
        var step1 = this.doubler.process('a { color: black }', {
            from: 'a.css',
            to:   'b.css',
            map: { inline: false }
        });
        var step2 = this.lighter.process(step1.css, {
            from: 'b.css',
            to:   'c.css',
            map: { prev: step1.map }
        });

        expect(step2.map).to.exist();
    });

    it('generates separated map on annotation option', () => {
        var result = postcss().process('a { }', {
            from: 'a.css',
            to:   'b.css',
            map: { annotation: false }
        });

        expect(result.map).to.exist();
    });

    it('allows change map type', () => {
        var step1 = postcss().process('a { }', {
            from: 'a.css',
            to:   'b.css',
            map: { inline: true }
        });

        var step2 = postcss().process(step1.css, {
            from: 'b.css',
            to:   'c.css',
            map: { inline: false }
        });

        expect(step2).to.have.property('map');
        expect(step2.css).to.not.match(/# sourceMappingURL=data:/);
    });

    it('misses check files on requires', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'a.css',
            to:    this.dir + '/a.css',
            map:   true
        });

        fs.outputFileSync(this.dir + '/a.css.map', step1.map);
        var step2 = this.lighter.process(step1.css, {
            from: this.dir + '/a.css',
            to:  'b.css',
            map:  false
        });

        expect(step2.map).to.not.exist();
    });

    it('works in subdirs', () => {
        var result = this.doubler.process('a { }', {
            from: 'from/a.css',
            to:   'out/b.css',
            map: { inline: false }
        });

        expect(result.css).to.match(/sourceMappingURL=b.css.map/);

        var map = consumer(result.map);
        expect(map.file).to.eql('b.css');
        expect(map.sources).to.eql(['../from/a.css']);
    });

    it('uses map from subdir', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'a.css',
            to:   'out/b.css',
            map: { inline: false }
        });

        var step2 = this.doubler.process(step1.css, {
            from: 'out/b.css',
            to:   'out/two/c.css',
            map: { prev: step1.map }
        });

        var source = consumer(step2.map)
            .originalPositionFor({ line: 1, column: 0 }).source;
        expect(source).to.eql('../../a.css');

        var step3 = this.doubler.process(step2.css, {
            from: 'c.css',
            to:   'd.css',
            map: { prev: step2.map }
        });

        source = consumer(step3.map)
            .originalPositionFor({ line: 1, column: 0 }).source;
        expect(source).to.eql('../../a.css');
    });

    it('uses map from subdir if it inlined', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'a.css',
            to:   'out/b.css',
            map:   true
        });

        var step2 = this.doubler.process(step1.css, {
            from: 'out/b.css',
            to:   'out/two/c.css',
            map: { inline: false }
        });

        var source = consumer(step2.map)
            .originalPositionFor({ line: 1, column: 0 }).source;
        expect(source).to.eql('../../a.css');
    });

    it('uses map from subdir if it written as a file', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'source/a.css',
            to:   'one/b.css',
            map: { annotation: 'maps/b.css.map', inline: false }
        });

        var source = consumer(step1.map)
            .originalPositionFor({ line: 1, column: 0 }).source;
        expect(source).to.eql('../../source/a.css');

        fs.outputFileSync(this.dir + '/one/maps/b.css.map', step1.map);

        var step2 = this.doubler.process(step1.css, {
            from: this.dir + '/one/b.css',
            to:   this.dir + '/two/c.css',
            map:  true
        });

        source = consumer(step2.map)
            .originalPositionFor({ line: 1, column: 0 }).source;
        expect(source).to.eql('../source/a.css');
    });

    it('works with different types of maps', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'a.css',
            to:   'b.css',
            map: { inline: false }
        });

        var map  = step1.map;
        var maps = [map, consumer(map), map.toJSON(), map.toString()];

        for ( var i of maps ) {
            var step2 = this.doubler.process(step1.css, {
                from: 'b.css',
                to:   'c.css',
                map: { prev: i }
            });
            var source = consumer(step2.map)
                .originalPositionFor({ line: 1, column: 0 }).source;
            expect(source).to.eql('a.css');
        }
    });

    it('sets source content by default', () => {
        var result = this.doubler.process('a { }', {
            from: 'a.css',
            to:   'out/b.css',
            map:   true
        });

        expect(read(result).sourceContentFor('../a.css')).to.eql('a { }');
    });

    it('misses source content on request', () => {
        var result = this.doubler.process('a { }', {
            from: 'a.css',
            to:   'out/b.css',
            map: { sourcesContent: false }
        });

        expect(read(result).sourceContentFor('../a.css')).to.not.exist();
    });

    it('misses source content if previous not have', () => {
        var step1 = this.doubler.process('a { }', {
          from: 'a.css',
          to:   'out/a.css',
          map: { sourcesContent: false }
        });

        var file1 = postcss.parse(step1.css, {
            from: 'a.css',
            map: { prev: step1.map }
        });
        var file2 = postcss.parse('b { }', { from: 'b.css', map: true });

        file2.append( file1.first.clone() );
        var step2 = file2.toResult({ to: 'c.css', map: true });

        expect(read(step2).sourceContentFor('b.css')).to.not.exist();
    });

    it('misses source content on request', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'a.css',
            to:   'out/a.css',
            map: { sourcesContent: true }
        });

        var file1 = postcss.parse(step1.css, {
            from: 'a.css',
            map: { prev: step1.map }
        });
        var file2 = postcss.parse('b { }', { from: 'b.css', map: true });

        file2.append( file1.first.clone() );
        var step2 = file2.toResult({
            to:   'c.css',
            map: { sourcesContent: false }
        });

        var map = read(step2);
        expect(map.sourceContentFor('b.css')).to.not.exist();
        expect(map.sourceContentFor('../a.css')).to.not.exist();
    });

    it('detects input file name from map', () => {
        var one = this.doubler.process('a { }', { to: 'a.css', map: true });
        var two = this.doubler.process(one.css, { map: { prev: one.map } });
        expect(two.root.first.source.file).to.eql(path.resolve('a.css'));
    });

    it('works without file names', () => {
        var step1 = this.doubler.process('a { }', { map: true });
        var step2 = this.doubler.process(step1.css);
    });

    it('supports UTF-8', () => {
        var step1 = this.doubler.process('a { }', {
            from: 'вход.css',
            to:   'шаг1.css',
            map:   true
        });
        var step2 = this.doubler.process(step1.css, {
            from: 'шаг1.css',
            to:   'выход.css',
        });

        expect(read(step2).file).to.eql('выход.css');
    });

    it('generates map for node created manually', () => {
        var contenter = postcss( (css) => {
            css.first.prepend({ prop: 'content', value: '""' });
        });
        var result = contenter.process('a:after{\n}', { map: true });
        expect(read(result).originalPositionFor({ line: 2, column: 0 }))
            .to.eql({ source: null, line: null, column: null, name: null });
    });

    it('uses input file name as output file name', () => {
        var result = this.doubler.process('a{}', {
            from: 'a.css',
            map: { inline: false }
        });
        expect(result.map.toJSON().file).to.eql('a.css');
    });

    it('uses to.css as default output name', () => {
        var result = this.doubler.process('a{}', { map: { inline: false } });
        expect(result.map.toJSON().file).to.eql('to.css');
    });

    it('supports annotation comment in any place', () => {
        var css    = '/*# sourceMappingURL=a.css.map */a { }';
        var result = postcss().process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { inline: false }
        });

        expect(result.css).to.eql("a { }\n/*# sourceMappingURL=b.css.map */");
    });

    it('does not update annotation on request', () => {
        var css    = 'a { }/*# sourceMappingURL=a.css.map */';
        var result = postcss().process(css, {
            from: 'a.css',
            to:   'b.css',
            map: { annotation: false, inline: false }
        });

        expect(result.css).to.eql("a { }/*# sourceMappingURL=a.css.map */");
    });

});
