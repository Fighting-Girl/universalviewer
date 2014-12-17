/// <reference path="../../js/jquery.d.ts" />

import utils = require("../../utils");
import baseExtension = require("../coreplayer-shared-module/baseExtension");
import extension = require("../../extensions/coreplayer-seadragon-extension/extension");
import shell = require("../coreplayer-shared-module/shell");
import baseView = require("../coreplayer-shared-module/baseView");
import IProvider = require("../coreplayer-shared-module/iProvider");
import ISeadragonProvider = require("../../extensions/coreplayer-seadragon-extension/iSeadragonProvider");
import Thumb = require("../coreplayer-shared-module/thumb");

export class GalleryView extends baseView.BaseView {

    $header: JQuery;
    $sizeUpButton: JQuery;
    $sizeRange: JQuery;
    $main: JQuery;
    $sizeDownButton: JQuery;
    $thumbs: JQuery;
    $selectedThumb: JQuery;
    isOpen: boolean = false;
    lastThumbClickedIndex: number;
    range: number;

    static THUMB_SELECTED: string = 'galleryView.onThumbSelected';

    public thumbs: Thumb[];

    constructor($element: JQuery) {
        super($element, true, true);
    }

    create(): void {

        this.setConfig('treeViewLeftPanel');

        super.create();

        $.subscribe(baseExtension.BaseExtension.CANVAS_INDEX_CHANGED, (e, index) => {
            this.selectIndex(parseInt(index));
        });

        $.subscribe(extension.Extension.SETTINGS_CHANGED, () => {
            this.setLabel();
        });

        this.$header = $('<div class="header"></div>');
        this.$element.append(this.$header);

        this.$sizeDownButton = $('<input class="btn btn-default size-down" type="button" value="-" />');
        this.$header.append(this.$sizeDownButton);

        this.$sizeRange = $('<input type="range" name="size" min="0" max="10" value="5" />');
        this.$header.append(this.$sizeRange);

        this.$sizeUpButton = $('<input class="btn btn-default size-up" type="button" value="+" />');
        this.$header.append(this.$sizeUpButton);

        this.$main = $('<div class="main"></div>');
        this.$element.append(this.$main);

        this.$thumbs = $('<div class="thumbs"></div>');
        this.$main.append(this.$thumbs);

        this.$sizeDownButton.on('click', () => {
            var val = Number(this.$sizeRange.val()) - 1;

            if (val >= Number(this.$sizeRange.attr('min'))){
                this.$sizeRange.val(val.toString());
                this.$sizeRange.trigger('change');
            }
        });

        this.$sizeUpButton.on('click', () => {
            var val = Number(this.$sizeRange.val()) + 1

            if (val <= Number(this.$sizeRange.attr('max'))){
                this.$sizeRange.val(val.toString());
                this.$sizeRange.trigger('change');
            }
        });

        this.$sizeRange.on('change', () => {
            this.updateThumbs();
        });

        $.templates({
            galleryThumbsTemplate: '<div class="{{:~className()}}" data-src="{{>url}}" data-visible="{{>visible}}" data-width="{{>width}}" data-height="{{>height}}">\
                                <div class="wrap"></div>\
                                <span class="index">{{:#index + 1}}</span>\
                                <span class="label">{{>label}}&nbsp;</span>\
                             </div>'
        });

        $.views.helpers({
            isOdd: function(num){
                return (num % 2 == 0) ? false : true;
            },
            className: function(){
                if (this.data.url){
                    return "thumb";
                }

                return "thumb placeholder";
            }
        });

        // use unevent to detect scroll stop.
        this.$main.on('scroll', () => {
            this.updateThumbs();
        }, 1000);

        if (!Modernizr.inputtypes.range){
            this.$sizeRange.hide();
        }

        this.resize();
    }

    public dataBind(): void{
        if (!this.thumbs) return;
        this.createThumbs();
    }

