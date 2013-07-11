var md = angular.module('drawmap', []);
md.factory('$drawer', function () {
    var appliedIeNamespace = false;
    var hasCanvas = !! document.createElement('canvas').getContext;
    var defaultOptions = {
        fill: true,
        fillColor: '000000',
        fillOpacity: 0.2,
        stroke: true,
        strokeColor: 'ff0000',
        strokeOpacity: 1,
        strokeWidth: 1
    };

    function hexToDecimal(hex) {
        return Math.max(0, Math.min(parseInt(hex, 16), 255));
    }

    function css3color(color, opacity) {
        var o = 'rgba(';
        o += hexToDecimal(color.substr(0, 2)) + ',';
        o += hexToDecimal(color.substr(2, 2)) + ',';
        o += hexToDecimal(color.substr(4, 2)) + ',';
        return o + opacity + ')';
    }

    function applyIeNamespace() {
        if (appliedIeNamespace || hasCanvas) return;
        appliedIeNamespace = true;
        angular.element(document).ready(function () {
            var style = document.createStyleSheet();
            var shapes = [];
            document.namespaces.add('v', 'urn:schemas-microsoft-com:vml');
            shapes.push('shape', 'rect', 'oval', 'circ', 'fill');
            shapes.push('stroke', 'imagedata', 'group', 'textbox');
            angular.forEach(shapes, function (value) {
                style.addRule('v\\:' + value, 'behavior: url(#default#VML); antialias:true');
            });
        });
    }

    return {
        draw: function (element, shape, coords, options) {
            options = angular.extend({}, defaultOptions, options);
            if (hasCanvas) {
                var context = element.getContext('2d');
                context.beginPath();
                if (shape == 'rect') {
                    context.rect(coords[0], coords[1], coords[2] - coords[0], coords[3] - coords[1]);
                } else if (shape == 'poly') {
                    context.moveTo(coords[0], coords[1]);
                    for (var i = 2; i < coords.length; i += 2) {
                        context.lineTo(coords[i], coords[i + 1]);
                    }
                } else if (shape == 'circ') {
                    context.arc(coords[0], coords[1], coords[2], 0, Math.PI * 2, false);
                }
                context.closePath();
                if (options.fill) {
                    context.fillStyle = css3color(options.fillColor, options.fillOpacity);
                    context.fill();
                }
                if (options.stroke) {
                    context.strokeStyle = css3color(options.strokeColor, options.strokeOpacity);
                    context.lineWidth = options.strokeWidth;
                    context.stroke();
                }
            } else {
                var fillColor = 'color="#'+options.fillColor+'"';
                var fillOpacity = 'opacity="'+(options.fill ? options.fillOpacity : 0)+'"';
                var fill = '<v:fill'+fillColor+' '+fillOpacity+' />';
                
                var strokeWidth = 'strokeweight="'+options.strokeWidth+'"';
                var strokeColor = 'strokecolor="#'+options.strokeColor+'"';
                var stroke = strokeWidth + ' stroked="t" ' + strokeColor;
                if(!options.stroke)stroke = 'stroked="f"';
                
                var opacity = '<v:stroke opacity="'+options.strokeOpacity+'"/>';
                
                var tag = (shape === 'rect' ? 'rect' : (shape === 'poly' ? 'shape' : 'oval'));
                
                var x,y,width,height;
                var result = '<v:'+tag+' filled="t" ';
                result += stroke + ' ';
                if (shape == 'rect') {
                    x = coords[0];
                    y = coords[1];
                    width = coords[2] - coords[0];
                    height = coords[3] - coords[1];
                } else if (shape == 'poly') {
                    x = 0;
                    y = 0;
                    width = element.width;
                    height = element.height;
                } else if (shape == 'circ') {
                    x = coords[0] - coords[2];
                    y = coords[1] - coords[2];
                    width = (coords[2]*2);
                    height = (coords[2]*2);                    
                }
                result += 'style="zoom:1;margin:0;padding:0;';
                result += 'display:block;position:absolute;';
                result += 'left:'+x+'px;top:'+y+'px;';
                result += 'width:'+width+'px;';
                result += 'height:'+height+'px;">';
                result += fill+opacity;
                result += '</v:'+tag+'>';
                element.innerHtml += result;
            }
        },
        clear: function (element) {
            if (hasCanvas) {
                element.getContext('2d').clearRect(0, 0, element.width, element.height);
            } else {
                element.innerHtml = '';
            }
        },
        create: function (width, height) {
            var style = "",
                element;
            applyIeNamespace();
            if (hasCanvas) {
                element = document.createElement('canvas');
                element.getContext("2d").clearRect(0, 0, width, height);
                style += 'width:' + width + 'px;';
                style += 'height:' + height + 'px;';
            } else {
                element = document.createElement('var');
                style += 'overflow:hidden;display:block;';
                style += 'width:' + width + 'px;';
                style += 'height:' + height + 'px;';
                style += 'zoom:1;';
            }
            style += 'position:absolute;';
            style += 'left:0;';
            style += 'top:0;';
            style += 'padding:0;';
            style += 'border:0;';
            element.setAttribute('style', style);
            element.width = width;
            element.height = height;
            return element;
        }
    };

}).directive('drawn', ['$drawer', function (drawer) {

    function getImgWithUsemapAttr(id, name) {
        var i, usemap, images = document.getElementsByTagName('img');
        for (i = 0; i < images.length; i++) {
            usemap = images[i].getAttribute('usemap');
            if (usemap) {
                if (usemap === '#' + name) return images[i];
                if (usemap === '#' + id) return images[i];
            }
        }
    }

    function isImgLoaded(img) {
        if (!img.complete) return false; // IE only
        if (typeof img.naturalWidth === 'undefined') return true;
        if (img.naturalWidth !== 0) return true;
        return false;
    };

    return {
        restrict: 'A',
        scope: {},
        link: function postLink(scope, element, attributes) {
            var addListener = true;
            angular.forEach(attributes, function (value, key) {
                if (key.length >= 7 && key.substring(0, 7) == 'ngMouse') {
                    addListener = false;
                }
            });

            var canvas;
            function init() {
                var img = getImgWithUsemapAttr(attributes.id, attributes.name);
                canvas = drawer.create(img.width, img.height);
                var wraper = document.createElement('div');
                var style = 'position: relative; background: url("' + img.src + '") no-repeat;';
                wraper.setAttribute('style', style);
                img = angular.element(img);
                wraper = angular.element(wraper);
                img.wrap(wraper);
                wraper.prepend(canvas);
                wraper.append(element);
                img.css('opacity', '0');
                img.css('filter', 'Alpha(opacity=0)');
            }

            function draw(area) {
                if(!area.getAttribute)return;
                var coords = area.getAttribute('coords').split(',');
                for (var i in coords) { coords[i] = parseInt(coords[i], 10); }
                drawer.draw(canvas, area.getAttribute('shape'), coords);
            }
            
            scope.visible = {};
            scope.clear = function(){
                drawer.clear(canvas);
                scope.visible = {};
            };
            scope.draw = function(area){
                //TODO treat event
                scope.visible.push(area);
                draw(area);
            };
            scope.hide = function(area){
                var p = scope.visible.indexOf(area);
                scope.visible.splice(p,1);
                drawer.clear(canvas);
                angular.forEach(scope.visible, function (value) {
                    draw(value);  
                });
            };
            scope.hover = function(area, only){
                if(!area || only)drawer.clear(canvas);
                
                if(!area){
                    angular.forEach(scope.visible, function (value) {
                        draw(value);  
                    });
                }else{
                    draw(area);   
                }
            };

            angular.element(document).ready(function onready() {
                init();
                if(addListener)
                angular.forEach(element[0].childNodes, function (value) {
                    var avalue = angular.element(value);
                    avalue.bind('mouseenter', function(){
                        scope.hover(value,false);
                    });
                    avalue.bind('mouseleave', function(){
                        scope.hover(null,false);
                    });
                });
            });
        }
    };
}]);
