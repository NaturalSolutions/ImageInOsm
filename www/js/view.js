/*
 * Copyright 2013 Natural Solutions
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var capturePhoto = (function(app) {
    "use strict";

    app.Views.OsmSelect = Backbone.Layout.extend({
        template: "#osm-selector-page",

        events: {
            'submit [name="osm-selector-form"]': 'onSubmit'
        },

        afterRender: function() {
            // Adding {manage: true} to BB.Form failed, hence this manual subview
            this.form = new Backbone.Form({model: app.models.pic, fields: ['osmobject']});
            this.form.on('osmobject:change', _.bind(this.onOsmSelectChange, this));
            this.$el.find('.osm-selector').empty().append(this.form.render().$el);
        },

        onOsmSelectChange: function(form, editor) {
            var val = editor.getValue();
            this.$el.find('.osm-selector-buttons button').prop('disabled', (val === null));
        },

        onSubmit: function(e) {
            // Don't actually submit the <form>
            e.preventDefault();

            this.form.commit();

            app.views.main.setView(new app.Views.Capture());
            app.views.main.render();
        }
    });

    function getNotificationCB(type) {
        return function (msg) {
            app.views.main.setView(new app.Views.Final({status: type, message: msg}));
            app.views.main.render();
        }
    };

    app.Views.Capture = Backbone.View.extend({
        manage: true,

        events: {
            'click #send-button-flickr': 'onSendFlickr',
            'click #send-button-wikimedia': 'displayMediaWikiForm',
            'click #mwSubmit': 'onSendMediawiki',
            'input #mwTitle, #mwPassword, #mwUsername': 'onChangeMediawiki'
        },

        initialize : function() {
            this.template = _.template($('#capture-template').html());
            Backbone.View.prototype.initialize.apply(this, arguments);
        },

        serialize : function() {
            return {osmid: app.models.pic.attributes.osmobject.fid};
        },

        afterRender: function() {
            // Immediatly launch camera when view is rendered
            this.capturePhoto();
        },

        capturePhoto: function() {
            // Take picture using device camera and retrieve image as a local path
            navigator.camera.getPicture(
                _.bind(this.onSuccess, this),
                _.bind(this.onFail, this),
                {
                    quality: 50,
                    correctOrientation: false,
                    encodingType: navigator.camera.EncodingType.JPEG,
                    source: navigator.camera.PictureSourceType.CAMERA,
                    targetWidth: 1024,
                    destinationType: navigator.camera.DestinationType.FILE_URI
                });
        },

        onSuccess: function(imageURI) {
            app.models.pic.set({data: imageURI});
            this.$el.find('.img-preview img').attr('src', imageURI);
        },

        onFail: getNotificationCB('error'),

        onSendFlickr: function(e) {
            var imageURI = app.models.pic.attributes.data,
                feature = app.models.pic.attributes.osmobject;
            this.server = new app.utils.FlickrAPI({
                consumerKey: '77f739a96134f39fcd38ff74c72b1fc8', // Application identifier (should be kept secret, don't use OAuth with JavaScript...)
                consumerSecret: 'a27edc675234f748',
                callbackUrl: 'http://fakeurl.com/' // Use any fake but valid URL as a callback, we just use it to intercept the callback redirection
            });
            this.server.sendPicture(imageURI, feature).then(
                getNotificationCB('success'), getNotificationCB('error')
            );
        },

        onSendMediawiki: function(e) {
            var imageURI = app.models.pic.attributes.data,
                feature = app.models.pic.attributes.osmobject,
                mwTitle = $("#mwTitle").val(),
                mwDesc = $("#mwDescription").val() ;
            this.server = new app.utils.WikimediaAPI({
                username: $("#mwUsername").val(),
                password: $("#mwPassword").val()
            });
            this.server.sendPicture(imageURI, feature, mwTitle, mwDesc ).then(
                getNotificationCB('success'), getNotificationCB('error')
            );
        },

        onChangeMediawiki: function(e) {
            var valid = document.getElementById('mwTitle').validity.valid &&
                        document.getElementById('mwPassword').validity.valid &&
                        document.getElementById('mwUsername').validity.valid;
            $('#mwSubmit').attr('disabled', !valid);
        },

        displayMediaWikiForm: function(e) {
            $("#send-buttons").hide();
            $("#mediawiki-upload-form").removeClass('hide');
            $("#mediawiki-disclaimer").removeClass('hide');
            var mwUserName = localStorage.getItem('mwUsername'),
                mwPassword = localStorage.getItem('mwPassword');
            if (mwUserName === null) {
                $("#mediawiki-login-form").removeClass('hide');
                $("#mwUsername").focus();
            } else {
                $("#mwUsername").val(mwUserName);
                $("#mwPassword").val(mwPassword);
                $("#mwTitle").focus();
            }
        }
    });

    app.Views.Final = Backbone.View.extend({
        manage: true,
        template: "#final-template",

        events: {
            'click #restart': 'restart',
            'click #new-picture': 'newPicture',
            'click #exit': 'exit'
        },

        initialize : function(options) {
            this.status = options.status;
            this.message = options.message;
            Backbone.View.prototype.initialize.apply(this, arguments);
        },

        serialize: function() {
            return {
                status: this.status,
                message: this.message
            };
        },

        restart: function() {
            app.start();
        },

        newPicture: function() {
            app.views.main.setView(new app.Views.Capture());
            app.views.main.render();
        },

        exit: function() {
            navigator.app.exitApp();
        }
    });

    return app;
})(capturePhoto);