    createThumbs(): void{
        var that = this;

        if (!this.thumbs) return;

        this.$thumbs.link($.templates.galleryThumbsTemplate, this.thumbs);

        this.$thumbs.delegate(".thumb", "click", function (e) {
            e.preventDefault();

            var data = $.view(this).data;

            that.lastThumbClickedIndex = data.index;

            $.publish(GalleryView.THUMB_SELECTED, [data.index]);
        });

        this.selectIndex(this.provider.canvasIndex);

        this.setLabel();

        this.updateThumbs();
    }

    updateThumbs(): void {

        if (!this.thumbs || !this.thumbs.length) return;

        // cache range size
        this.range = utils.Utils.normalise(Number(this.$sizeRange.val()), 0, 10);
        this.range = utils.Utils.clamp(this.range, 0.05, 1);

        // test which thumbs are scrolled into view
        var thumbs = this.$thumbs.find('.thumb');
        var scrollTop = this.$main.scrollTop();
        var scrollHeight = this.$main.height();

        for (var i = 0; i < thumbs.length; i++) {

            var $thumb = $(thumbs[i]);
            var thumbTop = $thumb.position().top;
            var thumbBottom = thumbTop + $thumb.height();

            if (thumbBottom >= scrollTop && thumbTop <= scrollTop + scrollHeight){
                this.loadThumb($thumb);
                //$thumb.find('.wrap').css('background', 'red');
            //} else {
                //$thumb.find('.wrap').css('background', 'none');
            }

            this.sizeThumb($thumb);
        }

        this.equaliseHeights();
    }

    equaliseHeights(): void {
        this.$thumbs.find('.thumb .wrap').equaliseHeight();
    }

    sizeThumb($thumb: JQuery) : void {
        var width = $thumb.data('width');
        var height = $thumb.data('height');

        var $wrap = $thumb.find('.wrap');
        var $img = $wrap.find('img');

        $wrap.width(width * this.range);
        $wrap.height(height * this.range);
        $img.width(width * this.range);
        $img.height(height * this.range);
    }

    loadThumb($thumb: JQuery): void {
        var $wrap = $thumb.find('.wrap');

        if ($wrap.hasClass('loading') || $wrap.hasClass('loaded')) return;

        // if no img has been added yet

        var visible = $thumb.attr('data-visible');

        var fadeDuration = this.options.thumbsImageFadeInDuration;

        if (visible !== "false") {
            $wrap.addClass('loading');
            var src = $thumb.attr('data-src');
            var img = $('<img src="' + src + '" />');
            // fade in on load.
            $(img).hide().load(function () {
                $(this).fadeIn(fadeDuration, function () {
                    $(this).parent().swapClass('loading', 'loaded');
                });
            });
            $wrap.append(img);
        } else {
            $wrap.addClass('hidden');
        }
    }

    show(): void {
        this.isOpen = true;
        this.$element.show();

        setTimeout(() => {
            this.selectIndex(this.provider.canvasIndex);
        }, 1);
    }

    hide(): void {
        this.isOpen = false;
        this.$element.hide();
    }

    setLabel(): void {

        if((<extension.Extension>this.extension).getMode() == extension.Extension.PAGE_MODE) {
            $(this.$thumbs).find('span.index').hide();
            $(this.$thumbs).find('span.label').show();
        } else {
            $(this.$thumbs).find('span.index').show();
            $(this.$thumbs).find('span.label').hide();
        }
    }

    selectIndex(index): void {

        // may be authenticating
        if (index == -1) return;

        if (!this.thumbs || !this.thumbs.length) return;

        index = parseInt(index);

        this.$thumbs.find('.thumb').removeClass('selected');

        this.$selectedThumb = $(this.$thumbs.find('.thumb')[index]);

        this.$selectedThumb.addClass('selected');

        // scroll to thumb if the index change didn't originate
        // within the thumbs view.
        if (this.lastThumbClickedIndex != index) {
            var scrollTop = this.$element.scrollTop() + this.$selectedThumb.position().top - (this.$selectedThumb.height() / 2);
            this.$element.scrollTop(scrollTop);
        }

        // make sure visible images are loaded.
        this.updateThumbs();
    }

    resize(): void {
        super.resize();

        this.$main.height(this.$element.height() - this.$header.height());

        this.updateThumbs();
    }
}