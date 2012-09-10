/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global require, define, Mustache, $ */


define(function (require, exports, module) {
    "use strict";
    
    var apiUrlPrefix      = "https://typekit.com/api/edge_internal_v1/",
        fontIncludePrefix = "<script src=\"http://webfonts.creativecloud.com/",
        fontIncludeSuffix = ".js\"></script>";
    
    var fontsByClass = {},
        fontsByName  = {},
        fontsBySlug  = {},
        allFonts;
    
    var pickerHtml     = require("text!core/htmlContent/ewf-picker.html"),
        resultsHtml    = require("text!core/htmlContent/ewf-results.html"),
        Strings        = require("core/strings");
    
    var $picker  = null,
        $results = null;
    
    var fontClassifications = ["serif", "sans-serif", "slab-serif", "script", "blackletter", "monospaced", "handmade", "decorative"];
    
    /**
     * Returns a sorted array of all fonts that contain a case-insensitive version
     * of the needle.
     *
     * The results are sorted as follows:
     *   1. All fonts with a name that starts with the needle
     *   2. All fonts with a word that starts with the needle
     *   3. All fonts that contain the needle
     * Within each category, fonts are sorted alphabetically
     * 
     * @param {!string} needle - the search term
     * @return {Array.<Object> Array of font objects that contain the search term.
     */
    function searchByName(needle) {
        var beginning = [], beginningOfWord = [], contains = [];
        var i, index;
        
        var lowerCaseNeedle = needle.toLocaleLowerCase();
        
        for (i = 0; i < allFonts.length; i++) {
            index = allFonts[i].lowerCaseName.indexOf(lowerCaseNeedle);
            if (index === 0) {
                beginning.push(allFonts[i]);
            } else if (index > 0) {
                var previousChar = allFonts[i].lowerCaseName[index - 1];
                if (!previousChar.isAlpha() && !previousChar.isDigit()) {
                    beginningOfWord.push(allFonts[i]);
                } else {
                    contains.push(allFonts[i]);
                }
            }
        }
        
        return beginning.concat(beginningOfWord).concat(contains);
    }
    
    function _displayResults(families) {
        function fontClickHandler(event) {
            var d = event.target;

            // walk up the dom until we find something with the data-slug attribute
            while (d && !d.attributes.hasOwnProperty('data-slug')) {
                d = d.parentElement;
            }
            
            if (d) {
                console.log("[ewf]", "clicked a font", d.attributes["data-slug"].value);
            }
        }

        if ($results) {
            $results.empty();
            $results.html(Mustache.render(resultsHtml, {Strings: Strings, families: families}));
            $(".ewf-font").click(fontClickHandler);
        }
    }
    
    function renderPicker(domElement) {
        var localizedClassifications = [];
        var i;

        function classificationClickHandler(event) {
            var classification = $(event.target).attr("data-classification");
            var families = fontsByClass[classification];
        
            // clear previously selected class
            $('#ewf-tabs a').removeClass("selected");
            // select this class
            $(event.target).addClass("selected");
            
            console.log("[ewf]", "clicked a classification", classification);
        
            _displayResults(families);
        
            // return false because these are anchor tags
            return false;
        }
        
        // map font classifications to their localized names:
        for (i = 0; i < fontClassifications.length; i++) {
            localizedClassifications.push({className: fontClassifications[i], localizedName: Strings[fontClassifications[i]]});
        }
        
        $picker = $(Mustache.render(pickerHtml, {Strings: Strings, localizedClassifications: localizedClassifications}));
        $(domElement).append($picker);

        $('#ewf-tabs a', $picker).click(classificationClickHandler);
        
        $results = $("#ewf-results", $picker);

        $('#ewf-tabs a:first').trigger('click');
    }
    
    /**
     * Generates the script tag for including the specified fonts.
     *
     * @param {!Array} fonts - should be an array of objects, and each object 
     *      should have the following properties:
     *        slug - string specifying the unique slug of the font (e.g. "droid-sans")
     *        fvds - array of variant strings (e.g. ["n4", "n7"])
     *        subset - string specifying the subset desired (e.g. "default")
     *
     */
    function createInclude(fonts) {
        var i, fontStrings = [];
        for (i = 0; i < fonts.length; i++) {
            fontStrings.push(fonts[i].slug + ":" + fonts[i].fvds.join(",") + ":" + fonts[i].subset);
        }
        return fontIncludePrefix + fontStrings.join(";") + fontIncludeSuffix;
    }
    
    function init(newApiUrlPrefix) {
        var d = $.Deferred();
        
        if (newApiUrlPrefix) {
            apiUrlPrefix = newApiUrlPrefix;
        }
    
        function organizeFamilies(families) {
            allFonts = families.families;
            var i, j;
    
            // we keep allFonts in alphabetical order by name, so that all other
            // lists will also be in order.
            allFonts.sort(function (a, b) { return (a.name < b.name ? -1 : 1); });
            
            // give all fonts a locale lowercase name
            for (i = 0; i < allFonts.length; i++) {
                allFonts[i].lowerCaseName = allFonts[i].name.toLocaleLowerCase();
            }
            
            fontsByClass = {};
            fontsByName = {};
            fontsBySlug = {};
            
            for (i = 0; i < allFonts.length; i++) {
                for (j = 0; j < allFonts[i].classifications.length; j++) {
                    if (!fontsByClass.hasOwnProperty(allFonts[i].classifications[j])) {
                        fontsByClass[allFonts[i].classifications[j]] = [];
                    }
                    fontsByClass[allFonts[i].classifications[j]].push(allFonts[i]);
                }
                
                fontsByName[allFonts[i].name] = allFonts[i];
                fontsBySlug[allFonts[i].slug] = allFonts[i];
            }
        }
        
        $.ajax({
            url: apiUrlPrefix + "families",
            dataType: 'json',
            success: function (data) {
                organizeFamilies(data);
                d.resolve();
            },
            error: function () {
                d.reject("XHR request to 'families' API failed");
            }
        });
        
        return d.promise();
                
    }
    
    exports.searchByName = searchByName;
    exports.renderPicker = renderPicker;
    exports.createInclude = createInclude;
    exports.init = init;
    
});
