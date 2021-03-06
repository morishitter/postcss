var fs  = require('fs');
var css = fs.readFileSync(__dirname + '/cache/bootstrap.css').toString();

var CSSOM      = require('cssom');
var rework     = require('rework');
var mensch     = require('mensch');
var postcss    = require('../build');
var stylecow   = require('stylecow');
var gonzales   = require('gonzales');
var gonzalesPe = require('gonzales-pe');

module.exports = {
    name:   'Bootstrap',
    maxTime: 15,
    tests: [
        {
            name: 'Rework',
            fn: function () {
                return rework(css).toString();
            }
        },
        {
            name: 'PostCSS',
            fn: function () {
                return postcss.parse(css).toResult().css;
            }
        },
        {
            name: 'CSSOM',
            fn: function () {
                return CSSOM.parse(css).toString();
            }
        },
        {
            name: "Mensch",
            fn: function () {
                return mensch.stringify( mensch.parse(css) );
            }
        },
        {
            name: 'Gonzales',
            fn: function () {
                return gonzales.csspToSrc( gonzales.srcToCSSP(css) );
            }
        },
        {
            name: 'Gonzales PE',
            fn: function () {
                return gonzalesPe.astToSrc({
                    ast: gonzalesPe.srcToAST({ src: css })
                });
            }
        },
        {
            name: 'Stylecow',
            fn: function () {
                return stylecow.create(css).toString();
            }
        }
    ]
};
